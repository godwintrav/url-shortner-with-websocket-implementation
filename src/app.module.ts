import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StorageModule } from './storage/storage.module';
import { ShortenerModule } from './shortener/shortener.module';

@Module({
  imports: [StorageModule, ShortenerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
