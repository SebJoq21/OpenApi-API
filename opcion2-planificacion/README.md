# Opción 2 — Especificación, plan y tareas con IA

**Curso:** Taller de Construcción de Software Web — Ciclo 2026-II
**Entidad de negocio:** Orden (22 columnas)
**Contrato de referencia:** [`../openapi.yaml`](../openapi.yaml) — versión **1.2.0**
**Enfoque:** Spec-Driven Development (SDD) / Spec-first con IA
**Alcance:** únicamente la opción 2. La opción 1 y su código no se tocan.

---

## 1. ¿Qué contiene esta carpeta?

Esta carpeta contiene el **paquete de planificación** y la **implementación real** del API. La planificación permite construirlo de forma trazable, revisable y verificable contra el contrato OpenAPI; la implementación demuestra que el proceso SDD produce un API funcional.

| Archivo / carpeta | Pregunta que responde | Uso |
|---|---|---|
| `README.md` | ¿Qué es esto y cómo se usa? | Punto de entrada |
| `constitution.md` | ¿Qué reglas debe respetar la IA y el equipo? | Contexto obligatorio para cada tarea |
| `spec.md` | ¿Qué debe hacer el API? | Especificación funcional y criterios de aceptación |
| `plan.md` | ¿Cómo se construye? | Arquitectura, datos, algoritmos y pruebas |
| `tasks.md` | ¿Qué se hace primero y cómo se verifica? | Backlog atómico para ejecutar con IA |
| `prompts.md` | ¿Qué se le pidió a la IA y qué corregimos? | Bitácora para la revisión y la reflexión final |
| `revision.md` | ¿Cumple la implementación con el contrato? | Revisión con evidencia de código y pruebas |
| `api/` | ¿Cómo se ejecuta y se demuestra? | Implementación NestJS + PostgreSQL + Prisma |

> `api/README.md` contiene el arranque, la generación de tokens y el flujo de demo en Swagger.

---

## 2. Idea central: Spec-Driven Development

La opción 2 no consiste en “pedirle código a la IA”. Consiste en construir primero una especificación clara y verificable, y recién después usarla como entrada para el plan, las tareas y la implementación.

```text
openapi.yaml
     │
     ▼
  spec.md          ← QUÉ debe hacer el API, reglas y criterios de aceptación
     │
     ▼
  plan.md          ← CÓMO construirlo: arquitectura, datos, pruebas
     │
     ▼
  tasks.md         ← tareas atómicas, prompts y verificación
     │
     ▼
  api/             ← implementación NestJS + PostgreSQL + Prisma
     │
     ▼
  revisión         ← ¿el paquete y el código cumplen el contrato?
     │
     ▼
  comparación      ← opción 1 vs opción 2 (se hace al final)
```

La diferencia con un enfoque code-first es que aquí **el contrato manda**. La IA propone; la persona decide y revisa. Las pruebas unitarias, e2e, de contrato y el smoke test verifican que la implementación real no se aleje del `openapi.yaml`.

---

## 3. Orden de lectura recomendado

1. `constitution.md` — reglas del proyecto.
2. `spec.md` — qué se va a construir y qué se acepta como correcto.
3. `plan.md` — cómo se resuelve técnicamente.
4. `tasks.md` — cómo se ejecuta paso a paso.
5. `api/README.md` — cómo se ejecuta y se demuestra.
6. `revision.md` — evidencia, hallazgos y veredicto.
7. `prompts.md` — qué se le pidió a la IA y qué se corrigió.

Para una revisión rápida, leer primero:

- La tabla de las 7 operaciones en `spec.md`.
- La tabla de supuestos `A-01..A-20` en `spec.md`.
- La tabla de trazabilidad `operationId ↔ FR ↔ AC`.
- Las decisiones abiertas al final de `plan.md`.

---

## 4. Las 7 operaciones del contrato

| # | Método | Ruta | `operationId` | Propósito |
|---|---|---|---|---|
| 1 | POST | `/ordenes/salon` | `crearOrdenSalon` | Crear orden de salón |
| 2 | POST | `/ordenes/delivery` | `crearOrdenDelivery` | Crear orden de delivery o para llevar |
| 3 | GET | `/ordenes` | `listarOrdenes` | Listar con filtros y paginación |
| 4 | GET | `/ordenes/alertas` | `listarOrdenesAlertaSla` | Listar órdenes con SLA excedido |
| 5 | GET | `/ordenes/{id}` | `obtenerOrden` | Obtener detalle |
| 6 | PATCH | `/ordenes/{id}/estado` | `actualizarEstadoOrden` | Avanzar el estado |
| 7 | DELETE | `/ordenes/{id}` | `anularOrden` | Anular lógicamente |

La entidad **Orden** tiene 22 columnas, por lo que cumple el requisito de “más de 10 columnas”.

---

## 5. Decisiones clave del paquete

