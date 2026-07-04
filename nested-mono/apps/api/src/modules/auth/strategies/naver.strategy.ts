import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-naver-v2";
import { AuthService } from "../auth.service";

// Naver OAuth. Returns email + name from the Naver profile response.
@Injectable()
export class NaverStrategy extends PassportStrategy(Strategy, "naver") {
  constructor(private readonly auth: AuthService) {
    super({
      clientID: process.env.NAVER_CLIENT_ID ?? "dev-naver-id",
      clientSecret: process.env.NAVER_CLIENT_SECRET ?? "dev-naver-secret",
      callbackURL: process.env.NAVER_CALLBACK_URL ?? "http://localhost:4000/auth/naver/callback",
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: any, done: (e: any, u?: any) => void) {
    const email = profile.email ?? `naver_${profile.id}@users.nested.kr`;
    const name = profile.name ?? profile.nickname ?? "Naver User";
    const tokens = await this.auth.validateOAuthUser({
      provider: "naver",
      providerId: String(profile.id),
      email,
      name,
    });
    done(null, tokens);
  }
}
