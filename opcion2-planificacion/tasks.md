# Tareas de implementación — API Fogonería

| Campo | Valor |
|---|---|
| **Documento** | `tasks.md` |
| **Versión** | 1.0 |
| **Fecha** | 2026-11-13 |
| **Entrada** | `spec.md`, `plan.md`, `constitution.md`, `openapi.yaml` 1.2.0 |
| **Total de tareas** | 69 |
| **Estado** | Listo para ejecución por fases |

> Cada tarea está pensada para que una IA la ejecute **una por vez**, con revisión humana después. Si una tarea es ambigua, la IA debe detenerse y preguntar; no debe inventar alcance.

---

## 1. Cómo usar este archivo

1. Leer `constitution.md` y `openapi.yaml`.
2. Leer la tarea completa.
3. Ejecutar solo esa tarea.
4. Correr la verificación indicada.
5. Registrar el prompt y el resultado en `prompts.md`.
6. Revisar el diff y aprobar o devolver.
7. Pasar a la siguiente tarea.

No se ejecutan dos tareas de endpoints a la vez. No se avanza con pruebas rojas.

---

## 2. Prompt base para cada tarea

```text
1. ROL Y CONTEXTO
Actúa como desarrollador backend senior en NestJS + TypeScript + PostgreSQL + Prisma.
Lee constitution.md, openapi.yaml, spec.md y plan.md antes de escribir código.
Respeta la arquitectura por capas y las convenciones del proyecto.

2. CONTRATO
La fuente de verdad es openapi.yaml v1.2.0. No lo modifiques.
No agregues endpoints, campos, estados, códigos HTTP ni dependencias.

3. ALCANCE
Implementa únicamente la tarea T-XXX: <título>.
No hagas refactorizaciones ni mejoras fuera de esa tarea.

4. RESTRICCIONES
- Errores: application/problem+json con type, title, status y detail.
- Prohibido statusCode, message y error en el body.
- empresa_id solo desde el JWT.
- DTOs con lista blanca estricta.
- Dinero con Decimal y redondeo HALF_UP.
- Si hay ambigüedad, detente y pregunta.

5. CRITERIOS Y PRUEBAS
Cumple los criterios de aceptación indicados en la tarea.
Incluye pruebas unitarias/e2e/contrato según corresponda.
Prueba caminos felices y errores 400, 401, 404, 409 y 500 cuando aplique.

6. SALIDA ESPERADA
Entrega:
- archivos creados o modificados,
- diff resumido,
- comandos ejecutados,
- resultados de pruebas,
- supuestos o dudas.
```

---

## 3. Fases

| Fase | Objetivo | Tareas | Gate de salida |
|---|---|---|---|
| 0 | Preparación y andamiaje | T-001…T-008 | Contrato validado y proyecto base |
| 1 | Datos, dominio y errores | T-009…T-024 | Migraciones, seeds y unit tests |
| 2 | Autenticación y tenant | T-025…T-031 | 401 y aislamiento básico |
| 3 | Endpoints | T-032…T-045 | 7/7 operaciones + e2e |
| 4 | Contrato y pruebas transversales | T-046…T-054 | Contract tests y concurrencia |
| 5 | Hardening y entrega | T-055…T-062 | CI, seguridad y runbook |
| 6 | Revisión y handoff | T-063…T-069 | Evidencia y revisión |

---

## Fase 0 — Preparación y andamiaje

### T-001 — Validar el contrato y fijar la versión

- **Fase:** 0
- **Depende de:** —
- **Req/AC:** NFR-001, AC-043
- **Objetivo:** Confirmar que `openapi.yaml` 1.2.0 es válido y registrar su huella.
- **Archivos:** `README.md`, `prompts.md`, `test/contract/README.md`
- **Instrucción IA:** Ejecutar Redocly lint; documentar versión, fecha y comando. No modificar el YAML.
- **Verificación:** `npx @redocly/cli lint ../openapi.yaml` sin errores; hash o versión registrada.
- **Estimación:** 1 h

### T-002 — Congelar supuestos y decisiones

- **Fase:** 0
- **Depende de:** T-001
- **Req/AC:** A-01…A-20
- **Objetivo:** Revisar los supuestos del Spec y marcarlos como aceptados, corregidos o pendientes.
- **Archivos:** `spec.md`, `plan.md`, `prompts.md`
- **Instrucción IA:** No decidir reglas de negocio. Solo registrar la decisión humana y su impacto.
- **Verificación:** Tabla de supuestos con estado y responsable.
- **Estimación:** 1 h

### T-003 — Crear el proyecto NestJS base

- **Fase:** 0
- **Depende de:** T-001
- **Req/AC:** NFR-007, NFR-009
- **Objetivo:** Inicializar NestJS con TypeScript estricto y scripts de arranque.
- **Archivos:** `package.json`, `tsconfig.json`, `src/main.ts`, `src/app.module.ts`, `.env.example`
- **Instrucción IA:** Crear el esqueleto mínimo; no implementar endpoints todavía. Configurar `setGlobalPrefix('api/v1')`.
- **Verificación:** `npm run build` y `npm run start:dev` sin errores.
- **Estimación:** 2 h

### T-004 — Configurar lint, formato y typecheck

