# Constitución del proyecto — API Fogonería

**Versión:** 1.0
**Contrato de referencia:** `openapi.yaml` 1.2.0
**Aplica a:** opción 2 (spec, plan, tareas y futura implementación)
**Última actualización:** 2026-11-13

---

## 1. Propósito

Esta constitución fija las reglas que no se negocian al construir el API de gestión de órdenes. Sirve como contexto obligatorio para cualquier persona o asistente de IA que ejecute una tarea.

Si una instrucción de una tarea contradice esta constitución, prevalece la constitución. Si el contrato OpenAPI contradice una práctica recomendada, prevalece el contrato y la tensión se documenta.

---

## 2. Principios no negociables

### 2.1 El contrato es la fuente de verdad

- `openapi.yaml` define rutas, métodos, parámetros, cuerpos, respuestas, códigos y esquemas.
- No se modifica el contrato para “hacer que el código funcione”.
- No se añaden endpoints, campos, estados, códigos HTTP ni parámetros que no estén aprobados.
- Si el contrato es ambiguo, se registra un supuesto y se somete a revisión; no se inventa una regla silenciosa.

### 2.2 El cliente no calcula lo que le corresponde al servidor

El cliente **no** envía:

- `empresa_id`
- `numero_orden`
- `descuento_cupon`
- `igv`
- `total`
- `alerta_sla`
- `id`
- `created_at`, `updated_at`
- `ingreso_at`, `confirmacion_at`, `listo_at`, `entrega_at`

El servidor calcula y asigna esos valores. Los DTO usan lista blanca estricta: un campo extra devuelve 400.

### 2.3 La multitenencia no se negocia

- `empresa_id` se obtiene **siempre** del JWT.
- Toda consulta y escritura se filtra por la empresa del token.
- Un recurso de otra empresa se comporta como inexistente: **404**, no 403.
- Una referencia del body que pertenece a otra empresa se rechaza con **400**.
- Nunca se confía en un `empresa_id` enviado por el cliente.

### 2.4 Los errores son un contrato, no un texto libre

Todas las respuestas de error usan:

```http
Content-Type: application/problem+json
```

