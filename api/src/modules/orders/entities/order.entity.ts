export interface Order {
  id: number;
  saleId: string;
  productId: string;
  userId: string;
  priceCents: number;
  createdAt: Date;
}
