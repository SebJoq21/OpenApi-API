import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, TipoCupon } from '@prisma/client';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import path from 'path';
import jestOpenAPI from 'jest-openapi';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';

jestOpenAPI(path.resolve(__dirname, '../../../../openapi.yaml'));

describe('Contrato OpenAPI', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  const empresa = randomUUID();
  const sucursal = randomUUID();
  const mesa = randomUUID();
  const mesero = randomUUID();
  const cliente = randomUUID();
  const cupon = randomUUID();

  let ordenId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.ordenSecuencia.deleteMany();
    await prisma.orden.deleteMany();
    await prisma.cupon.deleteMany();
    await prisma.listaPrecio.deleteMany();
    await prisma.cliente.deleteMany();
    await prisma.usuario.deleteMany();
    await prisma.mesa.deleteMany();
    await prisma.sucursal.deleteMany();
    await prisma.empresa.deleteMany();

    await prisma.empresa.create({ data: { id: empresa, nombre: 'Contrato' } });
    await prisma.sucursal.create({
      data: { id: sucursal, empresaId: empresa, nombre: 'Sucursal', slaMinutos: 20 },
    });
    await prisma.mesa.create({
      data: { id: mesa, sucursalId: sucursal, codigo: 'C-01' },
    });
    await prisma.usuario.create({
      data: { id: mesero, empresaId: empresa, nombre: 'Mesero' },
    });
    await prisma.cliente.create({
      data: { id: cliente, empresaId: empresa, nombre: 'Cliente' },
    });
    await prisma.cupon.create({
      data: {
        id: cupon,
        empresaId: empresa,
        codigo: 'DIEZ',
        tipo: TipoCupon.PORCENTAJE,
        valor: new Prisma.Decimal(10),
        vigenteDesde: new Date(Date.now() - 86400000),
        vigenteHasta: new Date(Date.now() + 86400000),
        activo: true,
      },
    });

    token = jwt.sign(
      { sub: 'contrato', empresa_id: empresa },
      process.env.JWT_SECRET ?? 'test-secret-change-me',
      { expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /ordenes/salon cumple el contrato (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ordenes/salon')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sucursal_id: sucursal,
        mesa_id: mesa,
        mesero_id: mesero,
        subtotal: 100,
        cupon_id: cupon,
      })
      .expect(201);

    ordenId = res.body.id;
    expect(res).toSatisfyApiSpec();
  });

  it('GET /ordenes cumple el contrato (200)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/ordenes?page=1&limit=20')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res).toSatisfyApiSpec();
  });

  it('GET /ordenes/{id} cumple el contrato (200)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/ordenes/${ordenId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res).toSatisfyApiSpec();
  });

  it('GET /ordenes/alertas cumple el contrato (200)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/ordenes/alertas')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res).toSatisfyApiSpec();
  });

  it('PATCH /ordenes/{id}/estado cumple el contrato (200)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/ordenes/${ordenId}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'CONFIRMADO' })
      .expect(200);

    expect(res).toSatisfyApiSpec();
  });

  it('DELETE /ordenes/{id} cumple el contrato (204)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/ordenes/${ordenId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(res).toSatisfyApiSpec();
  });

  it('401 cumple el contrato problem+json', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/ordenes').expect(401);
    expect(res).toSatisfyApiSpec();
  });

  it('400 cumple el contrato problem+json', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ordenes/delivery')
      .set('Authorization', `Bearer ${token}`)
      .send({ sucursal_id: sucursal, origen: 'DELIVERY', subtotal: 30 })
      .expect(400);
    expect(res).toSatisfyApiSpec();
  });

  it('404 cumple el contrato problem+json', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/ordenes/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(res).toSatisfyApiSpec();
  });

  it('409 cumple el contrato problem+json', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/ordenes/salon')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sucursal_id: sucursal,
        mesa_id: mesa,
        mesero_id: mesero,
        subtotal: 50,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/ordenes/${created.body.id}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'CONFIRMADO' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/ordenes/${created.body.id}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'LISTO' });

    expect(res.status).toBe(409);
    expect(res).toSatisfyApiSpec();
  });
});
