import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-apple";
import { AuthService } from "../auth.service";

// Sign in with Apple. Apple only returns the user's name on the FIRST
// authorization, and the email may be an Apple private-relay address.
// The id token (decoded by passport-apple) carries `sub` and `email`.
@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, "apple") {
  constructor(private readonly auth: AuthService) {
    super({
      clientID: process.env.APPLE_CLIENT_ID || "dev.nested.app",
      teamID: process.env.APPLE_TEAM_ID || "DEVTEAMID",
      keyID: process.env.APPLE_KEY_ID || "DEVKEYID",
      privateKeyString: process.env.APPLE_PRIVATE_KEY || "dev-private-key",
      callbackURL: process.env.APPLE_CALLBACK_URL || "http://localhost:4000/auth/apple/callback",
      passReqToCallback: false,
      scope: ["name", "email"],
    } as any);
  }

  async validate(_accessToken: string, _refreshToken: string, idToken: any, profile: any, done: (e: any, u?: any) => void) {
    // idToken is the decoded Apple identity token: { sub, email, ... }
    const providerId = idToken?.sub ?? profile?.id;
    const email = idToken?.email ?? `apple_${providerId}@users.nested.kr`;
    const name = profile?.name
      ? `${profile.name.firstName ?? ""} ${profile.name.lastName ?? ""}`.trim() || "Apple User"
      : "Apple User";
    const tokens = await this.auth.validateOAuthUser({
      provider: "apple",
      providerId: String(providerId),
      email,
      name,
    });
    done(null, tokens);
  }
}
