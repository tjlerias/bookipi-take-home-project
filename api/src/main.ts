import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  configureApp(app);

  const port = Number(process.env.PORT ?? 3000);
  // Fastify binds to localhost by default, which is unreachable from inside a container.
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
