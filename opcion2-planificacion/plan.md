# Plan técnico — API Fogonería: Gestión de Órdenes

| Campo | Valor |
|---|---|
| **Documento** | `plan.md` |
| **Versión** | 1.0 |
| **Fecha** | 2026-11-13 |
| **Entrada funcional** | `spec.md` v1.0 |
| **Contrato** | `openapi.yaml` v1.2.0 |
| **Enfoque** | Spec-Driven Development con NestJS + PostgreSQL + Prisma |
| **Estado** | Borrador completo para revisión |

> Este documento describe **cómo** se construye el API. Las reglas de negocio y los criterios de aceptación están en `spec.md`; la ejecución atómica está en `tasks.md`.

---

## 1. Entradas y restricciones

### 1.1 Entradas

1. `openapi.yaml` v1.2.0 — fuente de verdad del contrato.
2. `spec.md` — requisitos funcionales, reglas, criterios de aceptación y supuestos.
3. `constitution.md` — reglas no negociables para personas e IA.
4. `tasks.md` — backlog atómico de ejecución.
5. `prompts.md` — bitácora de prompts y correcciones.

### 1.2 Restricciones

- No modificar el contrato.
- No implementar endpoints fuera de las 7 operaciones.
- No agregar roles, scopes, 403, 422 ni 429 al contrato sin aprobación.
- Usar `application/problem+json` para todos los errores.
- Mantener `empresa_id` fuera del alcance del cliente.
- Ejecutar una tarea por vez y registrar el prompt.
- Cuidar la claridad para la revisión humana y la exposición final.

---

## 2. Resumen técnico

Se propone un **monolito modular NestJS** con PostgreSQL y Prisma. La arquitectura separa:

- **Controller:** contrato HTTP, DTOs, códigos de estado y headers.
- **Service:** reglas de negocio, transacciones y cálculos.
- **Repository/Prisma:** acceso a datos y consultas.
- **Mapper:** construcción exacta de la respuesta del contrato.
- **Common:** filtros de error, request ID, utilidades de dinero, guards y decoradores.

La API se documenta con Swagger/Redoc sobre el contrato canónico. Las pruebas de contrato validan que las respuestas reales cumplen `openapi.yaml`.

---

## 3. Decisiones de stack

| Capa | Elección | Motivo | Alternativa descartada |
|---|---|---|---|
| Runtime | Node.js 22 LTS + TypeScript estricto | LTS, tipado, ecosistema | Node 18/20 por fin de soporte |
| Framework | NestJS 11+ | El contrato menciona NestJS; módulos, DI, guards, filters, pipes | Express directo: menos estructura |
| Base de datos | PostgreSQL 16+ | Transacciones, `numeric`, enums, índices, concurrencia | MongoDB: menos garantías relacionales |
| ORM | Prisma 6+ | Migraciones, tipos, transacciones, `Decimal` | TypeORM: más flexible pero menos tipado |
| Autenticación | `passport-jwt` + `@nestjs/jwt`; HS256 local y RS256/JWKS en producción | JWT bearer estándar | Sesiones/cookies: el contrato exige bearer |
| Validación | `class-validator` + `class-transformer` + `ValidationPipe` estricto | DTOs declarativos y lista blanca | Validación manual: propensa a omisiones |
| Dinero | `Prisma.Decimal` / `decimal.js` | Precisión decimal y redondeo controlado | `number`/`parseFloat`: errores de centavos |
| Pruebas | Jest + Supertest + Testcontainers/Compose | Unitarias, integración y e2e | Solo pruebas manuales |
| Contrato | Redocly CLI + `jest-openapi` | Lint y validación de respuestas reales | Solo revisión visual |
| Infra | Docker Compose | PostgreSQL y API reproducibles | Instalación manual |
| Logs | `nestjs-pino` / pino | JSON estructurado y correlación | `console.log` |
| Documentación | Swagger UI/Redoc sobre el YAML canónico | Evita duplicar el contrato | Decoradores que generan un segundo contrato |

