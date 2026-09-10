// The {braces} hash-tag keeps both keys on one slot so the scripts work under Redis Cluster.
export function ticketsKey(saleId: string): string {
  return `sale:{${saleId}}:tickets`;
}

export function holdersKey(saleId: string): string {
  return `sale:{${saleId}}:holders`;
}
