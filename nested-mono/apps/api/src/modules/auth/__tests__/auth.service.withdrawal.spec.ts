// 배치 위치: src/modules/auth/__tests__/auth.service.withdrawal.spec.ts
//
// 진행 중인 예약이 있으면 탈퇴를 막는 규칙 검증.
// 예약이 두 사람(게스트·호스트)을 묶고 있으므로, 한쪽이 임의로 사라지면
// 상대가 곤란해진다. prisma / jwt / mail 은 mock 으로 주입한다.

import { AuthService } from "../auth.service";
import { BadRequestException } from "@nestjs/common";

describe("AuthService — 탈퇴 제한 (진행 중 예약)", () => {
  function makeService(counts: { asGuest: number; asHost: number }) {
    const prisma: any = {
      user: {
        findUnique: jest.fn(async () => ({ deletedAt: null })),
        update: jest.fn(async () => ({})),
      },
      reservation: {
        // 첫 호출은 게스트 기준, 두 번째는 호스트 기준 카운트.
        count: jest
          .fn()
          .mockImplementationOnce(async () => counts.asGuest)
          .mockImplementationOnce(async () => counts.asHost),
      },
      refreshToken: { deleteMany: jest.fn(async () => ({})) },
      passwordResetToken: { deleteMany: jest.fn(async () => ({})) },
      $transaction: jest.fn(async (ops: any[]) => ops),
    };
    const jwt: any = { signAsync: jest.fn(async () => "t"), verifyAsync: jest.fn() };
    const mail: any = { configured: false, sendPasswordReset: jest.fn(), sendEmailVerification: jest.fn() };
    return { svc: new AuthService(prisma, jwt, mail), prisma };
  }

  it("게스트로서 진행 중인 예약이 있으면 탈퇴를 거부한다", async () => {
    const { svc } = makeService({ asGuest: 1, asHost: 0 });
    await expect(svc.deleteAccount("u1")).rejects.toMatchObject({
      response: { code: "ACTIVE_RESERVATION_EXISTS" },
    });
  });

  it("호스트로서 진행 중인 예약이 있으면 탈퇴를 거부한다", async () => {
    const { svc } = makeService({ asGuest: 0, asHost: 2 });
    await expect(svc.deleteAccount("u1")).rejects.toMatchObject({
      response: { code: "ACTIVE_RESERVATION_EXISTS" },
    });
  });

  it("진행 중인 예약이 없으면 탈퇴가 진행된다", async () => {
    const { svc, prisma } = makeService({ asGuest: 0, asHost: 0 });
    await svc.deleteAccount("u1");
    // 익명화 트랜잭션이 실행됐는지로 성공을 판정한다.
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("게스트·호스트 양쪽 예약 수를 모두 조회한다", async () => {
    const { svc, prisma } = makeService({ asGuest: 0, asHost: 0 });
    await svc.deleteAccount("u1");
    expect(prisma.reservation.count).toHaveBeenCalledTimes(2);
  });
});