> Si el proyecto Fogonería ya usa TypeORM, el cambio es local al plan técnico: la spec, las reglas y las tareas no cambian.

---

## 4. Arquitectura

### 4.1 Estilo

Monolito modular. No se justifican microservicios para 7 operaciones y una sola entidad de negocio.

```text
Cliente
  │
  ▼
NestJS HTTP
  ├── Middleware: request ID
  ├── Guard: JWT + tenant
  ├── Pipe: validación DTO
  ├── Controller
  │      └── Service
  │             ├── Domain rules (money, state, SLA, numbering)
  │             └── Prisma / PostgreSQL
  ├── Mapper: respuesta exacta
  └── Filter: problem+json
```

### 4.2 Estructura de carpetas propuesta

```text
src/
├── main.ts
├── app.module.ts
├── config/
│   ├── env.validation.ts
│   └── configuration.ts
├── common/
│   ├── errors/
│   │   ├── problem-details.types.ts
│   │   ├── problem-details.exception.ts
│   │   ├── problem-details.filter.ts
│   │   ├── validation-exception.factory.ts
│   │   └── http-status-title.ts
│   ├── http/
│   │   ├── request-id.middleware.ts
│   │   └── location.interceptor.ts
│   ├── money/
│   │   └── money.ts
│   └── decorators/
│       └── current-tenant.decorator.ts
├── auth/
│   ├── auth.module.ts
│   ├── jwt.strategy.ts
│   ├── jwt-auth.guard.ts
│   ├── public.decorator.ts
│   └── tenant-context.ts
├── catalogos/
│   └── catalogos.module.ts
├── ordenes/
│   ├── ordenes.module.ts
│   ├── ordenes.controller.ts
│   ├── ordenes.service.ts
│   ├── ordenes.repository.ts
│   ├── ordenes.mapper.ts
│   ├── domain/
│   │   ├── estado-machine.ts
│   │   ├── numero-orden.ts
│   │   ├── cupon.ts
│   │   └── sla.ts
│   └── dto/
│       ├── crear-orden-salon.dto.ts
│       ├── crear-orden-delivery.dto.ts
│       ├── listar-ordenes.query.ts
│       ├── listar-alertas.query.ts
│       └── actualizar-estado.dto.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
└── health/
    └── health.controller.ts   # interno, fuera del contrato

prisma/
├── schema.prisma
├── migrations/
└── seed.ts

test/
├── unit/
├── integration/
├── e2e/
└── contract/
```

### 4.3 Orden de rutas

En `ordenes.controller.ts`:

```text
@Get('alertas')      // primero
@Get(':id')          // después
```

Se agrega una prueba e2e que confirma que `/ordenes/alertas` no se interpreta como `id`.

---

## 5. Modelo de datos

### 5.1 Tablas de apoyo

El contrato solo expone `Orden`, pero se necesitan catálogos mínimos para validar referencias y generar datos de prueba.

| Tabla | Propósito | Campos principales |
|---|---|---|
| `empresas` | Tenant | `id`, `nombre`, `created_at` |
| `sucursales` | Sucursal y configuración SLA | `id`, `empresa_id`, `nombre`, `sla_minutos`, `timezone` |
| `mesas` | Mesas de salón | `id`, `sucursal_id`, `codigo` |
| `usuarios` | Meseros/operadores | `id`, `empresa_id`, `nombre`, `activo` |
| `clientes` | Clientes | `id`, `empresa_id`, `nombre` |
| `cupones` | Descuentos | `id`, `empresa_id`, `codigo`, `tipo`, `valor`, `vigente_desde`, `vigente_hasta`, `activo` |
| `listas_precio` | Listas de precio | `id`, `empresa_id`, `nombre` |
| `ordenes` | Entidad principal | 22 campos del contrato + `sla_minutos` interno |
| `orden_secuencias` | Numeración atómica | `sucursal_id`, `anio`, `ultimo` |

