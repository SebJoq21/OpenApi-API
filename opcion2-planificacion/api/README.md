# API Fogonería — Implementación de la opción 2

Implementación real del contrato [`../../openapi.yaml`](../../openapi.yaml) **v1.2.0**, construida siguiendo el `spec.md`, `plan.md` y `tasks.md` de la opción 2.

| Dato | Valor |
|---|---|
| Stack | NestJS 11 + TypeScript + PostgreSQL 18 + Prisma 6 |
| Contrato | `openapi.yaml` 1.2.0 |
| Puerto API | `3000` |
| Puerto PostgreSQL | `5433` |
| Swagger | `http://localhost:3000/api/docs` |
| Base URL | `http://localhost:3000/api/v1` |

---

## 1. Estructura

```text
api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── scripts/
│   ├── db-local.ps1
│   ├── dev-token.ts
│   └── smoke-test.mjs
├── src/
│   ├── auth/
│   ├── common/
│   ├── health/
│   ├── ordenes/
│   ├── prisma/
│   ├── app.module.ts
│   ├── app.setup.ts
│   └── main.ts
├── test/
│   ├── unit/
│   ├── e2e/
│   └── contract/
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## 2. Requisitos

- Node.js 22 o superior.
- PostgreSQL 18 (local o Docker).
- Puerto `5433` libre.
- Docker Desktop si se usa la opción Docker.

> En esta máquina ya existe PostgreSQL 18 instalado y el servicio original usa el puerto `5432`. Por eso la API usa una instancia aislada en `5433`.

---

## 3. Arranque rápido

### Opción A — PostgreSQL local (Windows, ya probado)

```powershell
cd opcion2-planificacion/api
npm install
npm run db:local:init
npm run prisma:migrate
npm run seed
npm run start:dev
```

Si la instancia ya fue inicializada:

```powershell
npm run db:local:start
npm run start:dev
```

### Opción B — Docker

```powershell
cd opcion2-planificacion/api
npm install
npm run db:up
npm run prisma:migrate
npm run seed
npm run start:dev
```

> Docker Compose publica PostgreSQL en `localhost:5433` para no chocar con el servicio de `5432`.

### Variables de entorno

Copiar `.env.example` a `.env` si hace falta:

```env
DATABASE_URL=postgresql://fogoneria:fogoneria@localhost:5433/fogoneria?schema=public
JWT_SECRET=dev-secret-change-me
PORT=3000
```

---

## 4. Generar un token para la demo

El contrato no define endpoint de login. Para la demo se genera un JWT por consola:

```powershell
npm run token -- 11111111-1111-4111-8111-111111111111
```

Empresas sembradas:

| Empresa | ID |
|---|---|
| Empresa A | `11111111-1111-4111-8111-111111111111` |
| Empresa B | `22222222-2222-4222-8222-222222222222` |

---

## 5. Demo en Swagger

1. Abrir `http://localhost:3000/api/docs`.
2. Clic en **Authorize**.
3. Pegar el token generado.
4. Probar las 7 operaciones.

### Flujo sugerido

```text
POST /api/v1/ordenes/salon
{
  "sucursal_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  "mesa_id": "a1111111-1111-4111-8111-111111111111",
  "mesero_id": "a3333333-3333-4333-8333-333333333333",
  "cliente_id": "a4444444-4444-4444-8444-444444444444",
  "subtotal": 100,
  "cupon_id": "a5555555-5555-4555-8555-555555555555"
}
```

Resultado esperado:

- `201 Created`
- `Location: /api/v1/ordenes/{id}`
- `estado = PENDIENTE`
- `origen = SALON`
- `descuento_cupon = 10.00`
- `igv = 16.20`
- `total = 106.20`
- `numero_orden = ORD-AAAA-NNN`

Otros casos para mostrar:

| Caso | Resultado |
|---|---|
| `POST /ordenes/delivery` con `origen=DELIVERY` sin `cliente_id` | `400` problem+json |
| `GET /ordenes?page=1&limit=20` | `200` con `data` y `meta` |
| `GET /ordenes/alertas` | `200` solo activas vencidas |
| `PATCH /ordenes/{id}/estado` con `CONFIRMADO` | `200` + `confirmacion_at` |
| `PATCH` con salto a `LISTO` | `409` problem+json |
| `DELETE /ordenes/{id}` | `204` sin body |
| `DELETE` repetido | `409` problem+json |
| `GET` de una orden de la empresa B con token A | `404` |

---

## 6. Pruebas

```powershell
npm test                 # unitarias
npm run test:prepare     # migra la base de pruebas
npm run test:e2e         # 16 pruebas e2e
npm run test:contract    # 10 pruebas de contrato OpenAPI
npm run test:all         # migra la base de pruebas y ejecuta todo
node scripts/smoke-test.mjs  # 31 verificaciones contra el API en ejecución
npm run openapi:lint     # lint del contrato
npm run build            # compilación de producción
```

Resultados obtenidos:

| Suite | Resultado |
|---|---|
| Unitarias | 20/20 |
| E2E | 16/16 |
| Contrato | 10/10 |
| Smoke | 31/31 |
| Build | OK |
| OpenAPI lint | Válido, 2 warnings (license y localhost) |

---

## 7. Scripts

| Script | Función |
|---|---|
| `npm run start:dev` | Levanta el API con ts-node |
| `npm run build` | Compila a `dist/` |
| `npm run typecheck` | Verifica tipos |
| `npm test` | Pruebas unitarias |
| `npm run test:e2e` | Pruebas e2e |
| `npm run test:contract` | Pruebas de contrato |
| `npm run test:all` | Migra y ejecuta unitarias, e2e y contrato |
| `npm run test:prepare` | Migra la base de pruebas |
| `npm run prisma:migrate` | Migra la base de desarrollo |
| `npm run seed` | Carga datos demo |
| `npm run token -- <empresaId>` | Genera JWT de demo |
| `npm run db:local:init/start/stop/status` | PostgreSQL local aislado |
| `npm run db:up/down` | PostgreSQL con Docker |
| `npm run openapi:lint` | Valida el contrato |

---

## 8. Decisiones de implementación

- **JWT:** guard propio con `@nestjs/jwt` en lugar de `passport-jwt`, para reducir dependencias y mantener el mismo comportamiento.
- **PostgreSQL:** instancia local aislada en `5433` porque el servicio de `5432` ya estaba ocupado y Docker no estaba corriendo.
- **Swagger:** `swagger-ui-express` sirve directamente el `openapi.yaml` canónico; no se genera un segundo contrato.
- **Errores:** filtro global que produce `application/problem+json` con `type`, `title`, `status` y `detail`.
- **Correlación:** `X-Request-Id` en headers; no se agregó `traceId` ni `details` al body porque el contrato no los define.
- **`201`:** incluye `Location` como buena práctica HTTP.
- **`DELETE` repetido:** devuelve `409`, tal como exige el contrato.
- **Base de pruebas:** `fogoneria_test`, migrada con `npm run test:prepare`.
- **Datos demo:** 2 empresas, 4 sucursales, mesas, meseros, clientes, cupones y 7 órdenes en distintos estados.

---

## 9. Limitaciones conocidas

- No hay endpoint de login; el token se genera por consola para la demo.
- No se implementaron roles/scopes ni `403`, porque el contrato no los define.
- No se implementó `429` en la aplicación; se recomienda gateway/WAF.
- La capa `repository` se resolvió directamente con Prisma en el servicio; queda como deuda de arquitectura documentada en `revision.md`.
- CI, pruebas de performance y checklist OWASP completo quedan como pendientes no bloqueantes para la demo.

---

## 10. Evidencia

- `revision.md` contiene la revisión del contrato, las pruebas y las desviaciones.
- `scripts/smoke-test.mjs` reproduce el flujo completo contra el API en ejecución.
- `test/contract/api.contract-spec.ts` valida las respuestas reales contra el OpenAPI.