- **Fase:** 0
- **Depende de:** T-003
- **Req/AC:** NFR-009
- **Objetivo:** Dejar ESLint, Prettier y `tsc --noEmit` listos para CI.
- **Archivos:** `.eslintrc`, `.prettierrc`, `tsconfig.json`, `package.json`
- **Instrucción IA:** No agregar reglas exóticas; priorizar consistencia y tipos estrictos.
- **Verificación:** `npm run lint`, `npm run format:check`, `npm run typecheck`.
- **Estimación:** 1 h

### T-005 — Configurar Docker Compose y variables de entorno

- **Fase:** 0
- **Depende de:** T-003
- **Req/AC:** NFR-007
- **Objetivo:** Levantar PostgreSQL 16 y dejar `.env.example` documentado.
- **Archivos:** `docker-compose.yml`, `.env.example`, `README.md`
- **Instrucción IA:** Incluir healthcheck y volumen. No incluir secretos reales.
- **Verificación:** `docker compose up -d` y conexión a PostgreSQL.
- **Estimación:** 1.5 h

### T-006 — Configurar Jest, Supertest y base de pruebas

- **Fase:** 0
- **Depende de:** T-003, T-005
- **Req/AC:** NFR-006
- **Objetivo:** Dejar pruebas unitarias, de integración y e2e ejecutables.
- **Archivos:** `jest.config.ts`, `test/jest-e2e.json`, `test/setup.ts`, `package.json`
- **Instrucción IA:** Separar unit/integration/e2e; no mezclar base de producción con test.
- **Verificación:** `npm run test`, `npm run test:e2e` con un test trivial.
- **Estimación:** 1.5 h

### T-007 — Crear documentación base del paquete

- **Fase:** 0
- **Depende de:** T-002
- **Req/AC:** NFR-008
- **Objetivo:** Dejar `README.md`, `constitution.md` y `prompts.md` coherentes con la versión 1.2.0.
- **Archivos:** `README.md`, `constitution.md`, `prompts.md`
- **Instrucción IA:** No duplicar el contrato; enlazarlo. Registrar el prompt de generación.
- **Verificación:** Revisión de enlaces y consistencia de versiones.
- **Estimación:** 1 h

### T-008 — Crear el esqueleto de pruebas de contrato

- **Fase:** 0
- **Depende de:** T-006
- **Req/AC:** NFR-001, AC-043
- **Objetivo:** Cargar `openapi.yaml` y preparar `jest-openapi` para validar respuestas.
- **Archivos:** `test/contract/setup.ts`, `test/contract/README.md`, `package.json`
- **Instrucción IA:** Aún no escribir pruebas de endpoints; solo el harness y un caso de humo.
- **Verificación:** El matcher de contrato carga el YAML y falla con una respuesta inválida de prueba.
- **Estimación:** 1.5 h

---

## Fase 1 — Datos, dominio y errores

### T-009 — Modelar catálogos en Prisma

- **Fase:** 1
- **Depende de:** T-003, T-005
- **Req/AC:** FR-018, NFR-010
- **Objetivo:** Crear `empresas`, `sucursales`, `mesas`, `usuarios`, `clientes`, `cupones`, `listas_precio`.
- **Archivos:** `prisma/schema.prisma`
- **Instrucción IA:** Incluir FKs, `created_at`, `sla_minutos` y `timezone`; no crear endpoints.
- **Verificación:** `npx prisma validate` y `npx prisma format`.
- **Estimación:** 3 h

### T-010 — Modelar `ordenes` y enums

- **Fase:** 1
- **Depende de:** T-009
- **Req/AC:** FR-003…FR-012, NFR-010
- **Objetivo:** Crear la tabla `ordenes` con los 22 campos del contrato más `sla_minutos` interno.
- **Archivos:** `prisma/schema.prisma`
- **Instrucción IA:** Usar `numeric(12,2)`, `timestamptz`, enums y `@@unique([sucursal_id, numero_orden])`.
- **Verificación:** `prisma validate`; revisar que no falte ningún campo del contrato.
- **Estimación:** 3 h

### T-011 — Modelar `orden_secuencias`

- **Fase:** 1
- **Depende de:** T-010
- **Req/AC:** FR-006
- **Objetivo:** Agregar la tabla de contador atómico por sucursal y año.
- **Archivos:** `prisma/schema.prisma`
- **Instrucción IA:** `@@id([sucursal_id, anio])` o unique equivalente; `ultimo` entero.
- **Verificación:** `prisma validate` y revisión del índice.
- **Estimación:** 1 h

### T-012 — Crear la migración inicial

- **Fase:** 1
- **Depende de:** T-009…T-011
- **Req/AC:** NFR-007, NFR-010
- **Objetivo:** Generar y aplicar la migración inicial.
- **Archivos:** `prisma/migrations/**`
- **Instrucción IA:** No editar migraciones generadas a mano salvo revisión; no borrar datos.
- **Verificación:** `npx prisma migrate dev --name init`.
- **Estimación:** 1 h

### T-013 — Crear seeds de prueba

- **Fase:** 1
- **Depende de:** T-012
- **Req/AC:** NFR-006, NFR-007
- **Objetivo:** Sembrar 2 empresas, sucursales, mesas, meseros, clientes, cupones y órdenes.
- **Archivos:** `prisma/seed.ts`, `package.json`
- **Instrucción IA:** Hacer el seed idempotente; no usar datos reales.
- **Verificación:** `npx prisma db seed` dos veces sin errores.
- **Estimación:** 3 h

