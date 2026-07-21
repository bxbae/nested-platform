import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-kakao";
import { AuthService } from "../auth.service";

// Kakao OAuth. Email requires the "account_email" consent scope in the
// Kakao developer console; we fall back to a kakao-scoped pseudo-email if absent.
@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, "kakao") {
  constructor(private readonly auth: AuthService) {
    super({
      clientID: process.env.KAKAO_CLIENT_ID ?? "dev-kakao-id",
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
      callbackURL: process.env.KAKAO_CALLBACK_URL ?? "http://localhost:4000/auth/kakao/callback",
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: any, done: (e: any, u?: any) => void) {
    const kakaoAccount = profile._json?.kakao_account;
    const email = kakaoAccount?.email ?? `kakao_${profile.id}@users.nested.kr`;
    const name = profile.displayName ?? kakaoAccount?.profile?.nickname ?? "";
    const tokens = await this.auth.validateOAuthUser({
      provider: "kakao",
      providerId: String(profile.id),
      email,
      name,
    });
    done(null, tokens);
  }
}
