import { Controller, Post, Get, Body, UseGuards, Req, Res, HttpCode } from "@nestjs/common";
import type { Response } from "express";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
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
  name: z.string().min(1),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const refreshSchema = z.object({ refreshToken: z.string().min(1) });

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body(new ZodValidationPipe(registerSchema)) dto: z.infer<typeof registerSchema>) {
    return this.auth.register(dto.email, dto.password, dto.name);
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
  providers: [AuthService, JwtStrategy, GoogleStrategy, KakaoStrategy, NaverStrategy, AppleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
