import { Module } from "@nestjs/common";
import { ReservationsController } from "./reservations.controller";
import {
  ReservationsService,
  RESERVATION_REPO,
  PAYMENT_GATEWAY,
} from "./reservations.service";
import { PrismaReservationRepo } from "./prisma-reservation.repo";
import { PspPaymentGateway } from "./psp-payment.gateway";

@Module({
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    { provide: RESERVATION_REPO, useClass: PrismaReservationRepo },
    { provide: PAYMENT_GATEWAY, useClass: PspPaymentGateway },
  ],
  exports: [ReservationsService],
})
export class ReservationsModule {}
