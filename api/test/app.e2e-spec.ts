import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('API (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('GET /api/v1/sale/status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/sale/status' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(['upcoming', 'active', 'sold_out', 'ended']).toContain(body.status);
    expect(typeof body.remaining).toBe('number');
    expect(new Date(body.serverTime).toISOString()).toBe(body.serverTime);
  });
});
