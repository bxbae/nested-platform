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
  companionResponseSchema,
  companionPaymentSchema,
  contractChangeQuoteSchema,
  earlyCheckoutRequestSchema,
  contractChangeDecisionSchema,
  extensionRequestSchema,
  contractChangePaymentSchema,
  checkoutCompletionSchema,
  type QuoteDto,
  type CreateReservationDto,
  type CompanionResponseDto,
  type CompanionPaymentDto,
  type ConfirmPaymentDto,
  type HostStatusDto,
  type ContractChangeQuoteDto,
  type EarlyCheckoutRequestDto,
  type ContractChangeDecisionDto,
  type ExtensionRequestDto,
  type ContractChangePaymentDto,
  type CheckoutCompletionDto,
} from "./dto/reservation.dto";

export const CurrentGuest = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    const id = req.user?.id;
    if (!id) {
      throw new UnauthorizedException({
        code: "UNAUTHENTICATED",
        message: "로그인이 필요합니다.",
      });
    }
    return id;
  },
);

@Controller()
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  @Post("reservations/quote")
  @HttpCode(200)
  quote(@Body(new ZodValidationPipe(quoteSchema)) dto: QuoteDto) {
    return this.service.quote(dto);
  }

  @Post("reservations")
  @UseGuards(JwtAuthGuard)
  create(
    @Body(new ZodValidationPipe(createReservationSchema))
    dto: CreateReservationDto,
    @CurrentGuest() guestId: string,
  ) {
    return this.service.create(dto, guestId);
  }

  @Post("payments/confirm")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  confirm(
    @Body(new ZodValidationPipe(confirmPaymentSchema)) dto: ConfirmPaymentDto,
    @CurrentGuest() guestId: string,
  ) {
    return this.service.confirmPayment(dto, guestId);
  }

  @Get("reservations")
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentGuest() guestId: string) {
    return this.service.listMine(guestId);
  }

  @Get("reservations/host")
  @UseGuards(JwtAuthGuard)
  listForHost(@CurrentGuest() hostId: string) {
    return this.service.listForHost(hostId);
  }

  @Get("reservations/invites")
  @UseGuards(JwtAuthGuard)
  invites(@CurrentGuest() userId: string) {
    return this.service.listCompanionInvites(userId);
  }

  @Post("reservations/:id/contract-change/quote")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  quoteContractChange(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(contractChangeQuoteSchema))
    dto: ContractChangeQuoteDto,
    @CurrentGuest() guestId: string,
  ) {
    return this.service.quoteContractChange(id, guestId, dto);
  }

  @Patch("reservations/:id/contract-change/cancel")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  cancelContractChange(
    @Param("id") id: string,
    @CurrentGuest() guestId: string,
  ) {
    return this.service.cancelContractChange(id, guestId);
  }

  @Post("reservations/:id/extension/payment")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  payExtension(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(contractChangePaymentSchema))
    dto: ContractChangePaymentDto,
    @CurrentGuest() guestId: string,
  ) {
    return this.service.confirmExtensionPayment(id, guestId, dto);
  }

  @Patch("reservations/:id/checkout-complete")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  completeCheckout(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(checkoutCompletionSchema))
    dto: CheckoutCompletionDto,
    @CurrentGuest() hostId: string,
  ) {
    return this.service.completeEarlyCheckout(
      id,
      hostId,
      dto.depositDeduction,
    );
  }

  @Patch("reservations/:id/host-status")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  hostStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(hostStatusSchema)) dto: HostStatusDto,
    @CurrentGuest() hostId: string,
  ) {
    return this.service.updateStatusAsHost(id, hostId, dto.status);
  }

  @Patch("reservations/:id/companion")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  respondCompanion(
    @Param("id") id: string,
    @CurrentGuest() userId: string,
    @Body(new ZodValidationPipe(companionResponseSchema))
    dto: CompanionResponseDto,
  ) {
    return this.service.respondToCompanionInvite(id, userId, dto.decision);
  }

  @Post("reservations/:id/companion/payment")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  payCompanion(
    @Param("id") id: string,
    @CurrentGuest() userId: string,
    @Body(new ZodValidationPipe(companionPaymentSchema))
    dto: CompanionPaymentDto,
  ) {
    return this.service.confirmCompanionPayment(id, userId, dto);
  }

  @Patch("reservations/:id/cancel")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  cancel(@Param("id") id: string, @CurrentGuest() guestId: string) {
    return this.service.cancel(id, guestId);
  }

  @Patch("reservations/:id/early-checkout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  requestEarlyCheckout(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(earlyCheckoutRequestSchema))
    dto: EarlyCheckoutRequestDto,
    @CurrentGuest() guestId: string,
  ) {
    return this.service.requestEarlyCheckout(
      id,
      guestId,
      dto.requestedCheckOut,
    );
  }

  @Patch("reservations/:id/early-checkout/decision")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  decideEarlyCheckout(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(contractChangeDecisionSchema))
    dto: ContractChangeDecisionDto,
    @CurrentGuest() hostId: string,
  ) {
    return this.service.decideEarlyCheckout(
      id,
      hostId,
      dto.decision,
      dto.reason,
    );
  }

  @Patch("reservations/:id/extension")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  requestExtension(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(extensionRequestSchema))
    dto: ExtensionRequestDto,
    @CurrentGuest() guestId: string,
  ) {
    return this.service.requestExtension(
      id,
      guestId,
      dto.requestedCheckOut ?? dto.months,
    );
  }

  @Patch("reservations/:id/extension/decision")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  decideExtension(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(contractChangeDecisionSchema))
    dto: ContractChangeDecisionDto,
    @CurrentGuest() hostId: string,
  ) {
    return this.service.decideExtension(
      id,
      hostId,
      dto.decision,
      dto.reason,
    );
  }

  @Get("reservations/:id")
  get(@Param("id") id: string) {
    return this.service.getById(id);
  }
}
