import './mikrotik-patch';
import { setDefaultResultOrder } from 'dns';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

// PENTING — mencegah backend mati total kalau library pihak ketiga
// (mis. node-routeros) melempar error di luar jalur try/catch normal kita.
process.on('uncaughtException', (err) => {
  console.error('⚠️  Uncaught Exception (backend tetap berjalan):', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled Rejection (backend tetap berjalan):', reason);
});

setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());

  app.enableCors({
    origin: config.get<string>('FRONTEND_URL'),
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<number>('APP_PORT') ?? 3001;
  await app.listen(port);

  console.log(`🚀 Backend running → http://localhost:${port}/api/v1`);
}

bootstrap();