### T-014 — Implementar PrismaModule y PrismaService

- **Fase:** 1
- **Depende de:** T-012
- **Req/AC:** NFR-009
- **Objetivo:** Exponer Prisma de forma global con cierre limpio.
- **Archivos:** `src/prisma/prisma.module.ts`, `src/prisma/prisma.service.ts`
- **Instrucción IA:** `onModuleInit`, `enableShutdownHooks`; no lógica de negocio.
- **Verificación:** La app arranca y conecta a PostgreSQL.
- **Estimación:** 1 h

### T-015 — Implementar utilidades de dinero

- **Fase:** 1
- **Depende de:** T-014
- **Req/AC:** FR-005, BR-002…BR-005
- **Objetivo:** Centralizar conversión, redondeo y cálculo de IGV/total.
- **Archivos:** `src/common/money/money.ts`, `src/common/money/money.spec.ts`
- **Instrucción IA:** Usar `Prisma.Decimal`; redondeo `HALF_UP`; no `parseFloat` para cálculos.
- **Verificación:** Pruebas con 85.50, 100.00, 0.00 y descuentos.
- **Estimación:** 2 h

### T-016 — Implementar resolución de cupones

- **Fase:** 1
- **Depende de:** T-009, T-015
- **Req/AC:** FR-005, BR-002, BR-003
- **Objetivo:** Calcular descuento por porcentaje o monto fijo, con vigencia y tope.
- **Archivos:** `src/ordenes/domain/cupon.ts`, `src/ordenes/domain/cupon.spec.ts`
- **Instrucción IA:** Cupón inválido/vencido → 400; descuento nunca mayor al subtotal.
- **Verificación:** Pruebas de porcentaje, monto fijo, tope, vencido e inexistente.
- **Estimación:** 2 h

### T-017 — Implementar numeración de orden

- **Fase:** 1
- **Depende de:** T-011, T-014
- **Req/AC:** FR-006, BR-006
- **Objetivo:** Generar `ORD-AAAA-NNN` con contador atómico.
- **Archivos:** `src/ordenes/domain/numero-orden.ts`, `src/ordenes/domain/numero-orden.spec.ts`
- **Instrucción IA:** Upsert atómico; año en `America/Lima`; retry ante colisión.
- **Verificación:** Pruebas de formato, cambio de año y concurrencia básica.
- **Estimación:** 2.5 h

### T-018 — Implementar máquina de estados

- **Fase:** 1
- **Depende de:** T-010
- **Req/AC:** FR-011, BR-008…BR-011
- **Objetivo:** Centralizar transiciones válidas y timestamps.
- **Archivos:** `src/ordenes/domain/estado-machine.ts`, `src/ordenes/domain/estado-machine.spec.ts`
- **Instrucción IA:** No permitir saltos, retrocesos, mismo estado ni `ANULADO` por PATCH.
- **Verificación:** Matriz de transiciones válidas e inválidas.
- **Estimación:** 2 h

### T-019 — Implementar política de SLA

- **Fase:** 1
- **Depende de:** T-010
- **Req/AC:** FR-020, BR-017
- **Objetivo:** Calcular `alerta_sla` con snapshot de `sla_minutos`.
- **Archivos:** `src/ordenes/domain/sla.ts`, `src/ordenes/domain/sla.spec.ts`
- **Instrucción IA:** Solo estados activos; usar tiempo de base de datos; finales siempre false.
- **Verificación:** Pruebas con límites, estados finales y borde exacto.
- **Estimación:** 1.5 h

### T-020 — Definir tipos Problem Details y mapa de títulos

- **Fase:** 1
- **Depende de:** T-003
- **Req/AC:** FR-013, AC-037
- **Objetivo:** Crear `ProblemDetails`, constantes y `status → title`.
- **Archivos:** `src/common/errors/problem-details.types.ts`, `src/common/errors/http-status-title.ts`
- **Instrucción IA:** `type = about:blank`; title desde `STATUS_CODES`; no inventar campos.
- **Verificación:** Unit test del mapa 400/401/404/409/500.
- **Estimación:** 1 h

### T-021 — Implementar excepción y factory de validación

- **Fase:** 1
- **Depende de:** T-020
- **Req/AC:** FR-013, FR-021, AC-038
- **Objetivo:** Unificar errores de dominio y de `class-validator` en un `detail` string.
- **Archivos:** `src/common/errors/problem-details.exception.ts`, `src/common/errors/validation-exception.factory.ts`
- **Instrucción IA:** Arrays de mensajes → `join('; ')`; no devolver arrays.
- **Verificación:** Pruebas con uno y varios mensajes.
- **Estimación:** 1.5 h

### T-022 — Implementar el filtro global Problem Details

- **Fase:** 1
- **Depende de:** T-020, T-021
- **Req/AC:** FR-013, FR-017, AC-037, AC-039
- **Objetivo:** Capturar excepciones y responder `application/problem+json`.
- **Archivos:** `src/common/errors/problem-details.filter.ts`, `src/app.module.ts`
- **Instrucción IA:** Fijar content type; `status` = HTTP; 500 genérico; no stack al cliente.
- **Verificación:** E2E de humo con 400, 401, 404, 409 y 500 simulado.
- **Estimación:** 2 h

