# Especificación funcional — API Fogonería: Gestión de Órdenes

| Campo | Valor |
|---|---|
| **Documento** | `spec.md` |
| **Versión** | 1.0 |
| **Fecha** | 2026-11-13 |
| **Contrato fuente** | `openapi.yaml` v1.2.0 |
| **Entidad** | Orden (22 columnas) |
| **Base URL** | `http://localhost:3000/api/v1` |
| **Estado** | Borrador completo para revisión humana |
| **Alcance** | Opción 2 — especificación, plan y tareas |

> Este documento describe **qué** debe hacer el API y **cómo se reconoce que está bien**. No prescribe tecnología ni estructura de código; eso corresponde a `plan.md`.

---

## 1. Resumen ejecutivo

Se requiere construir una API REST para gestionar el ciclo de vida de órdenes de un restaurante SaaS multitenencia. La API debe permitir:

1. Crear una orden de salón.
2. Crear una orden de delivery o para llevar.
3. Listar órdenes con filtros y paginación.
4. Consultar las órdenes con SLA excedido.
5. Consultar el detalle de una orden.
6. Avanzar el estado de una orden.
7. Anular lógicamente una orden.

Todas las operaciones se ejecutan dentro de una empresa (`empresa_id`) obtenida del JWT. El servidor calcula descuento, IGV, total, número de orden y alerta SLA. El cliente nunca envía esos valores.

---

## 2. Contexto y problema

Fogonería opera con varias empresas y sucursales. Cada empresa debe ver únicamente sus propias órdenes. Una orden pasa por un flujo operativo controlado y debe conservarse para auditoría incluso cuando se anula.

El problema que resuelve la API es:

- Exponer un contrato único y estable para que el frontend y otros módulos creen y consulten órdenes.
- Evitar que el cliente manipule totales, numeración o alertas.
- Garantizar que una empresa no acceda a datos de otra.
- Mantener consistencia en los cálculos monetarios y en las transiciones de estado.
- Proveer un formato de error estándar y predecible.

---

## 3. Objetivos y métricas de éxito

| Objetivo | Métrica |
|---|---|
| Fidelidad al contrato | 100 % de las 7 operaciones validadas con pruebas de contrato |
| Aislamiento multiempresa | 0 accesos cruzados en la suite de aislamiento |
| Consistencia monetaria | Cálculos con `Decimal`, redondeo `HALF_UP` y totales coherentes |
| Unicidad de numeración | 0 duplicados en prueba de concurrencia |
| Estados válidos | 0 transiciones inválidas aceptadas |
| Errores estándar | 100 % de errores con `application/problem+json` |
| Reproducibilidad | API levanta desde cero con Docker, migraciones y seeds |

---

## 4. Alcance

### 4.1 Incluido

- Las 7 operaciones del contrato.
- Autenticación bearer JWT.
- Multitenencia por `empresa_id`.
- Cálculos de descuento, IGV y total.
- Generación de `numero_orden`.
- Flujo de estados y timestamps.
- Anulación lógica.
- Alertas SLA.
- Paginación, filtros y ordenamiento.
- Contrato de errores RFC 7807/9457.
- Pruebas unitarias, e2e y de contrato.
- Documentación y prompts del proceso.

### 4.2 Excluido

- Interfaz de usuario.
- CRUD de empresas, sucursales, mesas, meseros, clientes, cupones o listas de precio.
- Emisión de tokens o login.
- Roles y scopes: el contrato solo exige un JWT con `empresa_id`.
- Pagos, facturación electrónica, impresión de tickets.
- Webhooks, notificaciones, reportes o analítica.
- Endpoints de salud, métricas o administración dentro del contrato.
- Cambios al `openapi.yaml`.
- Comparación con la opción 1.

---

## 5. Actores y permisos

| Actor | Descripción | Permisos |
|---|---|---|
| Usuario autenticado de la empresa | Mesero, cajero o supervisor con JWT válido | Crear, consultar, avanzar estado y anular órdenes de su empresa |
| Sistema | Componente servidor | Calcula importes, numeración, SLA y timestamps |
| Administrador de plataforma | Fuera del contrato | No se modela |

