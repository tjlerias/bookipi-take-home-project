import { Provider } from '@nestjs/common';
import { Clock } from './interfaces/clock.interface';

export const clockProvider: Provider = {
  provide: Clock,
  useValue: { now: () => new Date() } satisfies Clock,
};
