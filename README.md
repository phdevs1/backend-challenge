# ClinicSay · Recordatorios de citas

API para clínicas, pacientes y citas, con recordatorio por mensaje el día anterior y respuesta SI/NO del
paciente. El enunciado está en [`enunciado.pdf`](enunciado.pdf) y el contrato en
[`openapi.yaml`](openapi.yaml) (no se modifica, igual que `provider/`).

**Stack:** Node 22, TypeScript estricto, Express 5, Prisma 7 sobre PostgreSQL, Zod 4, Vitest.

## Cómo levantarlo

```sh
docker compose up --build        # api en :3000 (CLOCK_MODE=test), db y provider; migra al arrancar
```

`GET /health` responde 200 cuando la base está conectada y migrada.

Para desarrollar sin Docker para la api:

```sh
docker compose up -d db provider   # db en el puerto 5433 del host
cd api && cp .env.example .env && npm install
npm run dev
```

### Probarlo a mano

```sh
J='content-type: application/json'
curl -X POST localhost:3000/clinics  -H "$J" -d '{"name":"Clínica Dental Sonrisa","timezone":"Europe/Madrid"}'
curl -X POST localhost:3000/patients -H "$J" -d '{"clinicId":"<id>","name":"Ana","phone":"+34600111222","acceptsReminders":true}'
curl -X PUT  localhost:3000/test/clock -H "$J" -d '{"now":"2027-03-01T08:00:00Z"}'
curl -X POST localhost:3000/appointments -H "$J" -d '{"clinicId":"<id>","patientId":"<id>","startsAt":"2027-03-28T10:00:00+02:00"}'
curl -X PUT  localhost:3000/test/clock -H "$J" -d '{"now":"2027-03-27T09:00:00Z"}'   # llega la hora del recordatorio
curl -X POST localhost:3000/jobs/reminders/run                                         # {"processed":1}
curl "localhost:4010/admin/messages?to=%2B34600111222"                                  # lo que recibió el paciente
curl -X POST localhost:3000/webhooks/inbound-messages -H "$J" \
  -d '{"messageId":"m1","from":"+34600111222","text":"Sí","receivedAt":"2027-03-27T10:00:00Z"}'
```

## Cómo pasar los tests

```sh
docker compose up -d db          # los tests de integración usan la base real
cd api
npm test                         # unitarios + HTTP + integración
```

La base `clinicsay_test` se crea y migra sola (`test/global-setup.ts`) y se vacía antes de cada test. Se puede
cambiar con `TEST_DATABASE_URL`. Antes de entregar pasa lo mismo que el CI
(`.github/workflows/ci.yml`):

```sh
npm run format:check && npm run typecheck && npm run lint && npm test && npm run build
```

El CI además levanta `docker compose up` y comprueba `/health`, `PUT /test/clock` y que las migraciones corrieron.

Los tests se nombran según lo que son: `*.unit.test.ts` (reglas puras), `*.routes.test.ts` (HTTP sin base de
datos) y `*.integration.test.ts` (app real con la base de pruebas y un reloj de test). El proveedor de mensajes se
sustituye por un falso (`test/helpers/fake-message-provider.ts`) que, como el real, no entrega dos veces la misma
`Idempotency-Key`.

## Decisiones

### Arquitectura

Una carpeta por funcionalidad en `api/src/` (`clinics/`, `patients/`, `appointments/`, `reminders/`, `inbound/`…)
y, dentro de cada una, capas con flujo en un solo sentido: `routes → controller → service → repository → db`.

- **Reglas de negocio separadas de la infraestructura.** Las reglas puras son funciones sin Express ni Prisma:
  `reminders/reminder-schedule.ts` (hora de envío), `reminders/reminder-text.ts`, `reminders/delivery.ts`
  (cuándo saltar, cuándo reintentar) e `inbound/reply.ts` (SI/NO). Se prueban con tests unitarios.
- **El tiempo es una dependencia.** Nadie llama a `new Date()` fuera de `shared/clock.ts`; los servicios reciben
  un `Clock`. Con `CLOCK_MODE=test` es el `TestClock` que mueve `PUT /test/clock`; sin ese modo el endpoint no
  existe (404).
- **El proveedor es una interfaz** (`clients/message-provider.ts`). La implementación HTTP traduce las respuestas a
  tres resultados: entregado, reintentar o rechazado.