**Regla:** no hay roles definidos en el contrato. Cualquier token válido de la empresa puede ejecutar las 7 operaciones. Si en el futuro se agregan roles, se debe extender el contrato.

---

## 6. Glosario

| Término | Definición |
|---|---|
| **Empresa / tenant** | Organización dueña de los datos. Se identifica con `empresa_id` del JWT. |
| **Sucursal** | Local físico de una empresa. Configura el SLA y la numeración. |
| **Orden** | Registro del pedido de un cliente. Tiene 22 columnas en la respuesta. |
| **Origen** | `SALON`, `LLEVAR` o `DELIVERY`. |
| **Estado** | `PENDIENTE`, `CONFIRMADO`, `PREPARANDO`, `LISTO`, `ENTREGADO` o `ANULADO`. |
| **SLA** | Tiempo máximo objetivo de atención. Si se excede, `alerta_sla = true`. |
| **Cupón** | Descuento aplicable a una orden. Puede ser porcentaje o monto fijo. |
| **Lista de precio** | Referencia opcional usada por el frontend; no altera el cálculo en esta API. |
| **IGV** | Impuesto General a las Ventas del Perú: 18 %. |
| **Anulación lógica** | Cambio de estado a `ANULADO`; el registro no se borra. |
| **`numero_orden`** | Identificador legible con formato `ORD-AAAA-NNN`. |
| **Problem Details** | Formato estándar de error RFC 7807/9457 con `type`, `title`, `status`, `detail`. |
| **Contract test** | Prueba que verifica que la respuesta real cumple el OpenAPI. |

---

## 7. Historias de usuario

### US-01 — Crear orden de salón

**Como** mesero autenticado, **quiero** crear una orden de salón con mesa y mesero, **para** iniciar la atención de una mesa.

Escenarios:

- Con datos válidos, la orden nace `PENDIENTE`, con `origen = SALON`, número generado y totales calculados.
- Si falta `mesa_id`, `mesero_id`, `sucursal_id` o `subtotal`, responde 400.
- Si la mesa no pertenece a la sucursal o a la empresa, responde 400.

### US-02 — Crear orden de delivery o para llevar

**Como** cajero autenticado, **quiero** crear una orden de delivery o para llevar, **para** registrar pedidos que no consumen mesa.

Escenarios:

- `DELIVERY` exige `cliente_id`.
- `LLEVAR` permite `cliente_id` nulo.
- En ambos casos, `mesa_id` y `mesero_id` quedan nulos.

### US-03 — Listar órdenes

**Como** supervisor, **quiero** listar y filtrar órdenes de mi empresa, **para** hacer seguimiento operativo.

Escenarios:

- La lista solo contiene órdenes de la empresa del token.
- Se puede filtrar por estado, origen, sucursal, mesa y rango de `ingreso_at`.
- La paginación devuelve `page`, `limit`, `total` y `total_pages`.

### US-04 — Consultar alertas SLA

**Como** supervisor, **quiero** ver las órdenes activas que excedieron el SLA, **para** priorizar la atención.

Escenarios:

- Solo aparecen órdenes activas con alerta.
- Se puede filtrar por sucursal.
- La ruta `/ordenes/alertas` no se interpreta como un `id`.

### US-05 — Consultar detalle

**Como** usuario autenticado, **quiero** ver el detalle de una orden, **para** conocer su estado, importes y timestamps.

Escenarios:

- Una orden de la empresa devuelve 200 con los 22 campos.
- Una orden de otra empresa o inexistente devuelve 404.

### US-06 — Avanzar estado

**Como** operador, **quiero** avanzar la orden al siguiente estado, **para** reflejar el progreso real.

Escenarios:

- Solo se permite el siguiente estado del flujo.
- Se registra el timestamp correspondiente.
- Un salto, retroceso o repetición devuelve 409.

### US-07 — Anular orden

**Como** supervisor, **quiero** anular una orden, **para** dejar constancia de que ya no se atenderá.

Escenarios:

- Una orden activa pasa a `ANULADO` con 204.
- Una orden `ENTREGADO` o ya `ANULADO` devuelve 409.
- Una orden de otra empresa devuelve 404.

### US-08 — Aislamiento multiempresa

**Como** empresa, **quiero** que mis datos nunca se mezclen con los de otra, **para** cumplir con seguridad y privacidad.