Cuerpo estándar:

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "Transición de estado inválida de PENDIENTE a LISTO"
}
```

Reglas:

- `type`: URI; se usa `about:blank` por defecto.
- `title`: frase estándar del estado HTTP (`Bad Request`, `Unauthorized`, `Not Found`, `Conflict`, `Internal Server Error`).
- `status`: entero igual al código HTTP real.
- `detail`: explicación en español; se incluye cuando aporta información.
- Prohibido devolver `statusCode`, `message` o `error` como campos del body.
- Varios errores de validación se unen en un solo `detail` separado por `; `.
- Un 500 no expone stack trace ni detalles internos.
- Un 204 no lleva cuerpo.

### 2.5 El dinero se calcula con decimales, no con flotantes ingenuos

- Se usa `Decimal` / `numeric(12,2)`.
- Redondeo `HALF_UP` a 2 decimales.
- Fórmulas:
  - `descuento_cupon` se obtiene del cupón; 0.00 si no hay cupón.
  - `igv = (subtotal - descuento_cupon) * 0.18`.
  - `total = (subtotal - descuento_cupon) + igv`.
- El total se calcula desde los componentes ya redondeados para que el cliente vea consistencia contable.
- El descuento nunca supera el subtotal.
- La respuesta JSON expone números, no strings de decimales.

### 2.6 La máquina de estados es estricta

Flujo permitido:

```text
PENDIENTE -> CONFIRMADO -> PREPARANDO -> LISTO -> ENTREGADO
```

- No se permiten saltos, retrocesos ni transiciones al mismo estado.
- `ANULADO` solo se alcanza con `DELETE /ordenes/{id}`.
- `PATCH` no puede establecer `ANULADO`.
- Cada transición registra su timestamp:
  - `PENDIENTE -> CONFIRMADO`: `confirmacion_at`
  - `PREPARANDO -> LISTO`: `listo_at`
  - `LISTO -> ENTREGADO`: `entrega_at`
- Un `DELETE` sobre `ENTREGADO` o `ANULADO` devuelve 409.
- La transición se ejecuta con actualización condicional para evitar carreras.

### 2.7 El SLA se calcula, no se confía

- `alerta_sla` es un valor calculado por el servidor.
- Se basa en el tiempo transcurrido desde `ingreso_at` y el límite configurado para la sucursal.
- Solo las órdenes en estados activos pueden estar en alerta.
- Una orden `ENTREGADO` o `ANULADO` no genera alerta.
- El límite se toma como snapshot al crear la orden para que un cambio posterior de configuración no altere el historial.

### 2.8 La numeración es única y concurrente

- Formato: `ORD-AAAA-NNN`, mínimo 3 dígitos.
- Única por sucursal.
- Año de negocio en `America/Lima`.
- Generación con contador atómico (`orden_secuencias`) y restricción única `(sucursal_id, numero_orden)`.
- Si hay colisión, se reintenta; si persiste, 409.
- No se usa `MAX(numero_orden) + 1` sin bloqueo.

### 2.9 Cada cambio se prueba

- Toda tarea incluye pruebas unitarias y/o e2e según corresponda.
- Los caminos felices no son suficientes: se prueban 400, 401, 404, 409 y 500 cuando aplique.
- Los endpoints se validan contra el contrato con pruebas de contrato.
- La suite de aislamiento multiempresa es obligatoria.
- Las transiciones de estado y la numeración se prueban en concurrencia.

### 2.10 La seguridad es parte del diseño

- JWT validado en firma, expiración y claims.
- `empresa_id` obligatorio en el token.
- Sin secretos en el código ni en logs.
- Validación estricta de entrada y sanitización.
- HTTPS en despliegue.
- Rate limiting preferentemente en gateway/WAF; si se implementa en la app, 429 también usa `application/problem+json`.
- Revisión contra OWASP API Top 10.

---

## 3. Reglas de arquitectura

- Monolito modular NestJS.
- Capas: controller → service → repository/Prisma.
- Los controllers no contienen lógica de negocio ni acceso a datos.
- Los servicios no conocen detalles HTTP.
- Los DTO validan la entrada; los mappers construyen la respuesta exacta del contrato.
- No se devuelven entidades Prisma directamente.
- No se exponen columnas internas como `sla_minutos`.
- Los nombres de respuesta son `snake_case`; el dominio interno puede usar `camelCase`.
- Las fechas se almacenan en UTC y se serializan en ISO 8601.
- Las rutas fijas se declaran antes que las paramétricas: `/ordenes/alertas` antes que `/ordenes/{id}`.

---

## 4. Reglas para la IA

La IA debe:

1. Leer `constitution.md`, `openapi.yaml`, `spec.md`, `plan.md` y la tarea exacta antes de escribir código.
2. Ejecutar **una tarea por vez**.
3. No añadir dependencias sin aprobación.
4. No modificar el contrato.
5. No inventar reglas de negocio.
6. Detenerse y preguntar si encuentra una ambigüedad.
7. Entregar:
   - archivos modificados,
   - pruebas,
   - comandos ejecutados,
   - resultados,
   - dudas o supuestos.
8. No “mejorar” el alcance por iniciativa propia.
9. No añadir `traceId`, `details`, `403`, `422` o `429` al body/contrato sin aprobación.
10. Registrar el prompt y las correcciones humanas en `prompts.md`.

La IA no debe:

- Cambiar el `openapi.yaml`.
- Implementar endpoints de autenticación, catálogos o webhooks.
- Suponer roles o scopes que el contrato no define.
- Ocultar errores de validación en un mensaje genérico.
- Usar `Number` o `parseFloat` para cálculos monetarios.
- Concatenar SQL con datos del usuario.
- Devolver stack traces.

---

## 5. Reglas de revisión humana

La persona revisora debe verificar:

- Que la tarea no haya cambiado el contrato.
- Que los DTO rechacen campos extra.
- Que `empresa_id` no se acepte desde el cliente.
- Que los errores cumplan `application/problem+json`.
- Que `status` coincida con el código HTTP.
- Que 201 incluya `Location`.
- Que 204 no tenga body.
- Que los cálculos monetarios usen decimales y redondeo correcto.
- Que la numeración sea atómica y única.
- Que la máquina de estados no permita saltos.
- Que el SLA solo aplique a estados activos.
- Que las pruebas cubran errores y aislamiento multiempresa.
- Que el prompt y los resultados estén registrados.

---

## 6. Definición de terminado

Una tarea está terminada cuando:

- [ ] Cumple el contrato y esta constitución.
- [ ] Tiene pruebas que pasan.
- [ ] No introduce campos, rutas ni códigos no aprobados.
- [ ] La respuesta está mapeada explícitamente.
- [ ] Los errores usan `application/problem+json`.
- [ ] Se registró el prompt y la revisión humana en `prompts.md`.
- [ ] El CI local (lint, typecheck, tests) está verde.

El proyecto está terminado cuando, además:

- [ ] Las 7 operaciones están implementadas.
- [ ] Las pruebas de contrato pasan al 100 %.
- [ ] La suite de aislamiento multiempresa pasa.
- [ ] Las pruebas de concurrencia de numeración y estados pasan.
- [ ] El README permite levantar el API desde cero.
- [ ] `revision.md` está aprobado.