### 5.2 Tabla `ordenes`

| Columna | Tipo | Nulo | Notas |
|---|---|---|---|
| `id` | uuid PK | No | `gen_random_uuid()` |
| `empresa_id` | uuid FK | No | Tenant |
| `sucursal_id` | uuid FK | No | Debe pertenecer a la empresa |
| `numero_orden` | varchar(20) | No | `ORD-AAAA-NNN` |
| `mesa_id` | uuid FK | Sí | Salón; null en delivery/LLEVAR |
| `cliente_id` | uuid FK | Sí | Obligatorio en DELIVERY |
| `mesero_id` | uuid FK | Sí | Salón; null en delivery/LLEVAR |
| `origen` | enum | No | `SALON`, `LLEVAR`, `DELIVERY` |
| `estado` | enum | No | Default `PENDIENTE` |
| `subtotal` | numeric(12,2) | No | ≥ 0 |
| `descuento_cupon` | numeric(12,2) | No | Default 0.00 |
| `igv` | numeric(12,2) | No | Calculado |
| `total` | numeric(12,2) | No | Calculado |
| `lista_precio_id` | uuid FK | Sí | Referencia |
| `cupon_id` | uuid FK | Sí | Referencia |
| `ingreso_at` | timestamptz | No | Ahora |
| `confirmacion_at` | timestamptz | Sí | Transición |
| `listo_at` | timestamptz | Sí | Transición |
| `entrega_at` | timestamptz | Sí | Transición |
| `sla_minutos` | integer | No | Snapshot interno, no se expone |
| `created_at` | timestamptz | No | Ahora |
| `updated_at` | timestamptz | No | Se actualiza en cada escritura |

> `alerta_sla` no se almacena: se calcula en lectura a partir de `estado`, `ingreso_at` y `sla_minutos`.

### 5.3 Índices y restricciones

- `UNIQUE (sucursal_id, numero_orden)`.
- `UNIQUE (sucursal_id, anio)` en `orden_secuencias`.
- Índice `(empresa_id, ingreso_at DESC)` para listados.
- Índice `(empresa_id, estado, ingreso_at)` para alertas y filtros.
- Índice `(empresa_id, sucursal_id, ingreso_at)`.
- Índice `(empresa_id, mesa_id, ingreso_at)`.
- FK de `sucursal_id`, `mesa_id`, `cliente_id`, `mesero_id`, `cupon_id`, `lista_precio_id`.
- Validación de coherencia de tenant en servicio; opcionalmente, claves compuestas `(id, empresa_id)` en catálogos.

### 5.4 Enums

```text
EstadoOrden: PENDIENTE, CONFIRMADO, PREPARANDO, LISTO, ENTREGADO, ANULADO
OrigenOrden: SALON, LLEVAR, DELIVERY
EstadoAvance: CONFIRMADO, PREPARANDO, LISTO, ENTREGADO
TipoCupon: PORCENTAJE, MONTO_FIJO
```

`EstadoAvance` es un enum de DTO, no una columna.

### 5.5 Migraciones y seeds

- Migraciones versionadas con `prisma migrate`.
- Seed idempotente con:
  - 2 empresas (A y B) para pruebas de aislamiento.
  - 2 sucursales por empresa, con SLA distinto.
  - Mesas, meseros, clientes, cupones y listas de precio.
  - Órdenes de ejemplo en distintos estados.
- El seed no se ejecuta en producción.

---

## 6. Contrato de API y mapeo

