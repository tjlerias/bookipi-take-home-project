export class UserPurchaseOrderDto {
  orderId: number;
  priceCents: number;
  purchasedAt: string;
}

export class UserPurchasesDto {
  purchased: boolean;
  maxPerUser: number;
  orders: UserPurchaseOrderDto[];
}
