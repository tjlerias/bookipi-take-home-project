// The {braces} hash-tag keeps every key of a sale on one slot so the scripts work under Redis Cluster.
function itemPrefix(saleId: string, productId: string): string {
  return `sale:{${saleId}}:item:${productId}`;
}

export function availableKey(saleId: string, productId: string): string {
  return `${itemPrefix(saleId, productId)}:available`;
}

export function leasesKey(saleId: string, productId: string): string {
  return `${itemPrefix(saleId, productId)}:leases`;
}

export function unitsKey(saleId: string, productId: string): string {
  return `${itemPrefix(saleId, productId)}:units`;
}
