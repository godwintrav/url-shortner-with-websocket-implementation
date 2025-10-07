import { Module } from '@nestjs/common';
import { ShortenerController } from './shortener.controller';
import { ShortenerService } from './shortener.service';
import { ShortenerGateway } from './ws.gateway';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [ShortenerController],
  providers: [ShortenerService, ShortenerGateway],
  exports: [ShortenerService],
})
export class ShortenerModule {}
