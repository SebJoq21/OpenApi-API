# Revisión de la opción 2 — API Fogonería

| Campo | Valor |
|---|---|
| **Documento** | `revision.md` |
| **Fecha** | 2026-11-14 |
| **Contrato** | `openapi.yaml` v1.2.0 |
| **Alcance revisado** | Spec, Plan, Tareas y API implementada en `api/` |
| **Implementación** | NestJS 11 + PostgreSQL 18 + Prisma 6 |
| **Demo** | `http://localhost:3000/api/docs` |
| **Veredicto** | **Aprobado con observaciones no bloqueantes para la demo** |

> Esta revisión ya no es solo documental: incluye código, pruebas ejecutadas y una demo funcional. Las deudas que no bloquean la demo quedan registradas al final.

---

## 1. Resumen ejecutivo

La opción 2 se completó en dos capas:

1. **Planificación SDD:** `spec.md`, `plan.md`, `tasks.md`, `constitution.md` y `prompts.md`.
2. **Implementación:** API NestJS en `api/`, con PostgreSQL, Prisma, Swagger y pruebas.

Resultado:

- **7/7 operaciones** implementadas.
- **22 campos** de Orden expuestos correctamente.
- **20 pruebas unitarias**, **16 e2e**, **10 de contrato** y **31 verificaciones smoke**: todas en verde.
- **Build de producción** correcto.
- **OpenAPI lint** válido, con 2 advertencias no bloqueantes.
- **Swagger** operativo con Authorize y Try it out.

---

## 2. Cobertura del contrato

| # | Operación | Implementada | Probada | Evidencia |
|---|---|---|---|---|
| 1 | `POST /ordenes/salon` | Sí | Sí | e2e, contrato y smoke |
| 2 | `POST /ordenes/delivery` | Sí | Sí | e2e, contrato y smoke |
| 3 | `GET /ordenes` | Sí | Sí | e2e, contrato y smoke |
| 4 | `GET /ordenes/alertas` | Sí | Sí | e2e, contrato y smoke |
| 5 | `GET /ordenes/{id}` | Sí | Sí | e2e, contrato y smoke |
| 6 | `PATCH /ordenes/{id}/estado` | Sí | Sí | e2e, contrato y smoke |
| 7 | `DELETE /ordenes/{id}` | Sí | Sí | e2e, contrato y smoke |

**Cobertura: 7/7 (100 %).**

---

## 3. Entidad y serialización

| Verificación | Resultado |
|---|---|
| Orden tiene 22 campos | ✅ |
| No se expone `sla_minutos` | ✅ |
| Nombres en `snake_case` | ✅ |
| Montos como número JSON, no string | ✅ |
| Fechas ISO 8601 | ✅ |
| Campos nulos explícitos | ✅ |
| `empresa_id` presente y correcto | ✅ |
| `Location` en 201 | ✅ |
| 204 sin body | ✅ |

La prueba e2e verifica explícitamente `Object.keys(res.body).length === 22` y la ausencia de `sla_minutos`.

---

## 4. Contrato de errores

| Verificación | Resultado |
|---|---|
| `Content-Type: application/problem+json` | ✅ |
| `type`, `title`, `status` obligatorios | ✅ |
| `detail` string | ✅ |
| `status` coincide con el código HTTP | ✅ |
| Sin `statusCode`, `message` ni `error` | ✅ |
| Validación múltiple unida en `detail` | ✅ |
| 500 sin stack trace | ✅ |
| 401 en todas las rutas protegidas | ✅ |
| 404 para recurso de otra empresa | ✅ |

Pruebas de contrato: 10/10, incluyendo 201, 200, 204, 400, 401, 404 y 409.

---

## 5. Reglas de negocio verificadas

### 5.1 Cálculos

| Caso | Resultado |
|---|---|
| Subtotal 85.50 sin cupón | IGV 15.39, total 100.89 |
| Subtotal 100 con cupón 10 % | Descuento 10.00, IGV 16.20, total 106.20 |
| Subtotal 85.50 con cupón fijo 15 | Descuento 15.00, IGV 12.69, total 83.19 |
| Descuento mayor al subtotal | Se topa al subtotal; total 0.00 |
| Redondeo `HALF_UP` | Verificado en pruebas unitarias |

### 5.2 Numeración

- Formato `ORD-AAAA-NNN`.
- Secuencia por sucursal y año.
- Contador atómico con `INSERT ... ON CONFLICT`.
- Restricción única `(sucursal_id, numero_orden)`.
- Seed alineado para evitar colisiones (órdenes 101–106, secuencia 106).

