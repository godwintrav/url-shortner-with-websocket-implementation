import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, //This will remove properties not in the DTO sent in the request
      forbidNonWhitelisted: true, //This will cause an error to be thrown if properties not set in the DTO is sent in the request
      transform: true, //This will transform every payload to a DTO
    })
  )
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
