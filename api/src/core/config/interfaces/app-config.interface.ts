export interface SaleWindow {
  startsAt: Date;
  endsAt: Date;
}

export interface AppConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  rateLimitEnabled: boolean;
}