### 5.3 Estados

| Transición | Resultado |
|---|---|
| PENDIENTE → CONFIRMADO | 200 + `confirmacion_at` |
| CONFIRMADO → PREPARANDO | 200 |
| PREPARANDO → LISTO | 200 + `listo_at` |
| LISTO → ENTREGADO | 200 + `entrega_at` |
| PENDIENTE → LISTO | 409 |
| Mismo estado | 409 |
| PATCH a ANULADO | 400 |
| DELETE de ENTREGADO | 409 |
| DELETE repetido | 409 |

### 5.4 SLA

- Solo estados activos generan alerta.
- `ENTREGADO` y `ANULADO` nunca alertan.
- Alerta calculada en lectura.
- Snapshot de `sla_minutos` por orden.
- Filtro SQL en `/ordenes/alertas`.

### 5.5 Multitenencia

- `empresa_id` sale del JWT.
- Listados solo devuelven la empresa del token.
- Detalle, PATCH y DELETE de otra empresa devuelven 404.
- Referencias del body de otra empresa devuelven 400.
- Probado con empresas A y B.

---

## 6. Pruebas ejecutadas

| Suite | Comando | Resultado |
|---|---|---|
| Unitarias | `npm test` | 20/20 |
| E2E | `npm run test:e2e` | 16/16 |
| Contrato | `npm run test:contract` | 10/10 |
| Smoke | `node scripts/smoke-test.mjs` | 31/31 |
| Build | `npm run build` | OK |
| OpenAPI lint | `npm run openapi:lint` | Válido, 2 warnings |

### Warnings del contrato

1. `info` no incluye `license`.
2. `servers.url` apunta a `localhost`.

No son bloqueantes para el contrato del curso; se documentan para una futura versión.

---

## 7. Demo verificada

| Paso | Resultado |
|---|---|
| `GET /api/v1/health` | 200 |
| Swagger `/api/docs` | 200, especificación embebida |
| Crear orden de salón con cupón | 201 + Location + total 106.20 |
| Crear delivery sin cliente | 400 problem+json |
| Crear delivery con cliente | 201, mesa/mesero null |
| Listar órdenes | 200 solo empresa A |
| Consultar alertas | 200 solo activas vencidas |
| Consultar detalle | 200, 22 campos |
| Avanzar estado | 200 + timestamp |
| Salto de estado | 409 problem+json |
| Anular | 204 sin body |
| Anular de nuevo | 409 problem+json |
| Cross-tenant | 404 problem+json |
| Sin token | 401 problem+json |

---

## 8. Desviaciones respecto al plan

| Tema | Plan original | Implementación | Motivo |
|---|---|---|---|
| PostgreSQL | Docker Compose en 5433 | Instancia local aislada de PostgreSQL 18 en 5433 | Docker daemon no estaba corriendo; se mantiene `docker-compose.yml` como alternativa |
| Autenticación | `passport-jwt` | Guard propio con `@nestjs/jwt` | Menos dependencias y mismo comportamiento |
| Repositorio | Controller → Service → Repository | Controller → Service → Prisma | Pragmatismo para la demo; queda como deuda de arquitectura |
| `traceId`/`details` | Evaluado como extensión | No se agregaron al body | El contrato 1.2.0 solo define `type`, `title`, `status`, `detail` |
| 403/422 | No aplican | No implementados | No hay roles/scopes; se usa 400/409 |
| 429 | Opcional | No implementado en la app | Se recomienda gateway/WAF |
| `201 Location` | No exigido por el contrato | Implementado | Buena práctica HTTP compatible |
| DELETE repetido | 409 según contrato | 409 | Se respeta el contrato, aunque REST recomiende idempotencia |

---

## 9. Hallazgos por severidad

### Críticos

Ninguno.

### Altos

Ninguno.

### Medios

| Hallazgo | Impacto | Recomendación |
|---|---|---|
| No hay capa `repository` separada | Acoplamiento del servicio a Prisma | Extraer repositorios en una iteración posterior |
| No hay pipeline CI | Las pruebas se ejecutan localmente | Agregar GitHub Actions o equivalente |
| No hay checklist OWASP completo | Seguridad no auditada formalmente | Completar el checklist API Top 10 |
| No hay pruebas de performance | No se validó p95 | Agregar autocannon/k6 con datos representativos |
| Token solo por consola | La demo requiere un paso manual | Mantenerlo fuera del contrato o agregar un helper de demo |
| PostgreSQL local dependiente de la máquina | Reproducibilidad limitada | Usar Docker cuando el daemon esté disponible |