| `operationId` | Método y ruta | DTO entrada | Servicio | Éxito | Errores |
|---|---|---|---|---|---|
| `crearOrdenSalon` | `POST /ordenes/salon` | `CrearOrdenSalonDto` | `crearSalon` | 201 + `Location` | 400, 401, 409, 500 |
| `crearOrdenDelivery` | `POST /ordenes/delivery` | `CrearOrdenDeliveryDto` | `crearDelivery` | 201 + `Location` | 400, 401, 409, 500 |
| `listarOrdenes` | `GET /ordenes` | `ListarOrdenesQuery` | `listar` | 200 | 400, 401, 500 |
| `listarOrdenesAlertaSla` | `GET /ordenes/alertas` | `ListarAlertasQuery` | `listarAlertas` | 200 | 401, 500 |
| `obtenerOrden` | `GET /ordenes/{id}` | `OrdenIdParam` | `obtener` | 200 | 401, 404, 500 |
| `actualizarEstadoOrden` | `PATCH /ordenes/{id}/estado` | `ActualizarEstadoDto` | `actualizarEstado` | 200 | 400, 401, 404, 409, 500 |
| `anularOrden` | `DELETE /ordenes/{id}` | `OrdenIdParam` | `anular` | 204 | 401, 404, 409, 500 |

Cada controller usa `@HttpCode` explícito cuando corresponde y el mapper construye la respuesta.

---

## 7. Reglas y algoritmos

### 7.1 Dinero y cupones

```text
base = subtotal - descuento_cupon
igv = round(base * 0.18, 2, HALF_UP)
total = round(base + igv, 2, HALF_UP)
```

- `subtotal` se recibe como número y se convierte a `Prisma.Decimal`.
- El descuento se calcula:
  - `PORCENTAJE`: `subtotal * valor / 100`.
  - `MONTO_FIJO`: `valor`.
- `descuento_cupon = min(descuento_calculado, subtotal)`, redondeado a 2 decimales.
- Sin cupón: `0.00`.
- Cupón inexistente, inactivo o fuera de vigencia: 400.
- El mapper convierte `Decimal` a `Number` con 2 decimales para el JSON.

**Ejemplo:** subtotal 100.00, cupón 10 % → descuento 10.00, base 90.00, IGV 16.20, total 106.20.

### 7.2 Numeración

1. Determinar año de negocio en `America/Lima`.
2. En una transacción, ejecutar un upsert atómico:

```sql
INSERT INTO orden_secuencias (sucursal_id, anio, ultimo)
VALUES ($1, $2, 1)
ON CONFLICT (sucursal_id, anio)
DO UPDATE SET ultimo = orden_secuencias.ultimo + 1
RETURNING ultimo;
```

3. Formatear `ORD-${anio}-${String(ultimo).padStart(3, '0')}`.
4. Insertar la orden.
5. Ante colisión `P2002`, reintentar hasta 3 veces; si persiste, 409.

No se usa `MAX(numero_orden) + 1` sin bloqueo. Los huecos por rollback son aceptables; la unicidad no.

### 7.3 Máquina de estados

| Estado actual | Estado siguiente | Timestamp |
|---|---|---|
| `PENDIENTE` | `CONFIRMADO` | `confirmacion_at` |
| `CONFIRMADO` | `PREPARANDO` | — |
| `PREPARANDO` | `LISTO` | `listo_at` |
| `LISTO` | `ENTREGADO` | `entrega_at` |

Implementación:

1. Validar que el destino esté en `EstadoAvance` (si no, 400).
2. Ejecutar un `UPDATE` condicional:

```sql
UPDATE ordenes
SET estado = $next,
    confirmacion_at = CASE WHEN $next = 'CONFIRMADO' THEN now() ELSE confirmacion_at END,
    listo_at = CASE WHEN $next = 'LISTO' THEN now() ELSE listo_at END,
    entrega_at = CASE WHEN $next = 'ENTREGADO' THEN now() ELSE entrega_at END,
    updated_at = now()
WHERE id = $id AND empresa_id = $empresa AND estado = $current
RETURNING *;
```

3. Si no actualiza:
   - Consultar la orden por `id + empresa_id`.
   - Si no existe: 404.
   - Si existe pero el estado no es el esperado: 409.