- **Composición explícita** en `wiring.ts`, sin contenedor de inyección. `main.ts` la usa con la base real y los
  tests de integración con la de pruebas.
- **Errores:** los servicios lanzan errores de dominio (`ValidationError`, `NotFoundError`, `ConflictError`) y solo
  `shared/error-handler.ts` decide el código HTTP. Todo error sale como `{ "error": "<mensaje>" }`.
- **La cita y sus recordatorios son una unidad:** su repositorio los cambia siempre en una sola transacción.

### Cómo se evitan los envíos duplicados

- **Varias pasadas a la vez:** cada pasada reclama los recordatorios vencidos con un único
  `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)` que fija `locked_until`. Dos pasadas nunca reciben el
  mismo recordatorio, así que el proveedor no recibe dos llamadas para el mismo intento. Si una pasada muere, el
  bloqueo caduca (60 s) y otra reintenta.
- **Reintentos seguros:** la `Idempotency-Key` es el id del recordatorio y es la misma en todos los intentos. Si el
  proveedor entregó pero la respuesta se perdió (504, error de red, más de 5 s), el reintento no vuelve a entregar.
- **Reintentos:** a 1 minuto del primer fallo y a 5 del segundo; si falla el tercero, `failed`. Un 422 es `failed`
  sin reintentos. Los reintentos no esperan a que termine la franja de silencio. El plazo vive en
  `next_attempt_at`; `scheduledFor` no cambia.
- **Webhook:** el `messageId` se guarda en `inbound_messages` en la misma transacción que la acción. Un aviso
  repetido no hace nada; si algo falla a medias no queda guardado y el reintento del proveedor se procesa.
- **Quién ejecuta la pasada:** no hay cron dentro de la app. `POST /jobs/reminders/run` lo llaman los tests, y en
  producción lo llamaría un cron externo cada minuto. Como cada llamada es segura aunque se solape, da igual cuántas
  instancias haya.

### Zonas horarias

- La zona IANA es de la clínica; se valida al crearla (una zona inexistente o un offset fijo como `+01:00` es 400
  porque ignora el cambio de hora).
- La hora de envío es **la misma hora local del día anterior**, no 24 horas antes: así el ejemplo del enunciado
  (domingo 28/03/2027 a las 10:00 en Madrid) sale el sábado a las 10:00 de Madrid (09:00 UTC), 23 horas antes.
  Canarias va una hora por detrás de la península y también sigue sus cambios.
- Se hace con `Intl` (`shared/time-zone.ts`), sin librerías de fechas. Una hora local que no existe (el salto de
  primavera) se resuelve a la hora siguiente al salto; una que ocurre dos veces, a la primera.
- El texto del recordatorio usa la fecha y hora locales de la clínica.
- Orden de las reglas: día anterior → si ya pasó, ahora → fuera de la franja de silencio → `too_late` si no es
  anterior a la cita.

### Cosas que el enunciado deja abiertas y cómo las resolví

- **Franja de silencio:** de 21:00 (incluida) a 09:00 (excluida). A las 21:00 ya no se envía; a las 09:00 sí.
- **Saltar al enviar:** `no_phone` y `opted_out` se deciden cuando toca enviar, no al crear la cita. Orden:
  `too_late`, luego `opted_out`, luego `no_phone`.
- **Reprogramar:** solo se cancela el recordatorio pendiente; uno ya enviado se queda como `sent` y se crea otro.
  Una cita confirmada vuelve a `scheduled`.
- **`processed`:** recordatorios que la pasada trató (enviados, saltados o con un reintento programado).
- **«Ya empezó»:** se mide con el reloj del servicio, también en el webhook (no con `receivedAt`).
- **Webhook:** la respuesta va a la cita del último recordatorio `sent` a ese teléfono entre las no canceladas que
  no han empezado. Los mensajes que se ignoran también se registran por `messageId`.
- **Orden de errores:** al crear una cita, 404 (no existe la clínica o el paciente), luego 400 (paciente de otra
  clínica o fecha no futura). Al reprogramar: 404, luego 409 (cancelada o ya empezada), luego 400 (no futura).
- **Cancelar** una cita que ya empezó está permitido; cancelar dos veces responde 200 sin cambios.
- **Teléfono:** E.164 con la misma expresión que valida el proveedor. Varios pacientes pueden compartir teléfono.

### Qué descarté

