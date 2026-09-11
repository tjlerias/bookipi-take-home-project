export class UserPurchaseOrderDto {
  orderId: number;
  priceCents: number;
  purchasedAt: string;
}

export class UserPurchasesDto {
  purchased: boolean;
  unitsUsed: number;
  maxPerUser: number;
  orders: UserPurchaseOrderDto[];
}