| Tema | Decisión |
|---|---|
| Fuente de verdad | `openapi.yaml` v1.2.0. No se modifica ni se duplica. |
| Multitenencia | `empresa_id` sale siempre del JWT; nunca del body ni de la URL. |
| Errores | `application/problem+json` (RFC 7807/9457) con `type`, `title`, `status`, `detail`. |
| Cálculos | El servidor calcula descuento, IGV y total; el cliente no los envía. |
| Numeración | `ORD-AAAA-NNN`, única por sucursal, generada con contador atómico. |
| Estados | Flujo estricto; sin saltos ni retrocesos; `ANULADO` solo por `DELETE`. |
| SLA | Se calcula en lectura; solo órdenes en estados activos generan alerta. |
| `DELETE` repetido | Devuelve 409 según el contrato, aunque la buena práctica REST sugiera idempotencia. Se documenta la tensión. |
| `201 Created` | Se añade el header `Location`, buena práctica HTTP que no cambia el body. |
| Correlación | `X-Request-Id` en headers y logs; no se agrega `traceId` al body porque el contrato no lo define. |

Los detalles y las justificaciones están en `spec.md` y `plan.md`.

---

## 6. IA y persona: quién hace qué

| Fase | La IA puede | La persona debe |
|---|---|---|
| Diseño | Borrador de spec y modelos | Decidir recursos, reglas y alcance |
| Documentación | Descripciones y ejemplos | Validar precisión y consistencia |
| Código | Controllers, DTO, services, tests | Revisar arquitectura y seguridad |
| Pruebas | Casos y datos | Definir criterios de aceptación |
| Seguridad | Detectar patrones inseguros | Validar contra OWASP API Top 10 |
| Operación | Resumir logs y alertas | Decidir la acción |

La IA no puede, por sí sola:

- Cambiar el `openapi.yaml`.
- Añadir endpoints, campos, estados o códigos HTTP no aprobados.
- Inventar reglas para cupones, SLA o numeración.
- Ocultar una ambigüedad “resolviéndola” sin dejar registro.

---

## 7. Cómo se usa este paquete con un asistente de código

Cada tarea de `tasks.md` se ejecuta **una por vez** con este contexto:

1. `constitution.md`.
2. `openapi.yaml`.
3. La sección relevante de `spec.md` y `plan.md`.
4. La tarea exacta de `tasks.md`.
5. El formato de salida esperado.

El prompt base está en `prompts.md` y en la cabecera de `tasks.md`. Regla de oro:

> Si el contrato y la instrucción entran en conflicto, la IA se detiene y pregunta. No “mejora” el contrato por iniciativa propia.

---

## 8. Implementación y demo

La implementación está en `api/` y sigue el contrato `openapi.yaml` 1.2.0.

| Dato | Valor |
|---|---|
| Stack | NestJS 11 + TypeScript + PostgreSQL 18 + Prisma 6 |
| API | `http://localhost:3000/api/v1` |
| Swagger | `http://localhost:3000/api/docs` |
| PostgreSQL | `localhost:5433` |
| Contrato | `openapi.yaml` 1.2.0 |

### Arranque

```powershell
cd opcion2-planificacion/api
npm install
npm run db:local:init
npm run prisma:migrate
npm run seed
npm run start:dev
```

Si PostgreSQL ya está inicializado:

```powershell
npm run db:local:start
npm run start:dev
```

### Token de demo

```powershell
npm run token -- 11111111-1111-4111-8111-111111111111
```

### Demo en Swagger

1. Abrir `http://localhost:3000/api/docs`.
2. Clic en **Authorize** y pegar el token.
3. Crear una orden de salón con cupón.
4. Mostrar `201`, `Location`, `PENDIENTE`, IGV 16.20 y total 106.20.
5. Intentar `DELIVERY` sin cliente → `400` problem+json.
6. Listar, consultar alertas y detalle.
7. Avanzar estado y provocar un salto → `409`.
8. Anular → `204`; anular de nuevo → `409`.
9. Consultar una orden de otra empresa → `404`.

### Evidencia de pruebas

| Suite | Resultado |
|---|---|
| Unitarias | 20/20 |
| E2E | 16/16 |
| Contrato OpenAPI | 10/10 |
| Smoke funcional | 31/31 |
| Build de producción | OK |
| Lint del contrato | Válido, 2 warnings (license y localhost) |

Los comandos y el detalle están en `api/README.md` y en `revision.md`.

---

## 9. Qué queda fuera de esta carpeta

- El código de la opción 1 (`opcion1-codigo-directo/`).
- La comparación entre opción 1 y opción 2.
- Los endpoints de autenticación, catálogos, cupones, webhooks o reportes que no están en el contrato.
- Roles y scopes: el contrato solo exige JWT con `empresa_id`.
- CI, pruebas de performance y checklist OWASP completo: quedan como pendientes no bloqueantes.

---

## 10. Estado

- **Versión del paquete:** 1.1
- **Contrato:** `openapi.yaml` 1.2.0
- **Planificación:** completa.
- **Implementación:** completa para demo; 7/7 operaciones.
- **Pruebas:** unitarias, e2e, contrato y smoke en verde.
- **Revisión:** `revision.md` generado con hallazgos y deudas.
- **Siguiente paso:** comparar con la opción 1 cuando su implementación esté disponible.
