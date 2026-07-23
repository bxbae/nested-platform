import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "./mail.service";
import type { ReservationStatus } from "@prisma/client";
import { toBadges } from "../../common/activity-tier";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  // Current user, read fresh from the DB so name/createdAt reflect reality
  // (the JWT only carries id/email/role). Used by GET /auth/me.
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        nicknameCompleted: true,
        role: true,
        createdAt: true,
        bio: true,
        avatarColor: true,
        avatarUrl: true,
        age: true,
        job: true,
        gender: true,
        preferredLocale: true,
        // Lets the client hide "change password" for OAuth-only accounts,
        // which have no password to change.
        passwordHash: true,
        // Badge inputs: admin identity check + activity counts.
        verifiedAt: true,
        _count: { select: { reviews: true } },
        reservations: { where: { status: "COMPLETED" }, select: { id: true } },
      },
    });
    if (!user) return null;
    const badges = toBadges(
      user.verifiedAt,
      user.reservations.length,
      user._count.reviews,
    );
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      nicknameCompleted: user.nicknameCompleted,
      role: user.role,
      bio: user.bio,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
      age: user.age,
      job: user.job,
      gender: user.gender,
      preferredLocale: user.preferredLocale,
      hasPassword: user.passwordHash !== null,
      createdAt: user.createdAt.toISOString(),
      // 인증·활동 뱃지
      ...badges,
      completedStays: user.reservations.length,
      reviewsWritten: user._count.reviews,
    };
  }

  // ── Profile update ──
  // Only name/bio/avatarColor/avatarUrl/age/job are writable. Email and role are deliberately
  // NOT accepted: letting a client set its own role would make anyone an admin,
  // and email changes need a verification flow we don't have.
  async updateMe(
    userId: string,
    data: {
      name?: string;
      bio?: string;
      avatarColor?: string;
      avatarUrl?: string | null;
      age?: number | null;
      job?: string | null;
      gender?: "MALE" | "FEMALE" | "OTHER";
    },
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined
          ? { name: data.name, nicknameCompleted: true }
          : {}),
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        ...(data.avatarColor !== undefined
          ? { avatarColor: data.avatarColor }
          : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        ...(data.age !== undefined ? { age: data.age } : {}),
        ...(data.job !== undefined ? { job: data.job } : {}),
        ...(data.gender !== undefined ? { gender: data.gender } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        nicknameCompleted: true,
        role: true,
        createdAt: true,
        bio: true,
        avatarColor: true,
        avatarUrl: true,
        age: true,
        job: true,
        gender: true,
        preferredLocale: true,
        passwordHash: true,
      },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      nicknameCompleted: user.nicknameCompleted,
      role: user.role,
      bio: user.bio,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
      age: user.age,
      job: user.job,
      gender: user.gender,
      preferredLocale: user.preferredLocale,
      hasPassword: user.passwordHash !== null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateLocale(userId: string, preferredLocale: "KO" | "EN") {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { preferredLocale },
      select: {
        id: true,
        preferredLocale: true,
      },
    });

    return {
      id: user.id,
      preferredLocale: user.preferredLocale,
    };
  }
  // ── Password change ──
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "사용자를 찾을 수 없습니다.",
      });
    }
    // Social-login accounts have no password. Offering a "change" here would be
    // meaningless — they'd need a "set password" flow instead.
    if (!user.passwordHash) {
      throw new BadRequestException({
        code: "NO_PASSWORD",
        message: "소셜 로그인 계정은 비밀번호를 변경할 수 없어요.",
      });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException({
        code: "WRONG_PASSWORD",
        message: "현재 비밀번호가 올바르지 않습니다.",
      });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Existing refresh tokens stay valid, which means a stolen session survives
    // a password change. Revoke them so "change password" actually locks others out.
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { ok: true };
  }

  // ── Email/password registration ──
  async register(
    email: string,
    password: string,
    name: string,
    gender: "MALE" | "FEMALE" | "OTHER",
    preferredLocale: "KO" | "EN",
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("이미 가입된 이메일입니다.");
    const passwordHash = await bcrypt.hash(password, 10);

    // When no mail provider is configured (local dev / offline demo) we can't
    // ask the user to prove they own the address, so we mark them verified on
    // creation. With a real provider set, emailVerified stays null until they
    // click the link, and login is blocked in the meantime.
    const autoVerify = !this.mail.configured;

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        gender,
        preferredLocale,
        nicknameCompleted: true,
        emailVerified: autoVerify ? new Date() : null,
      },
    });

    if (autoVerify) {
      // Straight to a session — same behaviour as before mail was required.
      return this.issueTokens(
        user.id,
        user.email,
        user.role,
        user.name,
        user.createdAt,
      );
    }

    // Real provider: send the verification link and DO NOT issue tokens.
    // The client shows a "check your email" state instead of logging in.
    await this.sendVerificationEmail(user.id, user.email);
    return {
      verificationRequired: true as const,
      email: user.email,
      message:
        "가입 확인 메일을 보냈어요. 메일의 링크를 눌러 인증을 완료해주세요.",
    };
  }

  // ── Email/password login ──
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash)
      throw new UnauthorizedException(
        "이메일 또는 비밀번호가 올바르지 않습니다.",
      );
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      throw new UnauthorizedException(
        "이메일 또는 비밀번호가 올바르지 않습니다.",
      );
    if (user.deletedAt) throw new UnauthorizedException("탈퇴한 계정입니다.");
    if (user.suspended) throw new UnauthorizedException("정지된 계정입니다.");
    // Block login until the address is confirmed — but only when a mail
    // provider is configured (otherwise no one could ever verify).
    if (this.mail.configured && !user.emailVerified) {
      throw new UnauthorizedException({
        code: "EMAIL_NOT_VERIFIED",
        message:
          "이메일 인증이 필요해요. 가입 시 받은 메일의 링크를 눌러주세요.",
      });
    }
    return this.issueTokens(
      user.id,
      user.email,
      user.role,
      user.name,
      user.createdAt,
    );
  }

  // ── OAuth (Google) — find-or-create then issue tokens ──
  async validateOAuthUser(profile: {
    provider: string;
    providerId: string;
    email: string;
    name: string;
  }) {
    let user = await this.prisma.user.findFirst({
      where: { provider: profile.provider, providerId: profile.providerId },
    });
    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });
      if (user) {
        // link OAuth to existing email account
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { provider: profile.provider, providerId: profile.providerId },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            name: this.createTemporaryNickname(),
            nicknameCompleted: false,
            provider: profile.provider,
            providerId: profile.providerId,
          },
        });
      }
    }
    return this.issueTokens(
      user.id,
      user.email,
      user.role,
      user.name,
      user.createdAt,
    );
  }

  // ── Refresh-token rotation (DB-backed) ──
  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException("유효하지 않은 리프레시 토큰입니다.");
    }

    // The presented token must exist in the DB and not be expired. This lets
    // us revoke sessions (logout / password change) and detect token reuse.
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, tokenHash, expiresAt: { gt: new Date() } },
    });
    if (!stored)
      throw new UnauthorizedException("만료되었거나 폐기된 토큰입니다.");

    // rotate: delete the used token, issue a fresh pair
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new UnauthorizedException();
    return this.issueTokens(
      user.id,
      user.email,
      user.role,
      user.name,
      user.createdAt,
    );
  }

  // Revoke all sessions for a user (logout everywhere).
  async logoutAll(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  // ── Forgot password ──
  // Always resolves the same way, whether or not the address is registered.
  // Reporting "no such user" would turn this into a membership oracle — an
  // attacker could enumerate which emails have accounts.
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    // Social-only accounts have no password to reset. Same silent no-op:
    // saying so would leak that the account exists and how it signs in.
    if (user?.passwordHash) {
      // Invalidate outstanding links so only the newest one works.
      await this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      const token = randomBytes(32).toString("hex");
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      const base = process.env.FRONTEND_URL ?? "http://localhost:3000";
      await this.mail.sendPasswordReset(
        email,
        `${base}/auth/reset?token=${token}`,
      );
    }

    return { ok: true };
  }

  // ── Reset password ──
  async resetPassword(token: string, newPassword: string) {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    // One message for every failure mode (unknown / expired / already used).
    // Distinguishing them only helps someone probing tokens.
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException({
        code: "INVALID_RESET_TOKEN",
        message: "링크가 만료되었거나 이미 사용되었어요. 다시 요청해주세요.",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash },
      }),
      // Burn the token so the link can't be replayed.
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      // Whoever forced the reset must not keep an old session alive.
      this.prisma.refreshToken.deleteMany({ where: { userId: row.userId } }),
    ]);

    return { ok: true };
  }

  // ── Account deletion (soft) ──
  // We don't hard-delete: reservations, reviews and messages reference the user
  // (some via RESTRICT), and other people's history shouldn't break because
  // someone left. Instead we anonymise the personal fields and mark the row
  // deleted. The account's contributions survive as "탈퇴한 사용자".
  // GUEST → HOST. Anyone may list a room; the safety gate is that new listings
  // start unpublished and an admin approves them (/admin/approvals), so opening
  // this up doesn't put unvetted rooms in front of guests.
  //
  // Returns a fresh token pair: the caller's current JWT still carries the old
  // role, and every guard reads the role from the token — without new tokens
  // they'd stay a GUEST until the next login.
  async becomeHost(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        deletedAt: true,
        suspended: true,
      },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "사용자를 찾을 수 없습니다.",
      });
    }
    if (user.suspended) {
      throw new BadRequestException({
        code: "ACCOUNT_SUSPENDED",
        message: "정지된 계정입니다.",
      });
    }
    // Admins already outrank hosts — silently downgrading them would be a bug.
    if (user.role === "ADMIN") {
      throw new BadRequestException({
        code: "ALREADY_PRIVILEGED",
        message: "관리자 계정은 호스트 전환이 필요하지 않습니다.",
      });
    }
    if (user.role === "HOST") {
      throw new BadRequestException({
        code: "ALREADY_HOST",
        message: "이미 호스트예요.",
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: "HOST" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return this.issueTokens(
      updated.id,
      updated.email,
      updated.role,
      updated.name,
      updated.createdAt,
    );
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { deletedAt: true },
    });
    if (!user) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "사용자를 찾을 수 없습니다.",
      });
    }
    if (user.deletedAt) {
      throw new BadRequestException({
        code: "ALREADY_DELETED",
        message: "이미 탈퇴한 계정입니다.",
      });
    }

    // A live reservation ties two people together: the guest who booked and the
    // host whose room it is. Letting either side vanish would strand the other,
    // so withdrawal is blocked until the booking is settled (cancelled by
    // agreement, or completed). Statuses that no longer hold the room —
    // cancelled / completed / no-show — don't block.
    const ACTIVE: ReservationStatus[] = [
      "PENDING_PAYMENT",
      "CONFIRMED",
      "EARLY_CHECKOUT_REQUESTED",
      "EARLY_CHECKOUT_APPROVED",
    ];

    const [asGuest, asHost] = await Promise.all([
      // Bookings this user made.
      this.prisma.reservation.count({
        where: { guestId: userId, status: { in: ACTIVE } },
      }),
      // Bookings on rooms this user hosts.
      this.prisma.reservation.count({
        where: { status: { in: ACTIVE }, room: { hostId: userId } },
      }),
    ]);

    if (asGuest > 0 || asHost > 0) {
      const role = asHost > 0 ? "호스트" : "입주자";
      const count = asGuest + asHost;
      throw new BadRequestException({
        code: "ACTIVE_RESERVATION_EXISTS",
        message:
          `진행 중인 예약이 ${count}건 있어 탈퇴할 수 없습니다. ` +
          `${role}로서 상대방과 협의해 예약을 정리한 뒤 다시 시도해주세요.`,
        activeAsGuest: asGuest,
        activeAsHost: asHost,
      });
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          name: "탈퇴한 사용자",
          bio: null,
          // Free the address for re-signup while keeping the row unique. The
          // id suffix avoids collisions if several accounts are deleted.
          email: `deleted+${userId}@nested.invalid`,
          // Kill both login paths.
          passwordHash: null,
          provider: null,
          providerId: null,
        },
      }),
      // Drop every active session so the just-deleted account can't keep using
      // a token it already holds.
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.passwordResetToken.deleteMany({ where: { userId } }),
    ]);

    return { ok: true };
  }

  // Issue a fresh verification token and email the link. Any outstanding
  // tokens are cleared so only the newest link works.
  private async sendVerificationEmail(userId: string, email: string) {
    await this.prisma.emailVerificationToken.deleteMany({ where: { userId } });
    const token = randomBytes(32).toString("hex");
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
    const base = process.env.FRONTEND_URL ?? "http://localhost:3000";
    await this.mail.sendEmailVerification(
      email,
      `${base}/auth/verify?token=${token}`,
    );
  }

  // GET/POST target for the emailed link. Stamps emailVerified and burns the
  // token so the link can't be replayed. Returns a session so the user is
  // logged in immediately after verifying.
  async verifyEmail(token: string) {
    const row = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException({
        code: "INVALID_VERIFICATION_TOKEN",
        message:
          "인증 링크가 만료되었거나 이미 사용되었어요. 다시 요청해주세요.",
      });
    }

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { emailVerified: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return this.issueTokens(
      user.id,
      user.email,
      user.role,
      user.name,
      user.createdAt,
    );
  }

  // Re-send the verification link. Silent no-op for unknown or already-verified
  // addresses so the endpoint can't be used to probe who's registered.
  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerified: true },
    });
    if (user && !user.emailVerified && this.mail.configured) {
      await this.sendVerificationEmail(user.id, user.email);
    }
    return { ok: true };
  }

  private createTemporaryNickname(): string {
    return `사용자${randomBytes(3).toString("hex")}`;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private async issueTokens(
    sub: string,
    email: string,
    role: string,
    name?: string | null,
    createdAt?: Date | null,
  ) {
    const profile = await this.prisma.user.findUnique({
      where: { id: sub },
      select: { nicknameCompleted: true, preferredLocale: true },
    });
    const payload: JwtPayload = { sub, email, role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: "15m",
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: "7d",
    });

    // persist the refresh token hash so it can be rotated/revoked
    await this.prisma.refreshToken.create({
      data: {
        userId: sub,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: sub,
        email,
        role,
        name: name ?? null,
        nicknameCompleted: profile?.nicknameCompleted ?? true,
        preferredLocale: profile?.preferredLocale ?? "KO",
        createdAt: createdAt ? createdAt.toISOString() : null,
      },
    };
  }
}