Escenarios:

- Ningún listado incluye órdenes de otra empresa.
- Ningún detalle, modificación o anulación accede a otra empresa.
- Una referencia del body de otra empresa se rechaza con 400.

---

## 8. Requisitos funcionales

### FR-001 — Autenticación obligatoria

Todas las operaciones requieren `Authorization: Bearer <JWT>`. Si el token falta, es inválido o está expirado, se devuelve **401** con `application/problem+json`.

### FR-002 — Empresa desde el JWT

`empresa_id` se obtiene exclusivamente del claim del JWT. No se acepta en body, query, path ni headers personalizados. Todas las lecturas y escrituras se filtran por ese valor.

### FR-003 — Crear orden de salón

`POST /ordenes/salon` crea una orden con:

- `origen = SALON` (fijado por el servidor).
- `estado = PENDIENTE`.
- `sucursal_id`, `mesa_id`, `mesero_id` y `subtotal` obligatorios.
- `cliente_id`, `cupon_id` y `lista_precio_id` opcionales.
- `mesa_id` y `mesero_id` no nulos.

Devuelve **201** con la orden creada y header `Location`.

### FR-004 — Crear orden de delivery o para llevar

`POST /ordenes/delivery` crea una orden con:

- `origen` obligatorio: `LLEVAR` o `DELIVERY`.
- `sucursal_id` y `subtotal` obligatorios.
- `cliente_id` obligatorio si `origen = DELIVERY`; opcional si `LLEVAR`.
- `mesa_id = null` y `mesero_id = null`.
- `estado = PENDIENTE`.

Devuelve **201** con la orden creada y header `Location`.

### FR-005 — Cálculos del servidor

El servidor calcula:

- `descuento_cupon` a partir de `cupon_id`; 0.00 si no hay cupón.
- `igv = (subtotal - descuento_cupon) * 0.18`.
- `total = (subtotal - descuento_cupon) + igv`.
- Montos con redondeo `HALF_UP` a 2 decimales.
- El descuento no puede superar el subtotal.
- El total se calcula con los componentes ya redondeados.

### FR-006 — Numeración de orden

El servidor genera `numero_orden` con formato `ORD-AAAA-NNN`:

- `AAAA` es el año de negocio en `America/Lima`.
- `NNN` es un consecutivo mínimo de 3 dígitos; si se supera 999, crece.
- Es único por sucursal.
- Se genera con un contador atómico y una restricción única.
- Si hay colisión, se reintenta; si persiste, 409.

### FR-007 — Estado inicial y timestamps

Al crear una orden:

- `estado = PENDIENTE`.
- `ingreso_at`, `created_at` y `updated_at` se asignan en el servidor.
- `confirmacion_at`, `listo_at` y `entrega_at` quedan nulos.
- `alerta_sla` se calcula; inicialmente será `false` salvo que el SLA ya esté vencido por reloj.

### FR-008 — Listar órdenes

`GET /ordenes` devuelve solo las órdenes de la empresa del token, con:

- `page` (mínimo 1, por defecto 1).
- `limit` (1–100, por defecto 20).
- Filtros opcionales: `estado`, `origen`, `sucursal_id`, `mesa_id`, `desde`, `hasta`.
- `desde` y `hasta` se aplican sobre `ingreso_at`, de forma inclusiva.
- Orden determinista: `ingreso_at DESC, id DESC`.
- Respuesta `OrdenList` con `data` y `meta`.

### FR-009 — Listar alertas SLA

`GET /ordenes/alertas` devuelve solo órdenes de la empresa con `alerta_sla = true`:

- Solo estados activos: `PENDIENTE`, `CONFIRMADO`, `PREPARANDO`, `LISTO`.
- Filtro opcional `sucursal_id`.
- Paginación `page` y `limit`.
- La ruta se declara antes que `/ordenes/{id}`.

### FR-010 — Obtener detalle

`GET /ordenes/{id}` devuelve una orden de la empresa del token. Si no existe o pertenece a otra empresa, devuelve **404**.

### FR-011 — Actualizar estado

`PATCH /ordenes/{id}/estado` acepta únicamente:

```json
{ "estado": "CONFIRMADO" }
```