### Bajos

| Hallazgo | Impacto | Recomendación |
|---|---|---|
| OpenAPI sin `license` | Warning de lint | Agregar licencia al contrato en una versión futura |
| `servers` con localhost | Warning de lint | Agregar servidor de producción en una versión futura |
| `npm audit` reporta vulnerabilidades en dependencias de desarrollo | Riesgo bajo para demo | Revisar y actualizar antes de producción |
| Swagger se sirve desde el YAML del repositorio | Depende de la ruta `../../openapi.yaml` | Empaquetar el YAML en el build si se despliega |

---

## 10. Fallos y correcciones de la IA

| Fallo | Corrección | Lección |
|---|---|---|
| El plan inicial asumía `Error` con `statusCode`/`message` | El pull 1.2.0 cambió a RFC 7807; se actualizaron Spec, Plan, Tareas y Prompts | Releer el contrato después de cada cambio |
| `ProblemDetailsException` declaraba `status` y chocaba con `HttpException` | Se eliminó la propiedad y se usó `getStatus()` | Revisar la API de la clase base |
| Faltaban tipos de `swagger-ui-express` | Se instaló `@types/swagger-ui-express` | Verificar tipos al integrar librerías |
| Ruta incorrecta del OpenAPI en `jest-openapi` | Se corrigió de `../../../` a `../../../../` | El error de la prueba guió la corrección |
| Docker daemon no disponible | Se levantó PostgreSQL local aislado en 5433 | Adaptar el entorno sin romper el plan |
| Riesgo de colisión entre seed y secuencia | Se sembraron órdenes 101–106 y secuencia 106 | La numeración debe ser coherente con los datos demo |
| Riesgo de agregar `traceId`/`details` al body | Se dejaron solo en `X-Request-Id` y logs | La IA tiende a agregar campos no pedidos |

---

## 11. Supuestos A-01…A-20

| ID | Tema | Estado |
|---|---|---|
| A-01 | `empresa_id` desde JWT | Aceptado e implementado |
| A-02 | Modelo de cupón | Aceptado e implementado |
| A-03 | Descuento topado al subtotal | Aceptado e implementado |
| A-04 | SLA por sucursal, default 20 | Aceptado e implementado |
| A-05 | SLA solo en estados activos | Aceptado e implementado |
| A-06 | Numeración por sucursal y año | Aceptado e implementado |
| A-07 | Orden por `ingreso_at DESC, id DESC` | Aceptado e implementado |
| A-08 | Zona horaria America/Lima | Aceptado e implementado |
| A-09 | Redondeo HALF_UP | Aceptado e implementado |
| A-10 | `type = about:blank` | Aceptado e implementado |
| A-11 | `title` inglés, `detail` español | Aceptado e implementado |
| A-12 | Validación múltiple en un `detail` | Aceptado e implementado |
| A-13 | `X-Request-Id` en header | Aceptado e implementado |
| A-14 | `201 Location` | Aceptado e implementado |
| A-15 | Sin 403/422 | Aceptado |
| A-16 | 429 en gateway/WAF | Decisión pendiente de infraestructura |
| A-17 | DELETE repetido 409 | Aceptado e implementado |
| A-18 | Cross-tenant 400/404 | Aceptado e implementado |
| A-19 | Catálogos mínimos con seeds | Aceptado e implementado |
| A-20 | Lista blanca estricta | Aceptado e implementado |

---

## 12. Pendientes no bloqueantes

1. Extraer la capa `repository` para cumplir al 100 % la arquitectura del plan.
2. Agregar CI con lint, typecheck, unit, e2e y contract.
3. Completar checklist OWASP API Top 10.
4. Agregar pruebas de performance y datos de carga.
5. Decidir si el rate limiting va en app o gateway.
6. Evaluar `traceId` y `details` como extensión RFC 7807 en una versión 1.3 del contrato.
7. Resolver los warnings de OpenAPI (`license`, `servers`).
8. Comparar con la opción 1 cuando su implementación esté disponible.

---

## 13. Veredicto

**Aprobado con observaciones no bloqueantes para la demo.**

La implementación cumple las 7 operaciones, el contrato de errores, la multitenencia, los cálculos, la numeración, los estados y el SLA. Las observaciones son de arquitectura, CI, seguridad y performance; no impiden la demostración funcional.

**Firma:** revisión técnica automatizada y verificación funcional.  
**Pendiente:** firma humana y comparación con la opción 1.