- **Una cola o un planificador dentro de la app** (BullMQ, pg-boss, un `setInterval`): el enunciado define la
  pasada como un endpoint, y con `SKIP LOCKED` y la idempotency key la base ya da lo que hace falta sin añadir
  infraestructura.
- **Una librería de fechas** (Luxon, date-fns-tz): `Intl` cubre el caso y las pruebas fijan el comportamiento
  alrededor de los cambios de hora.
- **Un contenedor de inyección de dependencias:** son pocas piezas y `wiring.ts` se lee de arriba abajo.
- **Un estado `sending` para los recordatorios:** el contrato solo admite cinco estados, así que el reclamo vive en
  una columna aparte (`locked_until`) que no se expone.
- **Tests de detalles internos:** cada test sale del enunciado, del contrato o de una decisión de esta sección.

## Qué dejé fuera y qué haría con más tiempo

- **Ventana de carrera conocida:** si una cita se cancela justo entre el reclamo de un recordatorio y la llamada al
  proveedor (milisegundos), el mensaje puede salir. Se cerraría comprobando el estado en la misma sentencia que
  registra el intento (un estado intermedio o un `outbox`).
- **El cliente HTTP del proveedor:** sus tests solo cubren la traducción de códigos; la comprobación contra el
  `provider/` real fue manual. Con más tiempo lo cubriría con un test que levante ese servidor en el CI.
- **Observabilidad:** hoy solo hay `console.error` para fallos inesperados.
- No se pidieron y no están: autenticación, paginación, editar clínicas o pacientes, un proveedor real.

## Cómo lo llevaría a producción (500 clínicas, ~20 000 recordatorios al día)

La carga es pequeña: 20 000 al día son unos 14 por minuto de media, con picos a primera hora de la mañana al abrir
la franja. El cuello de botella es la latencia del proveedor, no la base de datos.

- **Pasada:** un cron externo (CronJob de Kubernetes o similar) llama al endpoint cada minuto. Varias instancias de
  la api no se pisan. Si la pasada tardara demasiado en un pico, se sube el tamaño de lote o la concurrencia, o se
  lanzan varias a la vez, que ya es seguro.
- **Proveedor real de WhatsApp:** plantillas aprobadas en lugar de texto libre, límites de envío por segundo,
  recibos de entrega como webhook (hoy «aceptado» y «entregado» son lo mismo), baja de cuentas y tratamiento del
  cambio de número. Se mantiene la `Idempotency-Key` y el contrato de tres resultados.
- **Base de datos:** Postgres gestionado con copias de seguridad. Los recordatorios crecen unos 7 millones al año;
  el índice `(status, scheduled_for)` mantiene barata la consulta de pendientes, y bastaría archivar o particionar
  por fecha los recordatorios antiguos.
- **Despliegue:** imagen Docker construida en el CI y desplegada por entorno, con los secretos en variables del
  entorno. Las migraciones hoy corren al arrancar el contenedor; con varias instancias las movería a un paso previo
  del despliegue. `CLOCK_MODE=test` nunca se activa fuera de pruebas.
- **Monitorización:** métricas de recordatorios por estado, de reintentos y de fallos del proveedor, y sobre todo el
  retraso entre `scheduledFor` y `sentAt`. Alertas si el retraso supera unos minutos, si sube la tasa de `failed` o
  si no se ejecuta ninguna pasada. Registros estructurados con el id del recordatorio y de la cita.

## Uso de la IA

Trabajé con Claude Code para implementar los endpoints, las reglas de recordatorio y sus tests, y usé el MCP de
context7 para comprobar la documentación vigente de Express 5, Prisma 7, Zod 4 y Vitest. Lo que dejé escrito para
que cualquier persona o agente pueda trabajar sin preguntar está en [`CLAUDE.md`](CLAUDE.md): arquitectura,
convenciones de tests y comandos. Los commits los hago yo.

Lo que cambié sobre lo que proponía: la estructura de carpetas (de capas técnicas a una carpeta por
funcionalidad) y el nombre de los tests por tipo (`unit`, `routes`, `integration`). Al revisar los tests de las
respuestas entrantes aparecieron dos errores de fechas en el propio test (una cita que ya había empezado y un
cálculo mal hecho del horario de verano) que hacían pasar un test sin probar lo que decía; se corrigieron y se
comprobó que el test falla si se rompe la regla.