Estados destino válidos: `CONFIRMADO`, `PREPARANDO`, `LISTO`, `ENTREGADO`.

- Solo se permite la transición inmediata siguiente.
- No se permite saltar, retroceder ni repetir el estado actual.
- No se permite `ANULADO` por esta vía.
- Se registra `confirmacion_at`, `listo_at` o `entrega_at` según corresponda.
- Devuelve **200** con la orden actualizada.

### FR-012 — Anular orden

`DELETE /ordenes/{id}`:

- Cambia el estado a `ANULADO`; no borra el registro.
- Devuelve **204** sin cuerpo.
- Devuelve **409** si la orden está `ENTREGADO` o ya `ANULADO`.
- Devuelve **404** si no existe o es de otra empresa.

### FR-013 — Contrato de errores

Todas las respuestas de error usan `application/problem+json` con:

- `type` (obligatorio).
- `title` (obligatorio).
- `status` (obligatorio, igual al HTTP).
- `detail` (opcional, string).

No se permiten los campos `statusCode`, `message` ni `error`. Los errores de validación múltiples se unen en `detail`.

### FR-014 — Campos de solo lectura

El cliente no puede enviar `empresa_id`, `numero_orden`, `descuento_cupon`, `igv`, `total`, `alerta_sla`, `id` ni timestamps. Los DTO usan lista blanca estricta; un campo extra devuelve **400**.

### FR-015 — Serialización de respuesta

La respuesta debe:

- Usar `snake_case` exactamente como el contrato.
- Incluir los 22 campos de `Orden` (con `null` donde corresponda).
- Devolver montos como números JSON, no strings.
- Devolver fechas en ISO 8601.
- No exponer columnas internas como `sla_minutos`.

### FR-016 — Precedencia de rutas

La ruta fija `/ordenes/alertas` debe declararse antes que `/ordenes/{id}` para que `alertas` no se interprete como un UUID.

### FR-017 — Semántica HTTP

- `200` para consultas y actualización exitosa.
- `201` para creación, con header `Location`.
- `204` para anulación exitosa, sin body.
- `400` para validación.
- `401` para autenticación.
- `404` para recurso inexistente o de otra empresa.
- `409` para conflictos de negocio.
- `500` para error interno, sin filtrar detalles.

### FR-018 — Validación de referencias

Al crear una orden, el servidor valida que:

- `sucursal_id` pertenezca a la empresa.
- `mesa_id` pertenezca a la sucursal y a la empresa.
- `mesero_id` pertenezca a la empresa.
- `cliente_id`, `cupon_id` y `lista_precio_id` pertenezcan a la empresa.
- Si alguna referencia no cumple, devuelve **400**.

### FR-019 — Paginación y metadatos

`meta` contiene:

- `page`: página actual.
- `limit`: tamaño de página.
- `total`: total de registros que cumplen los filtros.
- `total_pages`: `ceil(total / limit)`; 0 si `total = 0`.

Una página fuera de rango devuelve `data: []` y metadatos coherentes, no 404.

### FR-020 — Cálculo de SLA

`alerta_sla` se calcula en lectura:

- `true` si la orden está en estado activo y `ahora > ingreso_at + sla_minutos`.
- `false` si está `ENTREGADO` o `ANULADO`.
- El límite se toma de la sucursal y se guarda como snapshot en la orden.

### FR-021 — Validación de entrada

Se validan:

- UUID en identificadores.
- Enums de estado y origen.
- `subtotal` numérico, mínimo 0 y múltiplo de 0.01.
- `page` y `limit` enteros dentro de rango.
- Fechas ISO 8601 válidas.
- `desde <= hasta`.
- `cliente_id` obligatorio para `DELIVERY`.

### FR-022 — Observabilidad

Cada petición debe poder correlacionarse:

- Se genera o propaga `X-Request-Id`.
- Se registra en logs estructurados.
- No se registran secretos, tokens completos ni datos sensibles innecesarios.

### FR-023 — Fidelidad al contrato

La implementación debe cumplir `openapi.yaml` v1.2.0. Las pruebas de contrato validan:

- Códigos HTTP.
- Content types.
- Esquemas de request y response.
- Formato de error.

