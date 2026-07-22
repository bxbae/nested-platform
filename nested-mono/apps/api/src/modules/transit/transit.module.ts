import { Module } from '@nestjs/common';
import { TransitService } from './transit.service';
import { TransitController } from './transit.controller';

@Module({
  providers: [TransitService],
  controllers: [TransitController]
})
export class TransitModule {}
