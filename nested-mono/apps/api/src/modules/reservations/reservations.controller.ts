import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  UseGuards,
  UnauthorizedException,
  createParamDecorator,
  ExecutionContext,
} from "@nestjs/common";
import { ReservationsService } from "./reservations.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";
import {
  quoteSchema,
  createReservationSchema,
  confirmPaymentSchema,
  hostStatusSchema,
  type QuoteDto,
  type CreateReservationDto,
  type ConfirmPaymentDto,
  type HostStatusDto,
} from "./dto/reservation.dto";

// Pulls the authenticated user's id off req.user (populated by JwtAuthGuard).
// Throws if missing so we never fall back to a non-existent guest id.
export const CurrentGuest = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    const id = req.user?.id;
    if (!id) throw new UnauthorizedException({ code: "UNAUTHENTICATED", message: "로그인이 필요합니다." });
    return id;
  }
);

// Routes per ARCHITECTURE.md §7.3. quote is a public price preview; the
// write/read-mine routes below each require a logged-in guest (JwtAuthGuard).
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
  @UseGuards(JwtAuthGuard)
  create(
    @Body(new ZodValidationPipe(createReservationSchema)) dto: CreateReservationDto,
    @CurrentGuest() guestId: string
  ) {
    return this.service.create(dto, guestId);
  }

  // POST /payments/confirm — verify + confirm
  @Post("payments/confirm")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  confirm(
    @Body(new ZodValidationPipe(confirmPaymentSchema)) dto: ConfirmPaymentDto,
    @CurrentGuest() guestId: string
  ) {
    return this.service.confirmPayment(dto, guestId);
  }

  // GET /reservations — the logged-in guest's own reservations (my trips).
  // Declared before the :id route so "reservations" isn't captured as an id.
  @Get("reservations")
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentGuest() guestId: string) {
    return this.service.listMine(guestId);
  }

  // GET /reservations/host — every reservation across the listings I host.
  // Declared before the :id route so "host" isn't captured as an id.
  @Get("reservations/host")
  @UseGuards(JwtAuthGuard)
  listForHost(@CurrentGuest() hostId: string) {
    return this.service.listForHost(hostId);
  }

  // PATCH /reservations/:id/host-status — host approves/rejects/completes a
  // reservation on their own listing. Body: { status }.
  @Patch("reservations/:id/host-status")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  hostStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(hostStatusSchema)) dto: HostStatusDto,
    @CurrentGuest() hostId: string
  ) {
    return this.service.updateStatusAsHost(id, hostId, dto.status);
  }

  @Get("reservations/:id")
  get(@Param("id") id: string) {
    return this.service.getById(id);
  }

  // PATCH /reservations/:id/cancel — guest cancels their reservation (CRUD: update/delete)
  @Patch("reservations/:id/cancel")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  cancel(@Param("id") id: string, @CurrentGuest() guestId: string) {
    return this.service.cancel(id, guestId);
  }
}
