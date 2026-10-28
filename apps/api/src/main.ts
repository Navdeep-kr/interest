import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global API Version Prefix
  app.setGlobalPrefix('api/v1');

  // Strict Request Validation & Sanitization
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS Policy (Permits Mobile Client & Web Dashboards)
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = isProduction
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://interest.app', 'https://admin.interest.app'])
    : '*';

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`=======================================================`);
  logger.log(` Interest Backend API running on: http://localhost:${port}/api/v1`);
  logger.log(` Zero-Location Policy: ACTIVE`);
  logger.log(` Vector Engine: pgvector (512-dim HNSW Cosine Similarity)`);
  logger.log(`=======================================================`);
}

bootstrap();