Esto evita que dos peticiones simultáneas avancen dos veces.

### 7.4 Anulación

```sql
UPDATE ordenes
SET estado = 'ANULADO', updated_at = now()
WHERE id = $id
  AND empresa_id = $empresa
  AND estado NOT IN ('ENTREGADO', 'ANULADO')
RETURNING id;
```

- Si actualiza: 204.
- Si no: consultar; 404 si no existe, 409 si está `ENTREGADO` o `ANULADO`.

La segunda anulación devuelve 409 por contrato, aunque REST recomiende idempotencia. Se documenta como tensión.

### 7.5 SLA

- `sucursales.sla_minutos` define el límite; default 20.
- Al crear la orden se copia a `ordenes.sla_minutos`.
- `alerta_sla = estado IN ('PENDIENTE','CONFIRMADO','PREPARANDO','LISTO')
  AND now() > ingreso_at + sla_minutos`.
- En listados y detalle se calcula con la hora de la base de datos.
- En `/ordenes/alertas` el filtro se aplica en SQL, no en memoria.
- Una orden `ENTREGADO` o `ANULADO` nunca alerta.

### 7.6 Multitenencia

- El guard obtiene `empresa_id` del JWT y lo adjunta al request.
- El decorador `@CurrentTenant()` lo expone al controller.
- Todos los métodos del repositorio reciben `empresaId` como parámetro obligatorio.
- No existe un método `findById(id)` sin tenant.
- Las referencias del body se validan contra el tenant.
- Un recurso de otra empresa se trata como inexistente: 404.

### 7.7 Listados y filtros

- `where` base: `empresa_id = tenant`.
- Filtros opcionales: `estado`, `origen`, `sucursal_id`, `mesa_id`.
- Rango: `ingreso_at >= desde` y `ingreso_at <= hasta`.
- Orden: `ingreso_at DESC, id DESC`.
- `page` y `limit` con `skip`/`take`.
- `total` con `count` sobre el mismo `where`.
- `total_pages = total === 0 ? 0 : Math.ceil(total / limit)`.
- Página fuera de rango: `data: []`, 200.

### 7.8 Serialización

El mapper construye exactamente:

```json
{
  "id": "...",
  "empresa_id": "...",
  "sucursal_id": "...",
  "numero_orden": "ORD-2026-001",
  "mesa_id": null,
  "cliente_id": "...",
  "mesero_id": null,
  "origen": "DELIVERY",
  "estado": "PENDIENTE",
  "subtotal": 85.50,
  "descuento_cupon": 0.00,
  "igv": 15.39,
  "total": 100.89,
  "lista_precio_id": null,
  "cupon_id": null,
  "ingreso_at": "2026-11-13T15:00:00.000Z",
  "confirmacion_at": null,
  "listo_at": null,
  "entrega_at": null,
  "alerta_sla": false,
  "created_at": "2026-11-13T15:00:00.000Z",
  "updated_at": "2026-11-13T15:00:00.000Z"
}
```

Reglas:

- No devolver `sla_minutos`.
- No devolver campos en `camelCase`.
- No convertir montos a string.
- No omitir campos nulos.
- No devolver la entidad Prisma directamente.

### 7.9 Errores Problem Details

Componentes:

- `ProblemDetailsException`: excepción de dominio con `status` y `detail`.
- `ValidationExceptionFactory`: convierte errores de `class-validator` en un `BadRequestException` con mensajes unidos.
- `ProblemDetailsFilter`: filtro global `@Catch()` que construye el body y fija el content type.
- `http-status-title.ts`: mapa `status → title` usando `STATUS_CODES` de Node.

Flujo:

```text
HttpException / ProblemDetailsException
        ↓
ProblemDetailsFilter
        ↓
{ type: 'about:blank', title, status, detail }
```

Reglas:

- `type` siempre `about:blank`.
- `title` = frase estándar HTTP.
- `status` = código HTTP.
- `detail` = string; arrays de validación se unen con `; `.
- 500: `detail` genérico; el stack solo va al log.
- `Content-Type: application/problem+json`.
- No se devuelven `statusCode`, `message` ni `error`.

### 7.10 Request ID y Location

- Middleware `request-id`: usa `X-Request-Id` entrante si es válido; si no, genera `crypto.randomUUID()`.
- Se adjunta a `req.id`, se devuelve en la respuesta y se incluye en los logs.
- No se agrega al body de error.
- `Location` se construye como `/api/v1/ordenes/{id}` en los 201.
- Se implementa con un interceptor o directamente en el controller; se prueba en e2e.

---

## 8. Seguridad

| Control | Implementación |
|---|---|
| Autenticación | JWT bearer validado con `passport-jwt` |
| Firma | HS256 local; RS256/JWKS en producción |
| Claims | `empresa_id` obligatorio; `sub`, `exp`, `iat` |
| Expiración | Validación automática; 401 si expira |
| Autorización | Aislamiento por empresa; no hay roles en el contrato |
| Transporte | HTTPS/TLS en despliegue |
| Headers | Helmet |
| CORS | Origen permitido por configuración |
| Body limit | Límite razonable para JSON |
| Validación | DTOs con lista blanca estricta |
| SQL injection | Prisma/consultas parametrizadas |
| Rate limit | Preferible gateway/WAF; si se implementa en app, 429 problem+json |
| Logs | Sin tokens, secretos ni datos sensibles |
| Errores | 500 sin stack; 404 para recursos de otra empresa |
| Dependencias | Revisión y mínimo necesario |
| OWASP | Checklist API Top 10 en la fase de hardening |

**Nota:** el contrato no define roles ni scopes. Si se agregan, se debe extender el contrato y la matriz de pruebas (incluido 403).

---

## 9. Estrategia de pruebas

### 9.1 Pirámide

| Nivel | Qué prueba | Herramienta |
|---|---|---|
| Unitarias | Dinero, cupón, numeración, estados, SLA, mapper, filtro de errores | Jest |
| Integración | Repositorio, transacciones, constraints, migraciones | Jest + PostgreSQL de prueba |
| E2E | 7 endpoints, códigos, headers, errores, tenant | Supertest |
| Contrato | Respuestas reales contra `openapi.yaml` | `jest-openapi` + Redocly |
| Concurrencia | Numeración y transiciones simultáneas | Jest + `Promise.all` |
| Rendimiento | Smoke de listados y creación | autocannon/k6 |
| Seguridad | Checklist OWASP, validación, logs | Revisión + pruebas |

### 9.2 Casos mínimos

- Feliz path de cada operación.
- 400 por DTO inválido, UUID inválido, enum inválido, fecha inválida, `desde > hasta`.
- 401 por token ausente, inválido y expirado.
- 404 por orden inexistente y por orden de otra empresa.
- 409 por transición inválida, salto, retroceso, repetición, anulación de entregada/anulada.
- 400 por referencias de otra empresa.
- 201 con `Location`.
- 204 sin body.
- Errores con `application/problem+json`, `type`, `title`, `status`, `detail`.
- Sin campos `statusCode`, `message`, `error`.
- 500 simulado sin stack.
- Aislamiento multiempresa en las 7 operaciones.
- 50 creaciones concurrentes sin duplicados.
- Dos PATCH concurrentes: uno 200, otro 409.

### 9.3 Contrato

- `npx @redocly/cli lint ../openapi.yaml`.
- `jest-openapi` carga el YAML y valida cada respuesta.
- El CI falla si una respuesta no cumple el esquema o el content type.

### 9.4 Cobertura

- Global ≥ 80 %.
- Dominio (dinero, estados, numeración, cupón, SLA) ≥ 90 %.
- No se persigue cobertura como fin; se priorizan caminos de error y reglas.

---

## 10. CI/CD y reproducibilidad

