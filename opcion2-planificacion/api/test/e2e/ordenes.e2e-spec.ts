import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EstadoOrden, OrigenOrden, Prisma, TipoCupon } from '@prisma/client';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('API de órdenes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;

  const empresaA = randomUUID();
  const empresaB = randomUUID();
  const sucursalA = randomUUID();
  const sucursalB = randomUUID();
  const mesaA = randomUUID();
  const meseroA = randomUUID();
  const clienteA = randomUUID();
  const cupon10 = randomUUID();
  const cuponVencido = randomUUID();
  const listaA = randomUUID();
  const year = new Date().getUTCFullYear();

  let ordenSalonId: string;
  let ordenDeliveryId: string;
  let ordenAlertaId: string;
  let ordenEntregadaId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

    await prisma.empresa.createMany({
      data: [
        { id: empresaA, nombre: 'Empresa A' },
        { id: empresaB, nombre: 'Empresa B' },
      ],
    });
    await prisma.sucursal.createMany({
      data: [
        { id: sucursalA, empresaId: empresaA, nombre: 'Sucursal A', slaMinutos: 20 },
        { id: sucursalB, empresaId: empresaB, nombre: 'Sucursal B', slaMinutos: 20 },
      ],
    });
    await prisma.mesa.create({
      data: { id: mesaA, sucursalId: sucursalA, codigo: 'A-01' },
    });
    await prisma.usuario.create({
      data: { id: meseroA, empresaId: empresaA, nombre: 'Mesero A' },
    });
    await prisma.cliente.create({
      data: { id: clienteA, empresaId: empresaA, nombre: 'Cliente A' },
    });
    await prisma.listaPrecio.create({
      data: { id: listaA, empresaId: empresaA, nombre: 'Lista A' },
    });
    await prisma.cupon.createMany({
      data: [
        {
          id: cupon10,
          empresaId: empresaA,
          codigo: 'DIEZ',
          tipo: TipoCupon.PORCENTAJE,
          valor: new Prisma.Decimal(10),
          vigenteDesde: new Date(Date.now() - 86400000),
          vigenteHasta: new Date(Date.now() + 86400000),
          activo: true,
        },
        {
          id: cuponVencido,
          empresaId: empresaA,
          codigo: 'VENCIDO',
          tipo: TipoCupon.PORCENTAJE,
          valor: new Prisma.Decimal(50),
          vigenteDesde: new Date(Date.now() - 172800000),
          vigenteHasta: new Date(Date.now() - 86400000),
          activo: true,
        },
      ],
    });

    const secret = process.env.JWT_SECRET ?? 'test-secret-change-me';
    tokenA = jwt.sign({ sub: 'e2e-a', empresa_id: empresaA }, secret, { expiresIn: '1h' });
    tokenB = jwt.sign({ sub: 'e2e-b', empresa_id: empresaB }, secret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await app.close();
  });

  function expectProblem(res: request.Response, status: number): void {
    expect(res.status).toBe(status);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      type: 'about:blank',
      status,
    });
    expect(typeof res.body.title).toBe('string');
    expect(typeof res.body.detail).toBe('string');
    expect(res.body).not.toHaveProperty('statusCode');
    expect(res.body).not.toHaveProperty('message');
    expect(res.body).not.toHaveProperty('error');
  }

  it('health es público', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('rechaza una petición sin token con 401 problem+json', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/ordenes');
    expectProblem(res, 401);
  });

  it('crea una orden de salón con cupón y calcula totales', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ordenes/salon')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sucursal_id: sucursalA,
        mesa_id: mesaA,
        mesero_id: meseroA,
        cliente_id: clienteA,
        subtotal: 100,
        cupon_id: cupon10,
        lista_precio_id: listaA,
      })
      .expect(201);

    ordenSalonId = res.body.id;
    expect(res.headers.location).toBe(`/api/v1/ordenes/${ordenSalonId}`);
    expect(res.body).toMatchObject({
      empresa_id: empresaA,
      sucursal_id: sucursalA,
      mesa_id: mesaA,
      mesero_id: meseroA,
      origen: 'SALON',
      estado: 'PENDIENTE',
      descuento_cupon: 10,
      igv: 16.2,
      total: 106.2,
      alerta_sla: false,
    });
    expect(res.body.numero_orden).toMatch(/^ORD-\d{4}-\d{3,}$/);
    expect(Object.keys(res.body)).toHaveLength(22);
    expect(res.body).not.toHaveProperty('sla_minutos');
  });

  it('rechaza un cupón vencido con 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ordenes/salon')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sucursal_id: sucursalA,
        mesa_id: mesaA,
        mesero_id: meseroA,
        subtotal: 50,
        cupon_id: cuponVencido,
      });

    expectProblem(res, 400);
    expect(res.body.detail).toContain('Cupón');
  });

  it('rechaza DELIVERY sin cliente con 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ordenes/delivery')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sucursal_id: sucursalA,
        origen: 'DELIVERY',
        subtotal: 30,
      });

    expectProblem(res, 400);
  });

  it('crea una orden de delivery con cliente', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ordenes/delivery')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sucursal_id: sucursalA,
        origen: 'DELIVERY',
        cliente_id: clienteA,
        subtotal: 50,
      })
      .expect(201);

    ordenDeliveryId = res.body.id;
    expect(res.body.mesa_id).toBeNull();
    expect(res.body.mesero_id).toBeNull();
    expect(res.body.cliente_id).toBe(clienteA);
    expect(res.body.origen).toBe('DELIVERY');
  });

  it('rechaza un campo calculado enviado por el cliente', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ordenes/salon')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sucursal_id: sucursalA,
        mesa_id: mesaA,
        mesero_id: meseroA,
        subtotal: 100,
        total: 1,
      });

    expectProblem(res, 400);
  });

  it('lista solo las órdenes de la empresa del token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/ordenes?page=1&limit=20')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    for (const orden of res.body.data) {
      expect(orden.empresa_id).toBe(empresaA);
    }
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
    expect(typeof res.body.meta.total).toBe('number');
    expect(typeof res.body.meta.total_pages).toBe('number');
  });

  it('obtiene el detalle y no expone campos internos', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/ordenes/${ordenSalonId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Object.keys(res.body)).toHaveLength(22);
    expect(res.body).not.toHaveProperty('sla_minutos');
  });

  it('devuelve 404 para una orden de otra empresa', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/ordenes/${ordenSalonId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expectProblem(res, 404);
  });

  it('avanza el estado y registra confirmacion_at', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/ordenes/${ordenSalonId}/estado`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ estado: 'CONFIRMADO' })
      .expect(200);

    expect(res.body.estado).toBe('CONFIRMADO');
    expect(res.body.confirmacion_at).toEqual(expect.any(String));
  });

  it('rechaza un salto de estado con 409', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/ordenes/${ordenSalonId}/estado`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ estado: 'LISTO' });

    expectProblem(res, 409);
  });

  it('rechaza ANULADO por PATCH con 400', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/ordenes/${ordenSalonId}/estado`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ estado: 'ANULADO' });

    expectProblem(res, 400);
  });

  it('anula con 204 y rechaza la segunda anulación con 409', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/ordenes/${ordenSalonId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/ordenes/${ordenSalonId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expectProblem(res, 409);
  });

  it('lista alertas SLA solo de órdenes activas vencidas', async () => {
    const old = new Date(Date.now() - 60 * 60 * 1000);
    const base = {
      empresaId: empresaA,
      sucursalId: sucursalA,
      origen: OrigenOrden.SALON,
      subtotal: new Prisma.Decimal(10),
      descuentoCupon: new Prisma.Decimal(0),
      igv: new Prisma.Decimal('1.80'),
      total: new Prisma.Decimal('11.80'),
      mesaId: mesaA,
      meseroId: meseroA,
      slaMinutos: 20,
      ingresoAt: old,
      createdAt: old,
    };

    const alerta = await prisma.orden.create({
      data: {
        ...base,
        numeroOrden: `ORD-${year}-998`,
        estado: EstadoOrden.PENDIENTE,
      },
    });
    ordenAlertaId = alerta.id;

    const entregada = await prisma.orden.create({
      data: {
        ...base,
        numeroOrden: `ORD-${year}-999`,
        estado: EstadoOrden.ENTREGADO,
      },
    });
    ordenEntregadaId = entregada.id;

    const res = await request(app.getHttpServer())
      .get('/api/v1/ordenes/alertas')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const ids = res.body.data.map((orden: { id: string }) => orden.id);
    expect(ids).toContain(ordenAlertaId);
    expect(ids).not.toContain(ordenEntregadaId);
    expect(res.body.data.every((orden: { alerta_sla: boolean }) => orden.alerta_sla)).toBe(true);
  });

  it('filtra por estado y sucursal', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/ordenes?estado=PENDIENTE&sucursal_id=${sucursalA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.data.every((orden: { estado: string }) => orden.estado === 'PENDIENTE')).toBe(true);
    expect(res.body.data.every((orden: { sucursal_id: string }) => orden.sucursal_id === sucursalA)).toBe(true);
  });
});