### T-023 — Implementar mapper de Orden

- **Fase:** 1
- **Depende de:** T-010, T-014
- **Req/AC:** FR-015, AC-024
- **Objetivo:** Convertir Prisma → respuesta exacta del contrato.
- **Archivos:** `src/ordenes/ordenes.mapper.ts`, `src/ordenes/ordenes.mapper.spec.ts`
- **Instrucción IA:** `snake_case`, 22 campos, `null` explícitos, `Decimal → Number`, fechas ISO, sin `sla_minutos`.
- **Verificación:** Snapshot del JSON y pruebas de tipos.
- **Estimación:** 2 h

### T-024 — Pruebas unitarias del dominio y errores

- **Fase:** 1
- **Depende de:** T-015…T-023
- **Req/AC:** NFR-006
- **Objetivo:** Cubrir dinero, cupón, numeración, estados, SLA, mapper y filtro.
- **Archivos:** `test/unit/**`
- **Instrucción IA:** Cubrir bordes y errores, no solo caminos felices.
- **Verificación:** `npm run test:unit` con cobertura de dominio ≥ 90 %.
- **Estimación:** 3 h

---

## Fase 2 — Autenticación y multitenencia

### T-025 — Configurar JWT y validación de entorno

- **Fase:** 2
- **Depende de:** T-003
- **Req/AC:** FR-001, FR-002, NFR-004
- **Objetivo:** Cargar secreto, issuer, audience y expiración desde entorno.
- **Archivos:** `src/config/*`, `.env.example`
- **Instrucción IA:** Fallar al arrancar si falta un valor obligatorio; no hardcodear secretos.
- **Verificación:** Arranque con `.env` válido y error con uno inválido.
- **Estimación:** 1.5 h

### T-026 — Implementar estrategia y claims del JWT

- **Fase:** 2
- **Depende de:** T-025
- **Req/AC:** FR-001, FR-002
- **Objetivo:** Validar firma, expiración y claim `empresa_id`.
- **Archivos:** `src/auth/jwt.strategy.ts`, `src/auth/tenant-context.ts`
- **Instrucción IA:** Rechazar token sin `empresa_id`; no confiar en headers alternativos.
- **Verificación:** Unit test con token válido, expirado, firma inválida y sin claim.
- **Estimación:** 2 h

### T-027 — Implementar guard global y decorador público

- **Fase:** 2
- **Depende de:** T-026
- **Req/AC:** FR-001
- **Objetivo:** Proteger todas las rutas salvo salud/documentación.
- **Archivos:** `src/auth/jwt-auth.guard.ts`, `src/auth/public.decorator.ts`, `src/app.module.ts`
- **Instrucción IA:** El guard no debe contener reglas de negocio.
- **Verificación:** 401 sin token; 200 con token en ruta de prueba.
- **Estimación:** 1.5 h

### T-028 — Implementar contexto de tenant

- **Fase:** 2
- **Depende de:** T-026
- **Req/AC:** FR-002
- **Objetivo:** Exponer `empresa_id` al controller mediante decorador.
- **Archivos:** `src/common/decorators/current-tenant.decorator.ts`
- **Instrucción IA:** Tipar el request; no usar `any` global.
- **Verificación:** Test unitario del decorador.
- **Estimación:** 1 h

### T-029 — Implementar patrón de repositorio con tenant obligatorio

- **Fase:** 2
- **Depende de:** T-014, T-028
- **Req/AC:** FR-002, BR-014, BR-015
- **Objetivo:** Ninguna consulta de órdenes puede omitir `empresa_id`.
- **Archivos:** `src/ordenes/ordenes.repository.ts`
- **Instrucción IA:** Métodos como `findById(id, empresaId)`; prohibido `findById(id)`.
- **Verificación:** Revisión de firmas y pruebas de aislamiento básicas.
- **Estimación:** 2 h

### T-030 — Mapear errores de autenticación a 401

- **Fase:** 2
- **Depende de:** T-022, T-027
- **Req/AC:** FR-001, FR-013, AC-036
- **Objetivo:** Asegurar problem+json en token ausente, inválido o expirado.
- **Archivos:** `src/auth/*`, `src/common/errors/*`
- **Instrucción IA:** `detail` claro; sin filtrar detalles de criptografía.
- **Verificación:** E2E de 401 en las 7 rutas.
- **Estimación:** 1.5 h

### T-031 — Crear harness de autenticación y aislamiento

- **Fase:** 2
- **Depende de:** T-027, T-029
- **Req/AC:** AC-044
- **Objetivo:** Generar tokens de empresa A/B y datos de prueba.
- **Archivos:** `test/helpers/auth.ts`, `test/helpers/factories.ts`
- **Instrucción IA:** Nunca usar tokens de producción; datos deterministas.
- **Verificación:** Test de humo que confirma que A no ve datos de B.
- **Estimación:** 2 h

---

## Fase 3 — Endpoints

### T-032 — Implementar creación de orden de salón

