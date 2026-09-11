// The {braces} hash-tag keeps every key of a sale on one slot so the scripts work under Redis Cluster.
function itemPrefix(saleId: string, productId: string): string {
  return `sale:{${saleId}}:item:${productId}`;
}

export function ticketsKey(saleId: string, productId: string): string {
  return `${itemPrefix(saleId, productId)}:tickets`;
}

export function unitsKey(saleId: string, productId: string): string {
  return `${itemPrefix(saleId, productId)}:units`;
}

export function holdersKey(saleId: string, productId: string): string {
  return `${itemPrefix(saleId, productId)}:holders`;
}