### FR-024 — Límites de alcance

No se agregan:

- Endpoints de login, catálogos o webhooks.
- Campos al body de error.
- Estados o transiciones no documentadas.
- Roles, scopes, 403 o 422.
- 429 dentro de la app salvo aprobación; se prefiere gateway/WAF.

---

## 9. Reglas de negocio

| ID | Regla |
|---|---|
| **BR-001** | `empresa_id` proviene solo del JWT y filtra todas las operaciones. |
| **BR-002** | Sin cupón, `descuento_cupon = 0.00`. |
| **BR-003** | El descuento del cupón se calcula según su tipo y vigencia; nunca supera el subtotal. |
| **BR-004** | `igv = (subtotal - descuento_cupon) * 0.18`, redondeado a 2 decimales. |
| **BR-005** | `total = (subtotal - descuento_cupon) + igv`, usando componentes redondeados. |
| **BR-006** | `numero_orden` es único por sucursal y sigue `ORD-AAAA-NNN`. |
| **BR-007** | Toda orden nace `PENDIENTE`. |
| **BR-008** | El flujo es `PENDIENTE → CONFIRMADO → PREPARANDO → LISTO → ENTREGADO`. |
| **BR-009** | No se permiten saltos, retrocesos ni repetición del estado actual. |
| **BR-010** | `ANULADO` solo se alcanza con `DELETE`. |
| **BR-011** | No se anula una orden `ENTREGADO` ni una ya `ANULADO`. |
| **BR-012** | `DELIVERY` exige `cliente_id`; `LLEVAR` lo permite nulo. |
| **BR-013** | Salón exige mesa y mesero; delivery/LLEVAR los dejan nulos. |
| **BR-014** | Un recurso de otra empresa se comporta como inexistente: 404. |
| **BR-015** | Una referencia del body de otra empresa se rechaza con 400. |
| **BR-016** | El listado se ordena por `ingreso_at DESC, id DESC` y pagina con `page`/`limit`. |
| **BR-017** | `alerta_sla` solo es `true` en estados activos y con SLA vencido. |
| **BR-018** | La segunda anulación devuelve 409 según el contrato, aunque REST recomiende idempotencia. |

---

## 10. Contrato de errores y códigos HTTP

### 10.1 Formato RFC 7807/9457