- **Fase:** 3
- **Depende de:** T-015…T-023, T-029, T-031
- **Req/AC:** FR-003, FR-005…FR-007, FR-014, FR-018, AC-001…AC-005
- **Objetivo:** DTO, servicio, controller y `Location` para `POST /ordenes/salon`.
- **Archivos:** `src/ordenes/dto/crear-orden-salon.dto.ts`, `src/ordenes/ordenes.service.ts`, `src/ordenes/ordenes.controller.ts`
- **Instrucción IA:** Fijar `origen=SALON`; validar referencias; transacción; no aceptar campos calculados.
- **Verificación:** E2E feliz + 400 + 401; revisar 201 y `Location`.
- **Estimación:** 4 h

### T-033 — E2E de creación de salón

- **Fase:** 3
- **Depende de:** T-032
- **Req/AC:** AC-001…AC-005, AC-040, AC-042
- **Objetivo:** Cubrir éxito, validaciones, tenant y campos extra.
- **Archivos:** `test/e2e/ordenes-salon.e2e-spec.ts`
- **Instrucción IA:** Probar 400 por DTO, UUID, referencia cruzada y campos readOnly.
- **Verificación:** `npm run test:e2e -- salon`.
- **Estimación:** 2 h

### T-034 — Implementar creación de delivery/LLEVAR

- **Fase:** 3
- **Depende de:** T-032
- **Req/AC:** FR-004, FR-005…FR-007, FR-018, AC-006…AC-012
- **Objetivo:** DTO, servicio, controller y `Location` para `POST /ordenes/delivery`.
- **Archivos:** `src/ordenes/dto/crear-orden-delivery.dto.ts`, `src/ordenes/ordenes.service.ts`, `src/ordenes/ordenes.controller.ts`
- **Instrucción IA:** `cliente_id` obligatorio en DELIVERY; mesa/mesero null; `origen` solo LLEVAR/DELIVERY.
- **Verificación:** E2E feliz + reglas de cliente + 400.
- **Estimación:** 3 h

### T-035 — E2E de creación de delivery/LLEVAR

- **Fase:** 3
- **Depende de:** T-034
- **Req/AC:** AC-006…AC-012, AC-040
- **Objetivo:** Cubrir ambos orígenes, cliente obligatorio y campos nulos.
- **Archivos:** `test/e2e/ordenes-delivery.e2e-spec.ts`
- **Instrucción IA:** Probar `SALON` como origen inválido y `LLEVAR` sin cliente.
- **Verificación:** `npm run test:e2e -- delivery`.
- **Estimación:** 2 h

### T-036 — Implementar listado de órdenes

- **Fase:** 3
- **Depende de:** T-023, T-029, T-031
- **Req/AC:** FR-008, FR-019, FR-021, AC-015…AC-018, AC-024
- **Objetivo:** Query DTO, filtros, paginación y orden determinista.
- **Archivos:** `src/ordenes/dto/listar-ordenes.query.ts`, `src/ordenes/ordenes.service.ts`, `src/ordenes/ordenes.controller.ts`
- **Instrucción IA:** Filtros opcionales; `desde <= hasta`; `total_pages` correcto; solo tenant.
- **Verificación:** E2E con dos empresas y filtros combinados.
- **Estimación:** 4 h

### T-037 — E2E de listado

- **Fase:** 3
- **Depende de:** T-036
- **Req/AC:** AC-015…AC-018, AC-024
- **Objetivo:** Cubrir paginación, filtros, orden, metadatos y validaciones.
- **Archivos:** `test/e2e/ordenes-list.e2e-spec.ts`
- **Instrucción IA:** Incluir página fuera de rango y fechas inclusivas.
- **Verificación:** `npm run test:e2e -- list`.
- **Estimación:** 3 h

### T-038 — Implementar alertas SLA

- **Fase:** 3
- **Depende de:** T-019, T-036
- **Req/AC:** FR-009, FR-020, AC-019…AC-021
- **Objetivo:** Endpoint `GET /ordenes/alertas` con filtro SQL y ruta antes de `/:id`.
- **Archivos:** `src/ordenes/dto/listar-alertas.query.ts`, `src/ordenes/ordenes.service.ts`, `src/ordenes/ordenes.controller.ts`
- **Instrucción IA:** Solo estados activos; no cargar todo en memoria; respetar tenant.
- **Verificación:** E2E con órdenes vencidas, entregadas y anuladas.
- **Estimación:** 3 h

### T-039 — E2E de alertas SLA

- **Fase:** 3
- **Depende de:** T-038
- **Req/AC:** AC-019…AC-021
- **Objetivo:** Confirmar filtro, paginación y precedencia de ruta.
- **Archivos:** `test/e2e/ordenes-alertas.e2e-spec.ts`
- **Instrucción IA:** Probar `/ordenes/alertas` y que no se resuelva como UUID.
- **Verificación:** `npm run test:e2e -- alertas`.
- **Estimación:** 2 h

### T-040 — Implementar detalle de orden

- **Fase:** 3
- **Depende de:** T-023, T-029
- **Req/AC:** FR-010, FR-015, AC-022…AC-024
- **Objetivo:** `GET /ordenes/{id}` con tenant y 404.
- **Archivos:** `src/ordenes/ordenes.service.ts`, `src/ordenes/ordenes.controller.ts`
- **Instrucción IA:** No revelar existencia de otra empresa; validar UUID.
- **Verificación:** E2E 200, 404 inexistente y 404 cross-tenant.
- **Estimación:** 2 h

### T-041 — E2E de detalle

