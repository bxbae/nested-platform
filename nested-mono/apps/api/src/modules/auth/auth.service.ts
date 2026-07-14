import {
  Injectable, UnauthorizedException, ConflictException,
  NotFoundException, BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "./mail.service";

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
    private readonly mail: MailService
  ) {}

  // Current user, read fresh from the DB so name/createdAt reflect reality
  // (the JWT only carries id/email/role). Used by GET /auth/me.
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, role: true, createdAt: true,
        bio: true, avatarColor: true,
        // Lets the client hide "change password" for OAuth-only accounts,
        // which have no password to change.
        passwordHash: true,
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      bio: user.bio,
      avatarColor: user.avatarColor,
      hasPassword: user.passwordHash !== null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  // ── Profile update ──
  // Only name/bio/avatarColor are writable. Email and role are deliberately
  // NOT accepted: letting a client set its own role would make anyone an admin,
  // and email changes need a verification flow we don't have.
  async updateMe(userId: string, data: { name?: string; bio?: string; avatarColor?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        ...(data.avatarColor !== undefined ? { avatarColor: data.avatarColor } : {}),
      },
      select: {
        id: true, email: true, name: true, role: true, createdAt: true,
        bio: true, avatarColor: true, passwordHash: true,
      },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      bio: user.bio,
      avatarColor: user.avatarColor,
      hasPassword: user.passwordHash !== null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  // ── Password change ──
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) {
      throw new NotFoundException({ code: "USER_NOT_FOUND", message: "사용자를 찾을 수 없습니다." });
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
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Existing refresh tokens stay valid, which means a stolen session survives
    // a password change. Revoke them so "change password" actually locks others out.
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { ok: true };
  }

  // ── Email/password registration ──
  async register(email: string, password: string, name: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("이미 가입된 이메일입니다.");
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name },
    });
    return this.issueTokens(user.id, user.email, user.role, user.name, user.createdAt);
  }

  // ── Email/password login ──
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다.");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다.");
    if (user.suspended) throw new UnauthorizedException("정지된 계정입니다.");
    return this.issueTokens(user.id, user.email, user.role, user.name, user.createdAt);
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
      user = await this.prisma.user.findUnique({ where: { email: profile.email } });
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
            name: profile.name,
            provider: profile.provider,
            providerId: profile.providerId,
          },
        });
      }
    }
    return this.issueTokens(user.id, user.email, user.role, user.name, user.createdAt);
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
    if (!stored) throw new UnauthorizedException("만료되었거나 폐기된 토큰입니다.");

    // rotate: delete the used token, issue a fresh pair
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    return this.issueTokens(user.id, user.email, user.role, user.name, user.createdAt);
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
      await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

      const token = randomBytes(32).toString("hex");
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      const base = process.env.FRONTEND_URL ?? "http://localhost:3000";
      await this.mail.sendPasswordReset(email, `${base}/auth/reset?token=${token}`);
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
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
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
        createdAt: createdAt ? createdAt.toISOString() : null,
      },
    };
  }
}
