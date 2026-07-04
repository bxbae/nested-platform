import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, type VerifyCallback } from "passport-google-oauth20";
import { AuthService } from "../auth.service";

// Google OAuth 2.0 login. On callback, find-or-create the user and issue JWTs.
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(private readonly auth: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? "dev-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "dev-client-secret",
      callbackURL: process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:4000/auth/google/callback",
      scope: ["email", "profile"],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback
  ) {
    const tokens = await this.auth.validateOAuthUser({
      provider: "google",
      providerId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName ?? "Google User",
    });
    done(null, tokens);
  }
}