- **Fase:** 3
- **Depende de:** T-040
- **Req/AC:** AC-022…AC-024
- **Objetivo:** Cubrir 200, 401, 404, serialización y campos internos ausentes.
- **Archivos:** `test/e2e/ordenes-detail.e2e-spec.ts`
- **Instrucción IA:** Verificar que no aparezca `sla_minutos`.
- **Verificación:** `npm run test:e2e -- detail`.
- **Estimación:** 1.5 h

### T-042 — Implementar actualización de estado

- **Fase:** 3
- **Depende de:** T-018, T-029
- **Req/AC:** FR-011, BR-008…BR-011, AC-025…AC-031
- **Objetivo:** DTO, servicio y controller para `PATCH /ordenes/{id}/estado`.
- **Archivos:** `src/ordenes/dto/actualizar-estado.dto.ts`, `src/ordenes/ordenes.service.ts`, `src/ordenes/ordenes.controller.ts`
- **Instrucción IA:** UPDATE condicional; timestamps; 409 en transición inválida; 400 en enum inválido.
- **Verificación:** E2E de cada transición y errores.
- **Estimación:** 4 h

### T-043 — E2E de actualización de estado

- **Fase:** 3
- **Depende de:** T-042
- **Req/AC:** AC-025…AC-031, AC-035
- **Objetivo:** Cubrir flujo completo, saltos, retrocesos, mismo estado y cross-tenant.
- **Archivos:** `test/e2e/ordenes-estado.e2e-spec.ts`
- **Instrucción IA:** Verificar timestamps y códigos.
- **Verificación:** `npm run test:e2e -- estado`.
- **Estimación:** 3 h

### T-044 — Implementar anulación lógica

- **Fase:** 3
- **Depende de:** T-029
- **Req/AC:** FR-012, BR-010, BR-011, AC-032…AC-035
- **Objetivo:** `DELETE /ordenes/{id}` con 204 y 409.
- **Archivos:** `src/ordenes/ordenes.service.ts`, `src/ordenes/ordenes.controller.ts`
- **Instrucción IA:** UPDATE condicional; no borrar; no devolver body en 204.
- **Verificación:** E2E 204, 409 y 404.
- **Estimación:** 2.5 h

### T-045 — E2E de anulación

- **Fase:** 3
- **Depende de:** T-044
- **Req/AC:** AC-032…AC-035, AC-041
- **Objetivo:** Cubrir activa, entregada, ya anulada, inexistente y cross-tenant.
- **Archivos:** `test/e2e/ordenes-delete.e2e-spec.ts`
- **Instrucción IA:** Verificar 204 sin body y content type ausente/irrelevante.
- **Verificación:** `npm run test:e2e -- delete`.
- **Estimación:** 2 h

---

## Fase 4 — Contrato y pruebas transversales

### T-046 — Integrar Redocly lint en el flujo

- **Fase:** 4
- **Depende de:** T-001
- **Req/AC:** NFR-001
- **Objetivo:** Fallar el CI si el contrato no lintéa.
- **Archivos:** `package.json`, `.github/workflows/ci.yml` o script equivalente
- **Instrucción IA:** No corregir el YAML sin aprobación; solo reportar.
- **Verificación:** `npm run lint:openapi`.
- **Estimación:** 1 h

### T-047 — Configurar validación de contrato de respuestas

- **Fase:** 4
- **Depende de:** T-008, T-032…T-045
- **Req/AC:** NFR-001, AC-043
- **Objetivo:** Validar respuestas reales contra el OpenAPI.
- **Archivos:** `test/contract/**`, `jest.config.ts`
- **Instrucción IA:** Usar `jest-openapi`; cubrir content type y esquema.
- **Verificación:** Una respuesta alterada hace fallar el test.
- **Estimación:** 2 h

### T-048 — Contract tests de respuestas exitosas

- **Fase:** 4
- **Depende de:** T-047
- **Req/AC:** AC-043
- **Objetivo:** Cubrir 200 y 201 de las 7 operaciones.
- **Archivos:** `test/contract/success.e2e-spec.ts`
- **Instrucción IA:** Verificar `Orden`, `OrdenList` y `Location`.
- **Verificación:** `npm run test:contract`.
- **Estimación:** 2.5 h

### T-049 — Contract tests de errores Problem Details

- **Fase:** 4
- **Depende de:** T-047
- **Req/AC:** AC-037…AC-039
- **Objetivo:** Validar `application/problem+json` y el esquema `Error`.
- **Archivos:** `test/contract/errors.e2e-spec.ts`
- **Instrucción IA:** Verificar `type`, `title`, `status`, `detail`; ausencia de campos antiguos.
- **Verificación:** `npm run test:contract -- errors`.
- **Estimación:** 2 h

### T-050 — Matriz de aislamiento multiempresa

- **Fase:** 4
- **Depende de:** T-031, T-045
- **Req/AC:** AC-044
- **Objetivo:** Probar las 7 operaciones con empresas A y B.
- **Archivos:** `test/e2e/tenant-isolation.e2e-spec.ts`
- **Instrucción IA:** Listados, detalle, patch, delete y alertas; body refs cruzadas.
- **Verificación:** 0 accesos cruzados.
- **Estimación:** 3 h

### T-051 — Pruebas de concurrencia

