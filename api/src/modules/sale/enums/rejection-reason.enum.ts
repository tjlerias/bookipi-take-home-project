export enum RejectionReason {
  LimitReached = 'limit_reached',
  SoldOut = 'sold_out',
  Upcoming = 'upcoming',
  Ended = 'ended',
}

export type StockRejection =
  RejectionReason.LimitReached | RejectionReason.SoldOut;
