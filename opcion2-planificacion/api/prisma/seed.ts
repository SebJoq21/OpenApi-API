import {
  EstadoOrden,
  OrigenOrden,
  Prisma,
  PrismaClient,
  TipoCupon,
} from '@prisma/client';

const prisma = new PrismaClient();

const EMPRESA_A = '11111111-1111-4111-8111-111111111111';
const EMPRESA_B = '22222222-2222-4222-8222-222222222222';

const SUCURSAL_A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const SUCURSAL_A2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const SUCURSAL_B1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const SUCURSAL_B2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';

const MESA_A1 = 'a1111111-1111-4111-8111-111111111111';
const MESA_A2 = 'a2222222-2222-4222-8222-222222222222';
const MESA_B1 = 'b1111111-1111-4111-8111-111111111111';

const MESERO_A1 = 'a3333333-3333-4333-8333-333333333333';
const MESERO_B1 = 'b3333333-3333-4333-8333-333333333333';

const CLIENTE_A1 = 'a4444444-4444-4444-8444-444444444444';
const CLIENTE_B1 = 'b4444444-4444-4444-8444-444444444444';

const CUPON_A10 = 'a5555555-5555-4555-8555-555555555555';
const CUPON_A15 = 'a6666666-6666-4666-8666-666666666666';
const CUPON_A_VENCIDO = 'a8888888-8888-4888-8888-888888888888';

const LISTA_A1 = 'a7777777-7777-4777-8777-777777777777';
const LISTA_B1 = 'b7777777-7777-4777-8777-777777777777';

function businessYear(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Lima',
      year: 'numeric',
    }).format(new Date()),
  );
}

function calcularMontos(subtotal: number, descuento: number) {
  const subtotalDecimal = new Prisma.Decimal(subtotal).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );
  const descuentoDecimal = new Prisma.Decimal(descuento).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );
  const base = subtotalDecimal.minus(descuentoDecimal);
  const igv = base
    .mul(new Prisma.Decimal('0.18'))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const total = base
    .plus(igv)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return { subtotalDecimal, descuentoDecimal, igv, total };
}

