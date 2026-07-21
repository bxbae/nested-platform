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
  earlyCheckoutSchema,
  extensionRequestSchema,
  extensionDecisionSchema,
  type QuoteDto,
  type CreateReservationDto,
  companionResponseSchema,
  type CompanionResponseDto,
  type ConfirmPaymentDto,
  type HostStatusDto,
  type EarlyCheckoutDto,
  type ExtensionRequestDto,
  type ExtensionDecisionDto,
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

  // GET /reservations/invites — 내가 룸메이트로 초대된 예약들.
  // 반드시 @Get("reservations/:id") 보다 위에 있어야 한다. NestJS 는 선언
  // 순서대로 매칭하므로, 아래에 두면 "invites" 가 :id 로 잡혀 버린다.
  @Get("reservations/invites")
  @UseGuards(JwtAuthGuard)
  invites(@CurrentGuest() userId: string) {
    return this.service.listCompanionInvites(userId);
  }

  @Get("reservations/:id")
  get(@Param("id") id: string) {
    return this.service.getById(id);
  }

  // PATCH /reservations/:id/cancel — guest cancels their reservation (CRUD: update/delete)
  // PATCH /reservations/:id/companion — 초대 수락/거절
  @Patch("reservations/:id/companion")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  respondCompanion(
    @Param("id") id: string,
    @CurrentGuest() userId: string,
    @Body(new ZodValidationPipe(companionResponseSchema)) dto: CompanionResponseDto,
  ) {
    return this.service.respondToCompanionInvite(id, userId, dto.decision);
  }

  @Patch("reservations/:id/cancel")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  cancel(@Param("id") id: string, @CurrentGuest() guestId: string) {
    return this.service.cancel(id, guestId);
  }

  // PATCH /reservations/:id/early-checkout — guest requests an early checkout.
  @Patch("reservations/:id/early-checkout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  requestEarlyCheckout(@Param("id") id: string, @CurrentGuest() guestId: string) {
    return this.service.requestEarlyCheckout(id, guestId);
  }

  // PATCH /reservations/:id/early-checkout/decision — host approves/rejects.
  // Body: { decision: "approve" | "reject" }.
  @Patch("reservations/:id/early-checkout/decision")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  decideEarlyCheckout(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(earlyCheckoutSchema)) dto: EarlyCheckoutDto,
    @CurrentGuest() hostId: string
  ) {
    return this.service.decideEarlyCheckout(id, hostId, dto.decision);
  }

  // PATCH /reservations/:id/extension — guest requests a contract extension.
  @Patch("reservations/:id/extension")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  requestExtension(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(extensionRequestSchema)) dto: ExtensionRequestDto,
    @CurrentGuest() guestId: string
  ) {
    return this.service.requestExtension(id, guestId, dto.months);
  }

  // PATCH /reservations/:id/extension/decision — host approves/rejects.
  @Patch("reservations/:id/extension/decision")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  decideExtension(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(extensionDecisionSchema)) dto: ExtensionDecisionDto,
    @CurrentGuest() hostId: string
  ) {
    return this.service.decideExtension(id, hostId, dto.decision);
  }
}
