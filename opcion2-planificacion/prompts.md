# Bitácora de prompts y correcciones — Opción 2

| Campo | Valor |
|---|---|
| **Documento** | `prompts.md` |
| **Versión** | 1.0 |
| **Fecha** | 2026-11-13 |
| **Contrato** | `openapi.yaml` 1.2.0 |
| **Propósito** | Registrar qué se le pidió a la IA, qué produjo y qué corrigió la persona |

> Este registro no es decorativo. El material del curso pide “mostrar el prompt de Plan y Ejecución” y “registrar prompts para saber qué generó la IA”. Además, alimenta la reflexión final: **¿dónde falló la IA?**

---

## 1. Reglas de uso

1. Cada prompt debe incluir rol, contexto, contrato, alcance, restricciones, criterios y salida esperada.
2. Una tarea por prompt. No se pide “haz todo el API” de una vez.
3. Si la IA encuentra una ambigüedad, debe detenerse y preguntar.
4. La persona revisa el diff, las pruebas y el cumplimiento del contrato.
5. Toda corrección humana se registra.
6. No se copian tokens, secretos ni datos personales en la bitácora.

---

## 2. Prompt para generar la especificación

```text
1. ROL Y CONTEXTO
Actúa como analista funcional senior de APIs REST y especificación de software.
Contexto: curso Taller de Construcción de Software Web, opción 2 (Spec-Driven Development).
La entidad es Orden, de un SaaS de restaurantes multitenencia.

2. CONTRATO
Adjunto openapi.yaml v1.2.0. Es la fuente de verdad.
No modifiques el contrato ni inventes endpoints.

3. ALCANCE
Genera una especificación funcional (spec.md) que describa QUÉ debe hacer el API:
7 operaciones, 22 campos de Orden, multitenencia, cálculos, estados, SLA y errores.
No incluyas decisiones de implementación (stack, carpetas, ORM).

4. RESTRICCIONES
- Separa hechos del contrato y supuestos.
- Identifica ambigüedades (cupón, SLA, numeración, roles, etc.).
- Usa criterios de aceptación verificables.
- Errores en application/problem+json (RFC 7807/9457).
- No agregues endpoints, roles, scopes, 403, 422 ni 429.

5. CRITERIOS
Incluye:
- alcance dentro/fuera,
- actores y glosario,
- historias de usuario,
- requisitos funcionales FR-xxx,
- reglas de negocio BR-xxx,
- requisitos no funcionales NFR-xxx,
- criterios de aceptación AC-xxx,
- supuestos A-xx,
- matriz de trazabilidad.

6. SALIDA ESPERADA
Un archivo Markdown completo, en español, con tablas y ejemplos.
Marca explícitamente lo que es supuesto y requiere revisión humana.
```

**Resultado:** `spec.md` con 8 historias, 24 FR, 18 BR, 10 NFR, 44 AC y 20 supuestos.

**Correcciones humanas:**

- Se aclaró que el contrato usa RFC 7807 y que RFC 9457 es su actualización compatible.
- Se eliminó la idea de agregar `traceId` y `details` al body: el contrato no los define.
- Se separó “403 no aplica” de “401 sí aplica”.
- Se documentó la tensión entre `DELETE` idempotente y el 409 del contrato.

---

## 3. Prompt para generar el plan técnico