async function main(): Promise<void> {
  const year = businessYear();

  await prisma.empresa.upsert({
    where: { id: EMPRESA_A },
    update: {},
    create: { id: EMPRESA_A, nombre: 'Fogonería A' },
  });
  await prisma.empresa.upsert({
    where: { id: EMPRESA_B },
    update: {},
    create: { id: EMPRESA_B, nombre: 'Fogonería B' },
  });

  const sucursales = [
    { id: SUCURSAL_A1, empresaId: EMPRESA_A, nombre: 'Sede A1 — Centro', slaMinutos: 20 },
    { id: SUCURSAL_A2, empresaId: EMPRESA_A, nombre: 'Sede A2 — Norte', slaMinutos: 30 },
    { id: SUCURSAL_B1, empresaId: EMPRESA_B, nombre: 'Sede B1 — Centro', slaMinutos: 20 },
    { id: SUCURSAL_B2, empresaId: EMPRESA_B, nombre: 'Sede B2 — Sur', slaMinutos: 25 },
  ];
  for (const sucursal of sucursales) {
    await prisma.sucursal.upsert({
      where: { id: sucursal.id },
      update: { nombre: sucursal.nombre, slaMinutos: sucursal.slaMinutos },
      create: sucursal,
    });
  }

  const mesas = [
    { id: MESA_A1, sucursalId: SUCURSAL_A1, codigo: 'A1-01' },
    { id: MESA_A2, sucursalId: SUCURSAL_A1, codigo: 'A1-02' },
    { id: MESA_B1, sucursalId: SUCURSAL_B1, codigo: 'B1-01' },
  ];
  for (const mesa of mesas) {
    await prisma.mesa.upsert({
      where: { id: mesa.id },
      update: { codigo: mesa.codigo },
      create: mesa,
    });
  }

  const meseros = [
    { id: MESERO_A1, empresaId: EMPRESA_A, nombre: 'Mesero Demo A' },
    { id: MESERO_B1, empresaId: EMPRESA_B, nombre: 'Mesero Demo B' },
  ];
  for (const mesero of meseros) {
    await prisma.usuario.upsert({
      where: { id: mesero.id },
      update: { nombre: mesero.nombre },
      create: mesero,
    });
  }

  const clientes = [
    { id: CLIENTE_A1, empresaId: EMPRESA_A, nombre: 'Cliente Demo A' },
    { id: CLIENTE_B1, empresaId: EMPRESA_B, nombre: 'Cliente Demo B' },
  ];
  for (const cliente of clientes) {
    await prisma.cliente.upsert({
      where: { id: cliente.id },
      update: { nombre: cliente.nombre },
      create: cliente,
    });
  }

  const ahora = new Date();
  const haceUnAnio = new Date(ahora.getTime() - 365 * 24 * 60 * 60 * 1000);

  const cupones = [
    {
      id: CUPON_A10,
      empresaId: EMPRESA_A,
      codigo: 'BIENVENIDO10',
      tipo: TipoCupon.PORCENTAJE,
      valor: new Prisma.Decimal('10.00'),
      vigenteDesde: haceUnAnio,
      vigenteHasta: new Date(ahora.getTime() + 365 * 24 * 60 * 60 * 1000),
      activo: true,
    },
    {
      id: CUPON_A15,
      empresaId: EMPRESA_A,
      codigo: 'FIJO15',
      tipo: TipoCupon.MONTO_FIJO,
      valor: new Prisma.Decimal('15.00'),
      vigenteDesde: haceUnAnio,
      vigenteHasta: new Date(ahora.getTime() + 365 * 24 * 60 * 60 * 1000),
      activo: true,
    },
    {
      id: CUPON_A_VENCIDO,
      empresaId: EMPRESA_A,
      codigo: 'VENCIDO',
      tipo: TipoCupon.PORCENTAJE,
      valor: new Prisma.Decimal('50.00'),
      vigenteDesde: new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000),
      vigenteHasta: new Date(ahora.getTime() - 24 * 60 * 60 * 1000),
      activo: true,
    },
  ];
  for (const cupon of cupones) {
    await prisma.cupon.upsert({
      where: { id: cupon.id },
      update: {
        codigo: cupon.codigo,
        tipo: cupon.tipo,
        valor: cupon.valor,
        vigenteDesde: cupon.vigenteDesde,
        vigenteHasta: cupon.vigenteHasta,
        activo: cupon.activo,
      },
      create: cupon,
    });
  }

  const listas = [
    { id: LISTA_A1, empresaId: EMPRESA_A, nombre: 'Lista A1' },
    { id: LISTA_B1, empresaId: EMPRESA_B, nombre: 'Lista B1' },
  ];
  for (const lista of listas) {
    await prisma.listaPrecio.upsert({
      where: { id: lista.id },
      update: { nombre: lista.nombre },
      create: lista,
    });
  }

  const ordenes = [
    {
      id: 'a0000000-0000-4000-8000-000000000101',
      empresaId: EMPRESA_A,
      sucursalId: SUCURSAL_A1,
      numeroOrden: `ORD-${year}-101`,
      origen: OrigenOrden.SALON,
      estado: EstadoOrden.PENDIENTE,
      subtotal: 100,
      descuento: 0,
      mesaId: MESA_A1,
      meseroId: MESERO_A1,
      clienteId: null as string | null,
      cuponId: null as string | null,
      listaPrecioId: LISTA_A1 as string | null,
      minutesAgo: 60,
    },
    {
      id: 'a0000000-0000-4000-8000-000000000102',
      empresaId: EMPRESA_A,
      sucursalId: SUCURSAL_A1,
      numeroOrden: `ORD-${year}-102`,
      origen: OrigenOrden.SALON,
      estado: EstadoOrden.CONFIRMADO,
      subtotal: 85.5,
      descuento: 8.55,
      mesaId: MESA_A2,
      meseroId: MESERO_A1,
      clienteId: CLIENTE_A1,
      cuponId: CUPON_A10,
      listaPrecioId: null as string | null,
      minutesAgo: 5,
    },
    {
      id: 'a0000000-0000-4000-8000-000000000103',
      empresaId: EMPRESA_A,
      sucursalId: SUCURSAL_A1,
      numeroOrden: `ORD-${year}-103`,
      origen: OrigenOrden.DELIVERY,
      estado: EstadoOrden.PREPARANDO,
      subtotal: 50,
      descuento: 0,
      mesaId: null as string | null,
      meseroId: null as string | null,
      clienteId: CLIENTE_A1,
      cuponId: null as string | null,
      listaPrecioId: null as string | null,
      minutesAgo: 25,
    },
    {
      id: 'a0000000-0000-4000-8000-000000000104',
      empresaId: EMPRESA_A,
      sucursalId: SUCURSAL_A1,
      numeroOrden: `ORD-${year}-104`,
      origen: OrigenOrden.LLEVAR,
      estado: EstadoOrden.LISTO,
      subtotal: 70,
      descuento: 15,
      mesaId: null as string | null,
      meseroId: null as string | null,
      clienteId: null as string | null,
      cuponId: CUPON_A15,
      listaPrecioId: null as string | null,
      minutesAgo: 10,
    },
    {
      id: 'a0000000-0000-4000-8000-000000000105',
      empresaId: EMPRESA_A,
      sucursalId: SUCURSAL_A1,
      numeroOrden: `ORD-${year}-105`,
      origen: OrigenOrden.DELIVERY,
      estado: EstadoOrden.ENTREGADO,
      subtotal: 40,
      descuento: 0,
      mesaId: null as string | null,
      meseroId: null as string | null,
      clienteId: CLIENTE_A1,
      cuponId: null as string | null,
      listaPrecioId: null as string | null,
      minutesAgo: 60,
    },
    {
      id: 'a0000000-0000-4000-8000-000000000106',
      empresaId: EMPRESA_A,
      sucursalId: SUCURSAL_A1,
      numeroOrden: `ORD-${year}-106`,
      origen: OrigenOrden.SALON,
      estado: EstadoOrden.ANULADO,
      subtotal: 30,
      descuento: 0,
      mesaId: MESA_A1,
      meseroId: MESERO_A1,
      clienteId: null as string | null,
      cuponId: null as string | null,
      listaPrecioId: null as string | null,
      minutesAgo: 30,
    },
    {
      id: 'b0000000-0000-4000-8000-000000000101',
      empresaId: EMPRESA_B,
      sucursalId: SUCURSAL_B1,
      numeroOrden: `ORD-${year}-101`,
      origen: OrigenOrden.SALON,
      estado: EstadoOrden.PENDIENTE,
      subtotal: 20,
      descuento: 0,
      mesaId: MESA_B1,
      meseroId: MESERO_B1,
      clienteId: null as string | null,
      cuponId: null as string | null,
      listaPrecioId: null as string | null,
      minutesAgo: 60,
    },
  ];

  const slaPorSucursal = new Map(
    sucursales.map((sucursal) => [sucursal.id, sucursal.slaMinutos]),
  );

  for (const item of ordenes) {
    const montos = calcularMontos(item.subtotal, item.descuento);
    const ingresoAt = new Date(ahora.getTime() - item.minutesAgo * 60_000);
    const confirmacionAt =
      item.estado === EstadoOrden.PENDIENTE
        ? null
        : new Date(ingresoAt.getTime() + 5 * 60_000);
    const listoAt =
      item.estado === EstadoOrden.LISTO || item.estado === EstadoOrden.ENTREGADO
        ? new Date(ingresoAt.getTime() + 15 * 60_000)
        : null;
    const entregaAt =
      item.estado === EstadoOrden.ENTREGADO
        ? new Date(ingresoAt.getTime() + 20 * 60_000)
        : null;

    const data = {
      empresaId: item.empresaId,
      sucursalId: item.sucursalId,
      numeroOrden: item.numeroOrden,
      mesaId: item.mesaId,
      clienteId: item.clienteId,
      meseroId: item.meseroId,
      origen: item.origen,
      estado: item.estado,
      subtotal: montos.subtotalDecimal,
      descuentoCupon: montos.descuentoDecimal,
      igv: montos.igv,
      total: montos.total,
      listaPrecioId: item.listaPrecioId,
      cuponId: item.cuponId,
      ingresoAt,
      confirmacionAt,
      listoAt,
      entregaAt,
      slaMinutos: slaPorSucursal.get(item.sucursalId) ?? 20,
      createdAt: ingresoAt,
    };

    await prisma.orden.upsert({
      where: { id: item.id },
      update: data,
      create: { id: item.id, ...data },
    });
  }

  const secuencias = [
    { sucursalId: SUCURSAL_A1, ultimo: 106 },
    { sucursalId: SUCURSAL_A2, ultimo: 0 },
    { sucursalId: SUCURSAL_B1, ultimo: 101 },
    { sucursalId: SUCURSAL_B2, ultimo: 0 },
  ];
  for (const secuencia of secuencias) {
    await prisma.ordenSecuencia.upsert({
      where: {
        sucursalId_anio: { sucursalId: secuencia.sucursalId, anio: year },
      },
      update: {},
      create: {
        sucursalId: secuencia.sucursalId,
        anio: year,
        ultimo: secuencia.ultimo,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed completado.');
  // eslint-disable-next-line no-console
  console.log(`Empresa A: ${EMPRESA_A}`);
  // eslint-disable-next-line no-console
  console.log(`Empresa B: ${EMPRESA_B}`);
  // eslint-disable-next-line no-console
  console.log(`Sucursal A1: ${SUCURSAL_A1}`);
  // eslint-disable-next-line no-console
  console.log(`Mesa A1: ${MESA_A1}`);
  // eslint-disable-next-line no-console
  console.log(`Mesero A1: ${MESERO_A1}`);
  // eslint-disable-next-line no-console
  console.log(`Cliente A1: ${CLIENTE_A1}`);
  // eslint-disable-next-line no-console
  console.log(`Cupón 10%: ${CUPON_A10}`);
  // eslint-disable-next-line no-console
  console.log(`Cupón fijo 15: ${CUPON_A15}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
