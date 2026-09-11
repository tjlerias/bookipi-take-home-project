export interface SaleItem {
  productId: string;
  name: string;
  priceCents: number;
  salePriceCents: number;
  maxPerUser: number;
}

export interface SaleDetails {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  item: SaleItem;
}