```text
1. ROL Y CONTEXTO
Actúa como arquitecto backend senior en NestJS + TypeScript + PostgreSQL + Prisma.
Contexto: el API debe implementar exactamente openapi.yaml v1.2.0.
Lee spec.md y constitution.md antes de responder.

2. CONTRATO
Adjunto openapi.yaml v1.2.0. No lo modifiques.
La implementación debe cumplir las 7 operaciones y el formato de error problem+json.

3. ALCANCE
Genera plan.md: arquitectura, modelo de datos, algoritmos, seguridad, pruebas,
CI, observabilidad, riesgos y fases. No escribas el código todavía.

4. RESTRICCIONES
- Monolito modular NestJS, capas controller/service/repository.
- empresa_id solo desde JWT.
- Dinero con Decimal y HALF_UP.
- Numeración atómica.
- Estados con UPDATE condicional.
- SLA calculado en lectura.
- Sin endpoints ni campos fuera del contrato.
- Sin dependencias innecesarias.

5. CRITERIOS
Explica cómo se cumplen FR-001…FR-024 y NFR-001…NFR-010.
Incluye estrategia de pruebas unitarias, e2e y de contrato.
Incluye riesgos y mitigaciones.

6. SALIDA ESPERADA
Un archivo Markdown completo, en español, con tablas y estructura de carpetas.
```

**Resultado:** `plan.md` con stack, arquitectura, modelo de datos, algoritmos, pruebas, CI, riesgos y 7 fases.

**Correcciones humanas:**

- Se añadió el header `Location` en los 201, aunque el contrato no lo exige.
- Se decidió que `X-Request-Id` va en header y no en el body.
- Se documentó que `DELETE` repetido devuelve 409 por contrato, no 204.
- Se añadió la matriz IA vs. persona y la estrategia de prompts del material del curso.

---

## 4. Prompt para generar las tareas

```text
1. ROL Y CONTEXTO
Actúa como tech lead que convierte un plan técnico en tareas atómicas ejecutables por IA.
Lee spec.md, plan.md y constitution.md.

2. CONTRATO
Adjunto openapi.yaml v1.2.0. Cada tarea debe respetarlo.

3. ALCANCE
Genera tasks.md con tareas pequeñas, ordenadas por fases y dependencias.
Cada tarea debe poder ejecutarse en una sola sesión de IA.

4. RESTRICCIONES
- Una operación o componente por tarea.
- Incluye archivos, instrucción, verificación y estimación.
- Incluye pruebas felices y de error.
- Nada de tareas genéricas como “implementar todo el API”.
- Si una tarea depende de una decisión abierta, indícalo.

5. CRITERIOS
Cada tarea debe referenciar FR/AC y tener un comando o criterio de verificación.
Incluye gates de revisión humana y registro en prompts.md.

6. SALIDA ESPERADA
Un archivo Markdown con fases, tabla resumen y tarjetas T-001…T-069.
```

**Resultado:** `tasks.md` con 69 tareas en 7 fases.

**Correcciones humanas:**

- Se agruparon DTO + service + controller por endpoint para no fragmentar demasiado.
- Se separaron las pruebas e2e de cada endpoint.
- Se agregaron tareas de contrato, concurrencia, seguridad y evidencia.
- Se incluyó el prompt base de 6 partes del material del curso.

---

## 5. Prompt de ejecución por tarea

```text
1. ROL Y CONTEXTO
Eres desarrollador backend senior en NestJS + TypeScript + PostgreSQL + Prisma.
Lee constitution.md, openapi.yaml, spec.md, plan.md y la tarea T-XXX.

2. CONTRATO
openapi.yaml v1.2.0 es la fuente de verdad. No lo modifiques.
No agregues endpoints, campos, estados, códigos HTTP ni dependencias.

3. ALCANCE
Implementa únicamente T-XXX: <título>.
No refactorices otras partes ni “mejores” el contrato.

4. RESTRICCIONES
- Errores: application/problem+json con type, title, status, detail.
- Prohibido statusCode, message y error.
- empresa_id solo desde JWT.
- DTOs con lista blanca estricta.
- Dinero con Decimal y HALF_UP.
- Si hay ambigüedad, detente y pregunta.

5. CRITERIOS Y PRUEBAS
Cumple los AC indicados.
Incluye pruebas unitarias/e2e/contrato.
Prueba 400, 401, 404, 409 y 500 cuando aplique.

6. SALIDA ESPERADA
Archivos modificados, diff resumido, comandos, resultados y dudas.
```

