import { Injectable, Logger } from "@nestjs/common";

// Transactional email via Resend (https://resend.com).
//
// Plain fetch rather than the SDK — one endpoint, no need for a dependency.
//
// If RESEND_API_KEY is unset the service degrades to logging the email instead
// of throwing: a missing mail provider shouldn't take down password reset in
// local dev, and the reset link is still visible in the server log.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private get apiKey(): string {
    return process.env.RESEND_API_KEY ?? "";
  }

  // Resend's shared sender. Works without owning a domain, but it can only
  // deliver to the address that owns the Resend account — good enough for a
  // demo, not for real users. Verify a domain and set MAIL_FROM to fix that.
  private get from(): string {
    return process.env.MAIL_FROM ?? "Nested <onboarding@resend.dev>";
  }

  get configured(): boolean {
    return Boolean(this.apiKey);
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.configured) {
      this.logger.warn(
        `RESEND_API_KEY not set — email to ${to} not sent. Subject: ${subject}`,
      );
      this.logger.debug(html);
      return;
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: this.from, to, subject, html }),
      });

      if (!res.ok) {
        const body = await res.text();
        // Swallow rather than rethrow: the caller must not reveal whether the
        // address exists, and a provider outage shouldn't surface as a 500.
        this.logger.error(`Resend rejected the email to ${to}: ${res.status} ${body}`);
      }
    } catch (e) {
      this.logger.error(`Failed to send email to ${to}: ${e}`);
    }
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#222">
        <h1 style="font-size:22px;margin:0 0 16px">비밀번호 재설정</h1>
        <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 24px">
          비밀번호 재설정을 요청하셨습니다. 아래 버튼을 눌러 새 비밀번호를 설정해주세요.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#FF5A5F;color:#fff;text-decoration:none;padding:13px 28px;border-radius:999px;font-weight:600;font-size:15px">
          비밀번호 재설정
        </a>
        <p style="font-size:13px;line-height:1.6;color:#888;margin:24px 0 0">
          이 링크는 <strong>1시간 후 만료</strong>되며 한 번만 사용할 수 있습니다.<br />
          본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다. 비밀번호는 변경되지 않습니다.
        </p>
        <p style="font-size:12px;color:#aaa;margin:24px 0 0;word-break:break-all">
          버튼이 동작하지 않으면 이 주소를 복사해 붙여넣으세요:<br />${resetUrl}
        </p>
      </div>
    `;
    await this.send(to, "[Nested] 비밀번호 재설정", html);
  }
}
