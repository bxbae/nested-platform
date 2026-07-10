import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

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