- **Fase:** 4
- **Depende de:** T-032, T-042, T-044
- **Req/AC:** AC-014, NFR-003
- **Objetivo:** Validar numeración y transiciones bajo concurrencia.
- **Archivos:** `test/e2e/concurrency.e2e-spec.ts`
- **Instrucción IA:** 50 creaciones; dos PATCH simultáneos; dos DELETE simultáneos.
- **Verificación:** 0 duplicados; un 200 y un 409; un 204 y un 409.
- **Estimación:** 3 h

### T-052 — Pruebas de serialización

- **Fase:** 4
- **Depende de:** T-023
- **Req/AC:** FR-015, AC-024
- **Objetivo:** Verificar 22 campos, tipos, nulls, fechas y `snake_case`.
- **Archivos:** `test/unit/ordenes.mapper.spec.ts`, `test/e2e/serialization.e2e-spec.ts`
- **Instrucción IA:** Montos como número; sin `sla_minutos`; sin camelCase.
- **Verificación:** Snapshot y aserciones de tipo.
- **Estimación:** 2 h

### T-053 — Pruebas de semántica HTTP

- **Fase:** 4
- **Depende de:** T-033, T-045
- **Req/AC:** AC-040…AC-042
- **Objetivo:** Verificar 201 + Location, 204 sin body y content types.
- **Archivos:** `test/e2e/http-semantics.e2e-spec.ts`
- **Instrucción IA:** Location `/api/v1/ordenes/{id}`; 204 sin body; éxito JSON.
- **Verificación:** `npm run test:e2e -- http`.
- **Estimación:** 2 h

### T-054 — Prueba de precedencia de rutas y smoke de rendimiento

- **Fase:** 4
- **Depende de:** T-038
- **Req/AC:** AC-021, NFR-002
- **Objetivo:** Confirmar `/alertas` y medir listados/creación.
- **Archivos:** `test/e2e/route-order.e2e-spec.ts`, `scripts/perf/*`
- **Instrucción IA:** No optimizar prematuramente; registrar resultados base.
- **Verificación:** Ruta correcta y p95 dentro del objetivo con datos de prueba.
- **Estimación:** 2 h

---

## Fase 5 — Hardening y entrega

### T-055 — Configurar Helmet, CORS y límite de body

- **Fase:** 5
- **Depende de:** T-003
- **Req/AC:** NFR-004
- **Objetivo:** Aplicar controles HTTP básicos.
- **Archivos:** `src/main.ts`, `src/config/*`
- **Instrucción IA:** Configurar por entorno; no romper Swagger.
- **Verificación:** Headers presentes y API funcional.
- **Estimación:** 1.5 h

### T-056 — Decidir rate limiting y 429

- **Fase:** 5
- **Depende de:** T-002
- **Req/AC:** NFR-004, A-16
- **Objetivo:** Definir si el rate limit va en app o gateway.
- **Archivos:** `plan.md`, `prompts.md`, `src/main.ts` (si aplica)
- **Instrucción IA:** No implementar 429 en la app sin aprobación; documentar la decisión.
- **Verificación:** Decisión registrada y consistente con el contrato.
- **Estimación:** 1 h

### T-057 — Configurar logs estructurados y request ID

- **Fase:** 5
- **Depende de:** T-022
- **Req/AC:** FR-022, NFR-005
- **Objetivo:** Correlacionar peticiones y errores sin filtrar secretos.
- **Archivos:** `src/common/http/request-id.middleware.ts`, `src/main.ts`
- **Instrucción IA:** `X-Request-Id`; redacción de tokens; logs JSON.
- **Verificación:** Header presente y logs con ID.
- **Estimación:** 2 h

### T-058 — Publicar Swagger/Redoc sobre el contrato canónico

- **Fase:** 5
- **Depende de:** T-003
- **Req/AC:** NFR-008
- **Objetivo:** Documentación interactiva sin duplicar el contrato.
- **Archivos:** `src/main.ts`, `docs/*`
- **Instrucción IA:** Servir `openapi.yaml`; no generar un segundo contrato.
- **Verificación:** `/api/docs` carga y muestra las 7 operaciones.
- **Estimación:** 2 h

### T-059 — Escribir runbook de ejecución

- **Fase:** 5
- **Depende de:** T-005, T-012, T-013
- **Req/AC:** NFR-007
- **Objetivo:** Permitir levantar el API desde cero.
- **Archivos:** `README-IMPLEMENTACION.md` o sección del README
- **Instrucción IA:** Incluir env, docker, migraciones, seeds, tests y Swagger.
- **Verificación:** Un usuario nuevo sigue los pasos sin ayuda.
- **Estimación:** 2 h

### T-060 — Configurar pipeline CI

- **Fase:** 5
- **Depende de:** T-004, T-006, T-046, T-047
- **Req/AC:** NFR-001, NFR-006
- **Objetivo:** Ejecutar lint, typecheck, unit, integration, e2e y contract.
- **Archivos:** `.github/workflows/ci.yml` o equivalente
- **Instrucción IA:** PostgreSQL como servicio; migraciones y seeds antes de e2e.
- **Verificación:** Pipeline verde en un PR de prueba.
- **Estimación:** 3 h

### T-061 — Checklist OWASP API Top 10