### 10.1 Pipeline

```text
install → lint → typecheck → unit → integration → e2e → contract → build
```

- PostgreSQL como servicio o Testcontainers.
- Migraciones aplicadas antes de integration/e2e.
- Seeds de prueba.
- Reporte de cobertura y de contrato como artefactos.
- El pipeline bloquea si falla lint, tipos, pruebas o contrato.

### 10.2 Docker Compose

- `postgres:16` con volumen y healthcheck.
- API construida desde el Dockerfile.
- `.env.example` con:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `JWT_ISSUER`
  - `JWT_AUDIENCE`
  - `PORT`
  - `SLA_DEFAULT_MINUTOS`
  - `TZ`

### 10.3 Runbook

El README de implementación debe permitir:

1. Copiar `.env.example` a `.env`.
2. Levantar PostgreSQL.
3. Instalar dependencias.
4. Ejecutar migraciones.
5. Ejecutar seeds.
6. Levantar la API.
7. Abrir Swagger/Redoc.
8. Ejecutar pruebas.
9. Regenerar la base de datos.

---

## 11. Observabilidad y operación

- Logs JSON estructurados con `requestId`, método, ruta, status y duración.
- No registrar tokens, passwords ni cuerpos sensibles completos.
- `X-Request-Id` en todas las respuestas.
- Errores 500 registrados con stack en el servidor, pero respuesta genérica.
- Health check interno fuera del contrato (`/health`), no documentado en OpenAPI.
- Swagger/Redoc sobre el YAML canónico.
- Migraciones y seeds documentados.
- Graceful shutdown de Prisma.

---

## 12. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Ambigüedad de cupón, SLA o numeración | Retrabajo | Supuestos A-02…A-06 + revisión temprana |
| Condiciones de carrera en numeración | Duplicados | Upsert atómico + unique + retry |
| Condiciones de carrera en estados | Doble transición | UPDATE condicional + prueba concurrente |
| Deriva del contrato | Incumplimiento | Contrato canónico + contract tests + CI |
| `Decimal` serializado como string | Respuesta inválida | Mapper explícito + pruebas de tipo |
| Ruta `/alertas` capturada por `/:id` | 404 inesperado | Orden de rutas + test |
| 201 sin `Location` | Mala práctica | Interceptor + test |
| Error con formato antiguo | Incumplimiento RFC | Filtro global + test de content type |
| IA agrega `traceId`/`details` | Scope creep | Constitución + prompt + revisión |
| `DELETE` no idempotente | Discusión REST | Documentar tensión; respetar contrato |
| Zona horaria incorrecta | Año/numeración erróneos | `America/Lima` explícito + tests de borde |
| Catálogos insuficientes | FKs inválidas | Seeds y tablas mínimas |
| Pruebas e2e lentas/inestables | Falsa alarma | Testcontainers/Compose + datos aislados |
| Migraciones conflictivas | Bloqueo | Migraciones versionadas y revisadas |

---

## 13. IA vs. persona

| Fase | IA | Persona |
|---|---|---|
| Diseño | Borrador de spec, modelos, ejemplos | Decide recursos, reglas y alcance |
| Documentación | Descripciones, glosario, prompts | Valida precisión y consistencia |
| Código | Controllers, DTOs, services, tests | Revisa arquitectura, seguridad y estilo |
| Pruebas | Casos y datos | Define criterios de aceptación |
| Seguridad | Detecta patrones inseguros | Valida OWASP API Top 10 |
| Revisión | Señala posibles incumplimientos | Aprueba o rechaza |
| Operación | Resume logs y alertas | Decide la acción |

**Regla:** la IA no decide reglas de negocio ni cambia el contrato. La persona mantiene la responsabilidad final.

---

## 14. Estrategia de prompts

Cada tarea se ejecuta con el formato de 6 partes del material del curso:

