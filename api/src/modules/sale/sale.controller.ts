import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { UserPurchasesDto } from './dto/user-purchases.dto';
import { PurchaseRequestDto } from './dto/purchase-request.dto';
import { PurchaseResultDto } from './dto/purchase-result.dto';
import { SaleDto } from './dto/sale.dto';
import { RejectionReason } from './enums/rejection-reason.enum';
import { ResultStatus } from './enums/result-status.enum';
import { SaleService } from './sale.service';
import { normalizeUserId } from './utils/user-id.util';

@Controller('sale')
export class SaleController {
  constructor(private readonly saleService: SaleService) {}

  @Get()
  getSale(): Promise<SaleDto> {
    return this.saleService.getSale();
  }

  @Post('purchase')
  @HttpCode(HttpStatus.OK)
  async purchase(@Body() body: PurchaseRequestDto): Promise<PurchaseResultDto> {
    const purchase = await this.saleService.purchase(body.userId);
    if (purchase.status === ResultStatus.Success) {
      return { result: ResultStatus.Success, orderId: purchase.orderId };
    }

    const response = { result: ResultStatus.Rejected, reason: purchase.reason };
    switch (purchase.reason) {
      case RejectionReason.LimitReached:
      case RejectionReason.SoldOut:
        throw new ConflictException(response);
      case RejectionReason.Upcoming:
      case RejectionReason.Ended:
        throw new ForbiddenException(response);
    }
  }

  @Get('purchase/:userId')
  getUserPurchases(@Param('userId') userId: string): Promise<UserPurchasesDto> {
    return this.saleService.getUserPurchases(normalizeUserId(userId));
  }
}
