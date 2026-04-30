import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configuredOrigins = process.env.CORS_ORIGIN?.trim();
  const corsOrigin =
    !configuredOrigins || configuredOrigins === '*'
      ? true
      : configuredOrigins.split(',').map((origin) => origin.trim());

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(Number(process.env.PORT ?? 4001));
}
bootstrap();
