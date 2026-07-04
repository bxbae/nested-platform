import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  createParamDecorator,
  ExecutionContext,
} from "@nestjs/common";
import { ReservationsService } from "./reservations.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  quoteSchema,
  createReservationSchema,
  confirmPaymentSchema,
  type QuoteDto,
  type CreateReservationDto,
  type ConfirmPaymentDto,
} from "./dto/reservation.dto";

// Placeholder param decorator — replaced by the real @CurrentUser (JWT) in app.
export const CurrentGuest = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    return req.user?.id ?? req.headers["x-user-id"] ?? "anonymous";
  }
);

// Routes per ARCHITECTURE.md §7.3. Auth guard + @CurrentUser are applied
// globally in the real app; here guestId is threaded explicitly for clarity.
@Controller()
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  // POST /reservations/quote — price preview (no write)
  @Post("reservations/quote")
  @HttpCode(200)
  quote(@Body(new ZodValidationPipe(quoteSchema)) dto: QuoteDto) {
    return this.service.quote(dto);
  }

  // POST /reservations — create PENDING_PAYMENT hold
  @Post("reservations")
  create(
    @Body(new ZodValidationPipe(createReservationSchema)) dto: CreateReservationDto,
    @CurrentGuest() guestId: string
  ) {
    return this.service.create(dto, guestId);
  }

  // POST /payments/confirm — verify + confirm
  @Post("payments/confirm")
  @HttpCode(200)
  confirm(
    @Body(new ZodValidationPipe(confirmPaymentSchema)) dto: ConfirmPaymentDto,
    @CurrentGuest() guestId: string
  ) {
    return this.service.confirmPayment(dto, guestId);
  }

  @Get("reservations/:id")
  get(@Param("id") id: string) {
    return this.service.getById(id);
  }

  // PATCH /reservations/:id/cancel — guest cancels their reservation (CRUD: update/delete)
  @Patch("reservations/:id/cancel")
  @HttpCode(200)
  cancel(@Param("id") id: string, @CurrentGuest() guestId: string) {
    return this.service.cancel(id, guestId);
  }
}
