import { Injectable, Logger } from "@nestjs/common";
import type { PaymentGateway, PaymentVerification } from "./ports";

// Server-side payment verification. NEVER trust the client's claim that a
// payment succeeded — call the PSP directly and confirm the amount matches.
//
// Toss:   POST https://api.tosspayments.com/v1/payments/confirm
//         Basic auth with the secret key; body { paymentKey, orderId, amount }.
// PortOne: GET the payment by imp_uid with an access token, compare amount/status.
//
// Both are idempotent on the PSP side; we also dedupe on providerTxnId upstream.
@Injectable()
export class PspPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(PspPaymentGateway.name);

  async verify(params: {
    provider: "TOSS" | "PORTONE" | "STRIPE";
    paymentKey: string;
    expectedAmount: number;
  }): Promise<PaymentVerification> {
    switch (params.provider) {
      case "TOSS":
        return this.verifyToss(params.paymentKey, params.expectedAmount);
      case "PORTONE":
        return this.verifyPortOne(params.paymentKey, params.expectedAmount);
      case "STRIPE":
        return this.verifyStripe(params.paymentKey, params.expectedAmount);
    }
  }

  private async verifyToss(paymentKey: string, expected: number): Promise<PaymentVerification> {
    const secret = process.env.TOSS_SECRET_KEY;
    if (!secret) return fail(paymentKey, "TOSS_SECRET_KEY 미설정");
    try {
      const res = await fetch("https://api.tosspayments.com/v1/payments/" + encodeURIComponent(paymentKey), {
        headers: {
          Authorization: "Basic " + Buffer.from(`${secret}:`).toString("base64"),
        },
      });
      if (!res.ok) return fail(paymentKey, `Toss 조회 실패 (${res.status})`);
      const p = (await res.json()) as { status: string; totalAmount: number; paymentKey: string };
      const ok = p.status === "DONE" && p.totalAmount === expected;
      return { ok, providerTxnId: p.paymentKey, paidAmount: p.totalAmount, reason: ok ? undefined : "상태/금액 불일치" };
    } catch (e) {
      this.logger.error("Toss verify error", e as Error);
      return fail(paymentKey, "Toss 통신 오류");
    }
  }

  private async verifyPortOne(impUid: string, expected: number): Promise<PaymentVerification> {
    const key = process.env.PORTONE_API_KEY;
    const secret = process.env.PORTONE_API_SECRET;
    if (!key || !secret) return fail(impUid, "PortOne 자격정보 미설정");
    try {
      const tokenRes = await fetch("https://api.iamport.kr/users/getToken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imp_key: key, imp_secret: secret }),
      });
      const token = ((await tokenRes.json()) as any)?.response?.access_token;
      if (!token) return fail(impUid, "PortOne 토큰 발급 실패");
      const res = await fetch(`https://api.iamport.kr/payments/${encodeURIComponent(impUid)}`, {
        headers: { Authorization: token },
      });
      const body = (await res.json()) as any;
      const pay = body?.response;
      const ok = pay?.status === "paid" && pay?.amount === expected;
      return { ok, providerTxnId: impUid, paidAmount: pay?.amount ?? 0, reason: ok ? undefined : "상태/금액 불일치" };
    } catch (e) {
      this.logger.error("PortOne verify error", e as Error);
      return fail(impUid, "PortOne 통신 오류");
    }
  }

  private async verifyStripe(intentId: string, expected: number): Promise<PaymentVerification> {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return fail(intentId, "STRIPE_SECRET_KEY 미설정");
    try {
      const res = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(intentId)}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const pi = (await res.json()) as { status: string; amount_received: number; id: string };
      const ok = pi.status === "succeeded" && pi.amount_received === expected;
      return { ok, providerTxnId: pi.id, paidAmount: pi.amount_received, reason: ok ? undefined : "상태/금액 불일치" };
    } catch (e) {
      this.logger.error("Stripe verify error", e as Error);
      return fail(intentId, "Stripe 통신 오류");
    }
  }
}

function fail(txn: string, reason: string): PaymentVerification {
  return { ok: false, providerTxnId: txn, paidAmount: 0, reason };
}
