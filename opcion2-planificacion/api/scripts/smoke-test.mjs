import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';

const EMPRESA_A = '11111111-1111-4111-8111-111111111111';
const EMPRESA_B = '22222222-2222-4222-8222-222222222222';
const SUCURSAL_A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const MESA_A1 = 'a1111111-1111-4111-8111-111111111111';
const MESERO_A1 = 'a3333333-3333-4333-8333-333333333333';
const CLIENTE_A1 = 'a4444444-4444-4444-8444-444444444444';
const CUPON_A10 = 'a5555555-5555-4555-8555-555555555555';

const tokenA = jwt.sign({ sub: 'demo-a', empresa_id: EMPRESA_A }, SECRET, {
  expiresIn: '1h',
});
const tokenB = jwt.sign({ sub: 'demo-b', empresa_id: EMPRESA_B }, SECRET, {
  expiresIn: '1h',
});

let passed = 0;
let failed = 0;

async function api(method, path, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    location: response.headers.get('location'),
    body: parsed,
    raw: text,
  };
}

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` → ${detail}` : ''}`);
  }
}

function checkProblem(res, status) {
  return (
    res.status === status &&
    res.contentType.startsWith('application/problem+json') &&
    res.body &&
    res.body.type === 'about:blank' &&
    typeof res.body.title === 'string' &&
    res.body.status === status &&
    typeof res.body.detail === 'string' &&
    !('statusCode' in res.body) &&
    !('message' in res.body) &&
    !('error' in res.body)
  );
}

async function main() {
  const health = await api('GET', '/health', null);
  check('health 200', health.status === 200, String(health.status));

  const listA = await api('GET', '/ordenes?page=1&limit=20', tokenA);
  check('GET /ordenes 200', listA.status === 200, String(listA.status));
  check(
    'GET /ordenes solo empresa A',
    Array.isArray(listA.body?.data) &&
      listA.body.data.every((orden) => orden.empresa_id === EMPRESA_A),
  );
  check('GET /ordenes meta', typeof listA.body?.meta?.total === 'number');

  const alerts = await api('GET', '/ordenes/alertas', tokenA);
  check('GET /ordenes/alertas 200', alerts.status === 200, String(alerts.status));
  check(
    'GET /ordenes/alertas solo activas con alerta',
    Array.isArray(alerts.body?.data) &&
      alerts.body.data.every(
        (orden) => orden.alerta_sla === true && orden.estado !== 'ENTREGADO' && orden.estado !== 'ANULADO',
      ),
  );

  const salon = await api('POST', '/ordenes/salon', tokenA, {
    sucursal_id: SUCURSAL_A1,
    mesa_id: MESA_A1,
    mesero_id: MESERO_A1,
    subtotal: 100,
    cupon_id: CUPON_A10,
  });
  check('POST /ordenes/salon 201', salon.status === 201, String(salon.status));
  check('POST salon Location', Boolean(salon.location), String(salon.location));
  check('POST salon estado PENDIENTE', salon.body?.estado === 'PENDIENTE');
  check('POST salon origen SALON', salon.body?.origen === 'SALON');
  check('POST salon empresa A', salon.body?.empresa_id === EMPRESA_A);
  check(
    'POST salon número ORD-AAAA-NNN',
    /^ORD-\d{4}-\d{3,}$/.test(salon.body?.numero_orden ?? ''),
    salon.body?.numero_orden,
  );
  check('POST salon descuento 10%', salon.body?.descuento_cupon === 10);
  check('POST salon IGV 16.20', salon.body?.igv === 16.2);
  check('POST salon total 106.20', salon.body?.total === 106.2);
  check(
    'POST salon 22 campos',
    salon.body && Object.keys(salon.body).length === 22,
    String(Object.keys(salon.body ?? {}).length),
  );

  const deliverySinCliente = await api('POST', '/ordenes/delivery', tokenA, {
    sucursal_id: SUCURSAL_A1,
    origen: 'DELIVERY',
    subtotal: 30,
  });
  check(
    'POST delivery sin cliente 400 problem+json',
    checkProblem(deliverySinCliente, 400),
    JSON.stringify(deliverySinCliente.body),
  );

  const delivery = await api('POST', '/ordenes/delivery', tokenA, {
    sucursal_id: SUCURSAL_A1,
    origen: 'DELIVERY',
    cliente_id: CLIENTE_A1,
    subtotal: 50,
  });
  check('POST delivery 201', delivery.status === 201, String(delivery.status));
  check('POST delivery mesa null', delivery.body?.mesa_id === null);
  check('POST delivery mesero null', delivery.body?.mesero_id === null);

  const detalle = await api('GET', `/ordenes/${salon.body.id}`, tokenA);
  check('GET detalle 200', detalle.status === 200, String(detalle.status));
  check('GET detalle sin sla_minutos', !('sla_minutos' in (detalle.body ?? {})));
  check('GET detalle 22 campos', Object.keys(detalle.body ?? {}).length === 22);

  const confirmar = await api('PATCH', `/ordenes/${salon.body.id}/estado`, tokenA, {
    estado: 'CONFIRMADO',
  });
  check('PATCH CONFIRMADO 200', confirmar.status === 200, String(confirmar.status));
  check('PATCH confirmacion_at', typeof confirmar.body?.confirmacion_at === 'string');

  const saltar = await api('PATCH', `/ordenes/${salon.body.id}/estado`, tokenA, {
    estado: 'LISTO',
  });
  check(
    'PATCH salto 409 problem+json',
    checkProblem(saltar, 409),
    JSON.stringify(saltar.body),
  );

  const anular = await api('DELETE', `/ordenes/${salon.body.id}`, tokenA);
  check('DELETE 204', anular.status === 204, String(anular.status));
  check('DELETE sin body', anular.raw === '');

  const anularOtraVez = await api('DELETE', `/ordenes/${salon.body.id}`, tokenA);
  check(
    'DELETE repetido 409 problem+json',
    checkProblem(anularOtraVez, 409),
    JSON.stringify(anularOtraVez.body),
  );

  const crossTenant = await api('GET', `/ordenes/${delivery.body.id}`, tokenB);
  check(
    'GET cross-tenant 404 problem+json',
    checkProblem(crossTenant, 404),
    JSON.stringify(crossTenant.body),
  );

  const sinToken = await api('GET', '/ordenes', null);
  check(
    'GET sin token 401 problem+json',
    checkProblem(sinToken, 401),
    JSON.stringify(sinToken.body),
  );

  console.log(`\nResultado: ${passed} OK, ${failed} fallidas.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