---

## 6. Prompt de revisión

```text
Actúa como revisor senior. No escribas código nuevo.
Revisa el diff de T-XXX contra:
1. openapi.yaml v1.2.0.
2. constitution.md.
3. Los AC de la tarea.

Verifica:
- Que no se haya modificado el contrato.
- Que los DTOs rechacen campos extra.
- Que empresa_id no venga del cliente.
- Que los errores usen application/problem+json.
- Que status coincida con el HTTP.
- Que 201 incluya Location y 204 no tenga body.
- Que los cálculos usen Decimal y HALF_UP.
- Que la numeración y los estados sean atómicos.
- Que las pruebas cubran errores y tenant.

Devuelve:
- hallazgos por severidad,
- evidencia,
- cambios requeridos,
- veredicto: aprobar o devolver.
```

---

## 7. Bitácora

| Fecha | Artefacto / tarea | Prompt | Resultado | Corrección humana | Lección |
|---|---|---|---|---|---|
| 2026-11-13 | Lectura del contrato | Analizar `openapi.yaml` v1.1.0 | Se identificaron 7 operaciones y 22 campos | Se verificó que cumpliera “más de 10 columnas” | La IA debe contar y mapear, no asumir |
| 2026-11-13 | `spec.md` | Prompt de especificación | Borrador con FR/BR/AC y supuestos | Se separaron hechos y supuestos | Sin supuestos explícitos, la IA inventa |
| 2026-11-13 | `plan.md` | Prompt de plan técnico | Arquitectura NestJS/PostgreSQL/Prisma | Se añadió `Location` y `X-Request-Id` | La IA tiende a agregar campos no pedidos |
| 2026-11-13 | `tasks.md` | Prompt de tareas | 69 tareas en 7 fases | Se agruparon tareas por endpoint | “Una tarea por vez” reduce el scope creep |
| 2026-11-13 | Actualización del contrato | Pull a v1.2.0 | Cambió el error a RFC 7807 | Se actualizaron spec, plan, tasks y prompts | La IA debe releer el contrato, no confiar en la memoria |
| 2026-11-13 | Revisión | Prompt de revisión | Pendiente | Pendiente | La revisión humana es el último filtro |

---

## 8. Fallos típicos de la IA a vigilar

| Fallo | Ejemplo | Cómo detectarlo |
|---|---|---|
| Inventar reglas | Cupón sin modelo, SLA sin configuración | Supuestos sin marcar |
| Cambiar el contrato | Agregar `traceId`, `details`, 403 o 422 | Diff del YAML o del body |
| Serializar mal | `Decimal` como string, fechas raras | Contract tests y pruebas de tipo |
| Ignorar tenant | `findById(id)` sin `empresa_id` | Revisión de firmas y suite de aislamiento |
| Saltarse estados | `PENDIENTE -> LISTO` aceptado | Matriz de transiciones |
| Duplicar numeración | `MAX + 1` sin bloqueo | Prueba de concurrencia |
| Capturar `/alertas` como id | Ruta `:id` antes que `alertas` | Test de precedencia |
| Error no estándar | `statusCode`/`message` | Test de `application/problem+json` |
| Sobreingeniería | Microservicios, CQRS, colas | Revisión de alcance |
| Pruebas solo felices | Sin 400/401/404/409 | Cobertura de errores |

---

## 9. Preguntas para la reflexión final

1. ¿Qué partes del contrato eran ambiguas y la IA “resolvió” sin avisar?
2. ¿En qué momento la IA agregó campos o endpoints no pedidos?
3. ¿Qué errores detectaron las pruebas de contrato que la revisión visual no vio?
4. ¿Qué decisiones fueron realmente humanas y no delegables?
5. ¿Qué prompt produjo el mejor resultado y por qué?
6. ¿Qué cambiaríamos en la siguiente iteración del contrato?
7. ¿La IA falló por el prompt, por el contexto o por el contrato?