1. **Rol y contexto:** stack, convenciones, enlaces a `constitution.md`.
2. **Contrato:** adjuntar `openapi.yaml` v1.2.0.
3. **Alcance:** una sola operación o tarea.
4. **Restricciones:** capas, errores, seguridad, dependencias.
5. **Criterios y pruebas:** casos felices, 400, 401, 404, 409, 500.
6. **Salida esperada:** archivos, diff, tests y comandos.

Plantilla completa en `prompts.md` y en la cabecera de `tasks.md`.

Reglas:

- Una tarea por vez.
- Si hay ambigüedad, detenerse y preguntar.
- Registrar el prompt y las correcciones.
- No aceptar cambios al contrato.
- Revisar el diff antes de continuar.

---

## 15. Fases y estimación

| Fase | Objetivo | Tareas | Estimación |
|---|---|---|---|
| 0 | Preparación, contrato y andamiaje | T-001…T-008 | 1.5 días |
| 1 | Datos, dominio y errores | T-009…T-024 | 3.5 días |
| 2 | Autenticación y multitenencia | T-025…T-031 | 1.5 días |
| 3 | Implementación de los 7 endpoints | T-032…T-045 | 4 días |
| 4 | Contrato y pruebas transversales | T-046…T-054 | 2.5 días |
| 5 | Hardening, documentación y CI | T-055…T-062 | 2 días |
| 6 | Revisión y handoff | T-063…T-069 | 1 día |

**Total:** 12–16 días-persona. Con asistencia de IA bien dirigida y revisión humana: 8–10 días.

---

## 16. Definición de terminado

- [ ] Las 7 operaciones implementadas.
- [ ] Contrato v1.2.0 sin modificaciones.
- [ ] `application/problem+json` en todos los errores.
- [ ] `201` con `Location`; `204` sin body.
- [ ] Cálculos con `Decimal` y redondeo correcto.
- [ ] Numeración única y concurrente.
- [ ] Máquina de estados estricta.
- [ ] SLA correcto en estados activos.
- [ ] Aislamiento multiempresa probado.
- [ ] Suite de contrato al 100 %.
- [ ] CI verde.
- [ ] README reproducible.
- [ ] `revision.md` aprobado.
- [ ] `prompts.md` actualizado.

---

## 17. Trazabilidad Spec ↔ Plan

| Requisito | Componente del plan |
|---|---|
| FR-001, FR-002 | `auth/`, guard, tenant context |
| FR-003, FR-004 | `ordenes.controller`, `crearSalon`, `crearDelivery` |
| FR-005 | `common/money`, `domain/cupon` |
| FR-006 | `domain/numero-orden`, `orden_secuencias` |
| FR-007 | `ordenes.service`, mapper |
| FR-008, FR-019 | `listar`, query DTO, repositorio |
| FR-009, FR-020 | `listarAlertas`, `domain/sla` |
| FR-010, FR-015 | `obtener`, mapper |
| FR-011 | `domain/estado-machine`, `actualizarEstado` |
| FR-012 | `anular` |
| FR-013, FR-017 | `common/errors`, filtro, interceptores |
| FR-014, FR-018 | DTOs estrictos y validación de referencias |
| FR-016 | Orden de rutas |
| FR-021 | `ValidationPipe` y DTOs |
| FR-022 | `request-id`, logs |
| FR-023 | `test/contract`, Redocly |
| FR-024 | Constitución y alcance |

---

## 18. Decisiones abiertas para la revisión

1. `about:blank` vs. URIs estables por tipo de problema.
2. `traceId` en body vs. solo `X-Request-Id`.
3. `DELETE` idempotente vs. 409 del contrato.
4. SLA en órdenes entregadas para histórico.
5. Cupón porcentaje/fijo y tope.
6. `Location` en 201.
7. Rate limit en app vs. gateway.
8. Zona horaria por tenant.
9. Roles/scopes futuros.
10. Herramienta de documentación final: Swagger, Redoc o Postman.