- **Fase:** 5
- **Depende de:** T-055…T-057
- **Req/AC:** NFR-004
- **Objetivo:** Revisar los riesgos principales del API.
- **Archivos:** `docs/security-checklist.md`
- **Instrucción IA:** Identificar riesgos y mitigaciones; no implementar cambios no aprobados.
- **Verificación:** Checklist completo con estado y evidencia.
- **Estimación:** 2 h

### T-062 — Revisión de dependencias y build final

- **Fase:** 5
- **Depende de:** T-060
- **Req/AC:** NFR-009
- **Objetivo:** Eliminar dependencias innecesarias y confirmar build.
- **Archivos:** `package.json`, `package-lock.json`
- **Instrucción IA:** No actualizar versiones mayores sin aprobación.
- **Verificación:** `npm run build`, `npm run lint`, `npm run test` en verde.
- **Estimación:** 1.5 h

---

## Fase 6 — Revisión y handoff

### T-063 — Completar matriz de trazabilidad

- **Fase:** 6
- **Depende de:** T-045
- **Req/AC:** NFR-001
- **Objetivo:** Mapear `operationId ↔ FR ↔ AC ↔ tarea`.
- **Archivos:** `spec.md`, `tasks.md`, `revision.md` (borrador)
- **Instrucción IA:** Detectar requisitos sin cobertura o tareas sin requisito.
- **Verificación:** 7/7 operaciones y 100 % de FR cubiertos.
- **Estimación:** 1.5 h

### T-064 — Verificar Definition of Done

- **Fase:** 6
- **Depende de:** T-062
- **Req/AC:** NFR-001…NFR-010
- **Objetivo:** Revisar la lista de terminado de `constitution.md` y `plan.md`.
- **Archivos:** `revision.md`
- **Instrucción IA:** No marcar ítems sin evidencia.
- **Verificación:** Checklist con evidencia y pendientes.
- **Estimación:** 1 h

### T-065 — Preparar paquete de evidencia

- **Fase:** 6
- **Depende de:** T-060, T-064
- **Req/AC:** NFR-006
- **Objetivo:** Reunir reportes de tests, cobertura, contrato y CI.
- **Archivos:** `revision.md`, `docs/evidence/*`
- **Instrucción IA:** Enlaces o capturas de resultados; no inventar métricas.
- **Verificación:** Evidencia reproducible.
- **Estimación:** 1.5 h

### T-066 — Registrar supuestos y decisiones finales

- **Fase:** 6
- **Depende de:** T-002
- **Req/AC:** A-01…A-20
- **Objetivo:** Cerrar la tabla de supuestos con decisión y justificación.
- **Archivos:** `spec.md`, `revision.md`
- **Instrucción IA:** Distinguir aceptado, corregido y diferido.
- **Verificación:** Ningún supuesto queda sin estado.
- **Estimación:** 1 h

### T-067 — Registrar fallos y aprendizajes de la IA

- **Fase:** 6
- **Depende de:** T-007
- **Req/AC:** —
- **Objetivo:** Documentar dónde la IA se equivocó o inventó alcance.
- **Archivos:** `prompts.md`, `revision.md`
- **Instrucción IA:** Ser concreto: prompt, salida, corrección humana, lección.
- **Verificación:** Al menos 5 entradas con evidencia.
- **Estimación:** 1.5 h

### T-068 — Preparar checklist de revisión

- **Fase:** 6
- **Depende de:** T-063…T-067
- **Req/AC:** NFR-001
- **Objetivo:** Dejar `revision.md` listo para la revisión humana.
- **Archivos:** `revision.md`
- **Instrucción IA:** Incluir contrato, errores, tenant, HTTP, seguridad, pruebas y supuestos.
- **Verificación:** Checklist completo y firmable.
- **Estimación:** 1.5 h

### T-069 — Handoff y firma

- **Fase:** 6
- **Depende de:** T-068
- **Req/AC:** —
- **Objetivo:** Cerrar la fase con revisión humana y próximos pasos.
- **Archivos:** `revision.md`, `README.md`
- **Instrucción IA:** No firmar por la persona; solo preparar el espacio.
- **Verificación:** Aprobación registrada y pendientes identificados.
- **Estimación:** 0.5 h

---

## 4. Gates de revisión

| Gate | Después de | Criterio |
|---|---|---|
| G0 | Fase 0 | Contrato validado, proyecto base y supuestos congelados |
| G1 | Fase 1 | Migraciones, seeds, dominio y errores con unit tests |
| G2 | Fase 2 | 401 y aislamiento básico funcionando |
| G3 | Fase 3 | 7/7 endpoints con e2e |
| G4 | Fase 4 | Contract tests, concurrencia y serialización |
| G5 | Fase 5 | CI, seguridad, docs y runbook |
| G6 | Fase 6 | Evidencia, revisión y firma |

Cada gate exige revisión humana del diff y de los resultados. No se avanza con deuda crítica sin registrar.

---

## 5. Registro obligatorio en `prompts.md`

Por cada tarea:

| Campo | Contenido |
|---|---|
| Tarea | `T-XXX` |
| Prompt | Texto o resumen fiel |
| Salida IA | Archivos y resumen |
| Correcciones | Qué cambió la persona |
| Lección | Qué falló o qué funcionó |

Este registro alimenta la reflexión final **“¿dónde falló la IA?”**.
