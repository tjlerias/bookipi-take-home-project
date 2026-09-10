import { Module } from '@nestjs/common';
import { clockProvider } from './clock.provider';
import { Clock } from './interfaces/clock.interface';

@Module({
  providers: [clockProvider],
  exports: [Clock],
})
export class ClockModule {}