El contrato cita RFC 7807; RFC 9457 es su actualización compatible. Se implementa el formato común `application/problem+json`.

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "Transición de estado inválida de PENDIENTE a LISTO"
}
```

Reglas:

- `type`: `about:blank` por defecto. Es el identificador estable del tipo de problema.
- `title`: frase estándar del estado HTTP, en inglés.
- `status`: entero igual al código HTTP.
- `detail`: explicación en español; string único.
- `detail` es opcional en el esquema, pero se incluye cuando aporta información.
- Varios errores de validación se unen con `; `.
- No se agregan `traceId` ni `details` al body: el contrato no los define.
- La correlación va en `X-Request-Id`.
- Un 500 devuelve un `detail` genérico y no expone stack ni datos internos.

### 10.2 Tabla de errores

| HTTP | `type` | `title` | `status` | `detail` esperado |
|---|---|---|---|---|
| 400 | `about:blank` | `Bad Request` | 400 | Mensajes de validación unidos |
| 401 | `about:blank` | `Unauthorized` | 401 | Token ausente o inválido |
| 404 | `about:blank` | `Not Found` | 404 | Orden no encontrada |
| 409 | `about:blank` | `Conflict` | 409 | Transición inválida o numeración duplicada |
| 500 | `about:blank` | `Internal Server Error` | 500 | Error interno del servidor |

### 10.3 Códigos HTTP del contrato

| Código | Uso | ¿Aplica? |
|---|---|---|
| 200 | Consultas y PATCH exitoso | Sí |
| 201 | Creación de orden + `Location` | Sí |
| 204 | Anulación sin body | Sí |
| 400 | Validación de entrada o referencias | Sí |
| 401 | Token ausente/inválido/expirado | Sí |
| 403 | Autenticado sin permisos | No: no hay roles/scopes en el contrato |
| 404 | Orden inexistente o de otra empresa | Sí |
| 409 | Transición inválida o conflicto de numeración | Sí |
| 422 | Validación de dominio compleja | No: se usa 400/409 |
| 429 | Rate limit | Solo si se implementa en la app; preferible gateway/WAF |
| 500 | Error interno | Sí, global |

### 10.4 Headers

- `Content-Type: application/problem+json` en errores.
- `Content-Type: application/json` en éxitos con body.
- `Location: /api/v1/ordenes/{id}` en `201`.
- `X-Request-Id` en todas las respuestas para correlación.
- `204` no lleva body.

---

## 11. Requisitos no funcionales

| ID | Requisito |
|---|---|
| **NFR-001** | Fidelidad al contrato: pruebas de contrato para las 7 operaciones. |
| **NFR-002** | Rendimiento: listados p95 ≤ 300 ms; creación p95 ≤ 400 ms con datos de prueba razonables. |
| **NFR-003** | Concurrencia: numeración única y transiciones atómicas. |
| **NFR-004** | Seguridad: JWT validado, HTTPS en despliegue, sin secretos en logs, OWASP API Top 10. |
| **NFR-005** | Observabilidad: logs estructurados, `X-Request-Id`, errores 500 registrados. |
| **NFR-006** | Pruebas: unitarias, integración, e2e, contrato; cobertura global ≥ 80 %, dominio ≥ 90 %. |
| **NFR-007** | Reproducibilidad: Docker Compose, migraciones, seeds, `.env.example` y README. |
| **NFR-008** | Documentación: Swagger/Redoc sobre el contrato canónico; sin un segundo contrato. |
| **NFR-009** | Mantenibilidad: capas NestJS, DTOs, mappers, lint y typecheck. |
| **NFR-010** | Integridad: FKs, unique, numeric(12,2), timestamptz e índices. |

---

## 12. Criterios de aceptación

### 12.1 Creación

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| **AC-001** | Token válido y body de salón válido | `POST /ordenes/salon` | 201, `estado=PENDIENTE`, `origen=SALON`, número válido, totales correctos, `Location` presente |
| **AC-002** | Body de salón sin `mesa_id`, `mesero_id`, `sucursal_id` o `subtotal` | `POST /ordenes/salon` | 400 con problem+json |
| **AC-003** | UUID inválido o `subtotal` negativo/no múltiplo de 0.01 | `POST /ordenes/salon` | 400 |
| **AC-004** | Body incluye `empresa_id`, `igv`, `total`, `numero_orden` o `alerta_sla` | `POST /ordenes/salon` | 400 por lista blanca estricta |
| **AC-005** | `mesa_id` de otra sucursal o `mesero_id` de otra empresa | `POST /ordenes/salon` | 400 |
| **AC-006** | `DELIVERY` con `cliente_id` válido | `POST /ordenes/delivery` | 201, `mesa_id=null`, `mesero_id=null`, `cliente_id` presente |
| **AC-007** | `DELIVERY` sin `cliente_id` | `POST /ordenes/delivery` | 400 |
| **AC-008** | `LLEVAR` sin `cliente_id` | `POST /ordenes/delivery` | 201 con `cliente_id=null` |
| **AC-009** | `origen=SALON` en delivery | `POST /ordenes/delivery` | 400 |
| **AC-010** | Sin cupón | Crear orden | `descuento_cupon=0.00`, IGV y total correctos |
| **AC-011** | Cupón válido | Crear orden | Descuento, IGV y total correctos; descuento ≤ subtotal |
| **AC-012** | Cupón inexistente, inactivo o vencido | Crear orden | 400 |
| **AC-013** | Dos órdenes de la misma sucursal y año | Crear | Números distintos y formato `ORD-AAAA-NNN` |
| **AC-014** | 50 creaciones concurrentes | Crear | 0 duplicados de `numero_orden` |

### 12.2 Consultas

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| **AC-015** | Órdenes de dos empresas | `GET /ordenes` | Solo aparecen las del token; `meta` correcta |
| **AC-016** | Filtros de estado, origen, sucursal, mesa, desde/hasta | `GET /ordenes` | Resultados correctos y fechas inclusivas |
| **AC-017** | `page=0`, `limit=0`, `limit=101`, UUID o fecha inválidos | `GET /ordenes` | 400 |
| **AC-018** | Página fuera de rango | `GET /ordenes` | 200, `data=[]`, `total_pages` coherente |
| **AC-019** | Orden activa con SLA vencido | `GET /ordenes/alertas` | Aparece en la lista |
| **AC-020** | Orden entregada o anulada con SLA vencido | `GET /ordenes/alertas` | No aparece |
| **AC-021** | Llamada a `/ordenes/alertas` | Routing | Se resuelve como alertas, no como `id=alertas` |
| **AC-022** | Orden de la empresa | `GET /ordenes/{id}` | 200 con los 22 campos, sin campos internos |
| **AC-023** | Orden de otra empresa o inexistente | `GET /ordenes/{id}` | 404 |
| **AC-024** | Listados y detalle | Serialización | Montos numéricos, fechas ISO, `null` explícitos, `snake_case` |

### 12.3 Estado y anulación

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| **AC-025** | Orden `PENDIENTE` | `PATCH` a `CONFIRMADO` | 200, estado actualizado, `confirmacion_at` set |
| **AC-026** | Orden `PREPARANDO` | `PATCH` a `LISTO` | 200, `listo_at` set |
| **AC-027** | Orden `LISTO` | `PATCH` a `ENTREGADO` | 200, `entrega_at` set |
| **AC-028** | Orden `PENDIENTE` | `PATCH` a `LISTO` | 409 |
| **AC-029** | Orden `CONFIRMADO` | `PATCH` a `PENDIENTE` | 409 |
| **AC-030** | Orden en cualquier estado | `PATCH` al mismo estado | 409 |
| **AC-031** | Orden activa | `PATCH` a `ANULADO` | 400 por enum inválido |
| **AC-032** | Orden `ENTREGADO` | `DELETE` | 409 |
| **AC-033** | Orden ya `ANULADO` | `DELETE` | 409 |
| **AC-034** | Orden activa | `DELETE` | 204 sin body |
| **AC-035** | Orden de otra empresa | `PATCH` o `DELETE` | 404 |

### 12.4 Transversal

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| **AC-036** | Token ausente, inválido o expirado | Cualquier operación | 401 problem+json |
| **AC-037** | Cualquier error | Respuesta | `Content-Type: application/problem+json`; `type`, `title`, `status`; `status` = HTTP; sin `statusCode`/`message`/`error` |
| **AC-038** | Varios errores de validación | 400 | Un solo `detail` string unido |
| **AC-039** | Error inesperado | 500 | `detail` genérico, sin stack ni datos internos |
| **AC-040** | Creación exitosa | 201 | Header `Location` correcto |
| **AC-041** | Anulación exitosa | 204 | Sin body |
| **AC-042** | Respuestas exitosas con body | 200/201 | `Content-Type: application/json` |
| **AC-043** | Suite de contrato | 7 operaciones | Todas validan contra `openapi.yaml` |
| **AC-044** | Matriz de aislamiento | 7 operaciones | 0 accesos cruzados |

---

## 13. Supuestos y decisiones abiertas

Estos puntos no están completamente definidos en el contrato. Se proponen para la revisión; no deben implementarse como verdades silenciosas.

| ID | Tema | Decisión propuesta | Estado |
|---|---|---|---|
| **A-01** | Claims del JWT | `empresa_id` obligatorio; emisión de tokens fuera de alcance; sin roles/scopes | A confirmar |
| **A-02** | Modelo de cupón | Tabla `cupones` con tipo `PORCENTAJE`/`MONTO_FIJO`, valor, vigencia y activo | A confirmar |
| **A-03** | Descuento máximo | Se limita al subtotal; nunca deja total negativo | A confirmar |
| **A-04** | SLA | `sucursales.sla_minutos` con default 20; snapshot en la orden | A confirmar |
| **A-05** | Estados con alerta | Solo activos; `ENTREGADO` y `ANULADO` siempre `false` | A confirmar |
| **A-06** | Numeración | Por sucursal + año de negocio; mínimo 3 dígitos; contador atómico | A confirmar |
| **A-07** | Orden de listado | `ingreso_at DESC, id DESC` | A confirmar |
| **A-08** | Zona horaria | Almacenar UTC; año de negocio en `America/Lima` | A confirmar |
| **A-09** | Redondeo | `HALF_UP`, 2 decimales; total desde componentes redondeados | A confirmar |
| **A-10** | `type` de error | `about:blank` en todos los errores; URIs personalizados fuera de alcance | A confirmar |
| **A-11** | Idioma de error | `title` en inglés (frase HTTP); `detail` en español | A confirmar |
| **A-12** | Validación múltiple | Un solo `detail` string; sin array `errors` | A confirmar |
| **A-13** | `traceId` | `X-Request-Id` en header; no en body | A confirmar |
| **A-14** | `201 Location` | Se agrega como buena práctica, sin cambiar el body | A confirmar |
| **A-15** | 403/422 | No aplican: no hay roles/scopes y se usa 400/409 | A confirmar |
| **A-16** | 429 | Preferible gateway/WAF; si se implementa en app, problem+json | A confirmar |
| **A-17** | `DELETE` repetido | 409 según contrato; se documenta la tensión con idempotencia REST | A confirmar |
| **A-18** | Cross-tenant | Body/referencias → 400; recurso por ID → 404 | A confirmar |
| **A-19** | Catálogos | Tablas mínimas y seeds; sin endpoints CRUD | A confirmar |
| **A-20** | Campos extra | Lista blanca estricta; cualquier campo no declarado → 400 | A confirmar |

---

## 14. Matriz de trazabilidad

| `operationId` | Método y ruta | FR | AC |
|---|---|---|---|
| `crearOrdenSalon` | `POST /ordenes/salon` | FR-003, FR-005, FR-006, FR-007, FR-014, FR-018 | AC-001…AC-014, AC-040, AC-042 |
| `crearOrdenDelivery` | `POST /ordenes/delivery` | FR-004, FR-005, FR-006, FR-007, FR-014, FR-018 | AC-006…AC-014, AC-040, AC-042 |
| `listarOrdenes` | `GET /ordenes` | FR-008, FR-019, FR-021 | AC-015…AC-018, AC-024 |
| `listarOrdenesAlertaSla` | `GET /ordenes/alertas` | FR-009, FR-020 | AC-019…AC-021, AC-024 |
| `obtenerOrden` | `GET /ordenes/{id}` | FR-010, FR-015 | AC-022…AC-024 |
| `actualizarEstadoOrden` | `PATCH /ordenes/{id}/estado` | FR-011, FR-021 | AC-025…AC-031, AC-035 |
| `anularOrden` | `DELETE /ordenes/{id}` | FR-012 | AC-032…AC-035 |
| Transversal | Auth, tenant, errores, contrato | FR-001, FR-002, FR-013, FR-016, FR-017, FR-022, FR-023, FR-024 | AC-036…AC-044 |

---

## 15. Definición de terminado del Spec

- [ ] Las 7 operaciones están cubiertas por requisitos.
- [ ] Cada requisito tiene al menos un criterio de aceptación verificable.
- [ ] Los supuestos están identificados y no ocultos.
- [ ] La matriz de trazabilidad está completa.
- [ ] El contrato de errores coincide con `openapi.yaml` 1.2.0.
- [ ] El alcance excluido está explícito.
- [ ] La revisión humana aprueba o corrige los supuestos.

---

## 16. Preguntas para la revisión

1. ¿Se acepta `about:blank` como `type` para todos los errores o se definen URIs estables por categoría?
2. ¿Se agrega `traceId` al body como extensión RFC 7807 o se mantiene solo en `X-Request-Id`?
3. ¿Se mantiene el 409 en la segunda anulación o se propone volver el `DELETE` idempotente en una versión futura del contrato?
4. ¿El SLA debe seguir aplicando a órdenes entregadas para fines históricos?
5. ¿El cupón puede ser porcentaje y monto fijo, o solo uno de los dos?
6. ¿El descuento se topa al subtotal o se rechaza el cupón si lo supera?
7. ¿Se acepta el header `Location` en los 201 aunque el contrato no lo mencione?
8. ¿Se implementa rate limiting en la app (429) o se delega al gateway/WAF?
9. ¿La zona horaria de negocio es `America/Lima` para todos los tenants?
10. ¿Se requiere algún rol o scope además de `empresa_id`?
