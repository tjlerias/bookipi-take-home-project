export interface SaleConfig {
  id: string;
  startsAt: Date;
  endsAt: Date;
  stock: number;
}

export interface AppConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  rateLimitEnabled: boolean;
  sale: SaleConfig;
}
