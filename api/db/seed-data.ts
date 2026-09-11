export const PRODUCT = {
  id: 'limited-sneaker',
  name: 'Limited Edition Sneaker',
  priceCents: 19900,
};

export const SALE = {
  id: 'flash-sale-1',
  name: 'Flash Sale',
};

export const SALE_ITEM = {
  saleId: SALE.id,
  productId: PRODUCT.id,
  salePriceCents: 9999,
  stock: 100,
  maxPerUser: 1,
};
