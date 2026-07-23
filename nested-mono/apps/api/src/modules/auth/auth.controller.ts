import { Controller, Post, Get, Patch, Delete, Body, UseGuards, Req, Res, HttpCode } from "@nestjs/common";
import type { Response } from "express";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { MailService } from "./mail.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { GoogleStrategy } from "./strategies/google.strategy";
import { KakaoStrategy } from "./strategies/kakao.strategy";
import { NaverStrategy } from "./strategies/naver.strategy";
import { AppleStrategy } from "./strategies/apple.strategy";
import {
  JwtAuthGuard,
  GoogleAuthGuard,
  KakaoAuthGuard,
  NaverAuthGuard,
  AppleAuthGuard,
} from "./guards/auth.guards";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(2, "닉네임은 2자 이상 입력해주세요.").max(20, "닉네임은 20자 이하로 입력해주세요."),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], { required_error: "성별을 선택해주세요." }),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const refreshSchema = z.object({ refreshToken: z.string().min(1) });

// Only these three are writable. `email` and `role` are deliberately absent:
// Zod strips unknown keys, so a client can't sneak `role: "ADMIN"` through.
const updateMeSchema = z.object({
  name: z.string().trim().min(2, "닉네임은 2자 이상 입력해주세요.").max(20, "닉네임은 20자 이하로 입력해주세요.").optional(),
  bio: z.string().max(500, "자기소개는 500자 이내로 입력해주세요.").optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "색상 형식이 올바르지 않아요.").optional(),
  // Profile card fields (스토리보드 1-1 / 08). All optional.
  avatarUrl: z.string().url("이미지 주소가 올바르지 않아요.").max(500).nullable().optional(),
  // ISO 날짜 문자열(YYYY-MM-DD 또는 전체 ISO). 서비스에서 Date로 변환한다.
  birthDate: z.string().min(1).nullable().optional(),
  job: z.string().max(40).nullable().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요."),
});

const verifyEmailSchema = z.object({ token: z.string().min(1) });
const resendVerificationSchema = z.object({ email: z.string().email() });
const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요."),
  newPassword: z.string().min(8, "새 비밀번호는 8자 이상이어야 합니다."),
});

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body(new ZodValidationPipe(registerSchema)) dto: z.infer<typeof registerSchema>) {
    return this.auth.register(dto.email, dto.password, dto.name, dto.gender);
  }

  @Post("login")
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) dto: z.infer<typeof loginSchema>) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post("refresh")
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(refreshSchema)) dto: z.infer<typeof refreshSchema>) {
    return this.auth.refresh(dto.refreshToken);
  }

  // Protected route example — requires a valid JWT.
  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return this.auth.getMe(req.user.id);
  }

  // PATCH /auth/me — update own profile (name, bio, avatar colour).
  @Patch("me")
  @UseGuards(JwtAuthGuard)
  updateMe(
    @Req() req: any,
    @Body(new ZodValidationPipe(updateMeSchema)) dto: z.infer<typeof updateMeSchema>,
  ) {
    return this.auth.updateMe(req.user.id, dto);
  }

  // POST /auth/change-password — verifies the current password first.
  // Rejects OAuth-only accounts, which have no password to change.
  @Post("change-password")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Req() req: any,
    @Body(new ZodValidationPipe(changePasswordSchema)) dto: z.infer<typeof changePasswordSchema>,
  ) {
    return this.auth.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
  }

  // POST /auth/forgot-password — emails a reset link.
  // Deliberately unauthenticated, and always returns { ok: true } even for an
  // unknown address: a different response would reveal which emails have
  // accounts.
  @Post("forgot-password")
  @HttpCode(200)
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) dto: z.infer<typeof forgotPasswordSchema>,
  ) {
    return this.auth.forgotPassword(dto.email);
  }

  // POST /auth/reset-password — consumes the emailed token.
  @Post("reset-password")
  @HttpCode(200)
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: z.infer<typeof resetPasswordSchema>,
  ) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  // POST /auth/verify-email — consumes the emailed verification token and
  // returns a session (the user is logged in on success).
  @Post("verify-email")
  @HttpCode(200)
  verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) dto: z.infer<typeof verifyEmailSchema>,
  ) {
    return this.auth.verifyEmail(dto.token);
  }

  // POST /auth/resend-verification — re-send the verification link.
  // Always resolves, even for unknown/verified addresses (no enumeration).
  @Post("resend-verification")
  @HttpCode(200)
  resendVerification(
    @Body(new ZodValidationPipe(resendVerificationSchema)) dto: z.infer<typeof resendVerificationSchema>,
  ) {
    return this.auth.resendVerification(dto.email);
  }

  // DELETE /auth/me — soft-delete own account (anonymise + block login).
  // POST /auth/become-host — GUEST 계정을 호스트로 전환.
  // Responds with a new token pair so the client can act as a host immediately
  // (guards read the role from the JWT, not the database).
  @Post("become-host")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  becomeHost(@Req() req: any) {
    return this.auth.becomeHost(req.user.id);
  }

  @Delete("me")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  deleteAccount(@Req() req: any) {
    return this.auth.deleteAccount(req.user.id);
  }

  // ── Google OAuth ──
  @Get("google")
  @UseGuards(GoogleAuthGuard)
  googleStart() {
    // Passport redirects to Google.
  }

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  googleCallback(@Req() req: any, @Res() res: Response) {
    return this.redirectWithTokens(res, req.user);
  }

  // ── Kakao OAuth ──
  @Get("kakao")
  @UseGuards(KakaoAuthGuard)
  kakaoStart() {}

  @Get("kakao/callback")
  @UseGuards(KakaoAuthGuard)
  kakaoCallback(@Req() req: any, @Res() res: Response) {
    return this.redirectWithTokens(res, req.user);
  }

  // ── Naver OAuth ──
  @Get("naver")
  @UseGuards(NaverAuthGuard)
  naverStart() {}

  @Get("naver/callback")
  @UseGuards(NaverAuthGuard)
  naverCallback(@Req() req: any, @Res() res: Response) {
    return this.redirectWithTokens(res, req.user);
  }

  // Sends the browser back to the SPA's callback route with the freshly issued
  // tokens in the URL fragment (never logged by servers/proxies). The frontend
  // reads them, stores the session, and redirects into the app.
  private redirectWithTokens(
    res: Response,
    payload: { accessToken: string; refreshToken: string },
  ) {
    const base = process.env.FRONTEND_URL ?? "http://localhost:3000";
    const params = new URLSearchParams({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
    });
    res.redirect(`${base}/auth/callback#${params.toString()}`);
  }

  // ── Apple OAuth (Sign in with Apple) ──
  @Get("apple")
  @UseGuards(AppleAuthGuard)
  appleStart() {}

  @Post("apple/callback")
  @UseGuards(AppleAuthGuard)
  appleCallback(@Req() req: any) {
    return req.user;
  }
}

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}), // secrets passed per-sign call
  ],
  controllers: [AuthController],
  providers: [AuthService, MailService, JwtStrategy, GoogleStrategy, KakaoStrategy, NaverStrategy, AppleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
