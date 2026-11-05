# Planes versionados y membresías

Implementa RF-009–RF-014 con las decisiones DN-01–DN-14 de `business-rules.md`. Paciente, cuenta, contrato y período pagado son registros distintos. Las operaciones no dependen del nombre de un rol. No se crea una membresía al activar una cuenta.

## Instalación

```powershell
npm run db:migrate
npm run permissions
```

La migración `202611040002-plans-memberships.ts` agrega `plans`, `plan_versions`, `memberships`, `membership_periods`, `membership_billing_jobs` y `recurrente_events`. Conserva pacientes, cuentas y clínicas existentes. No siembra precios comerciales, membresías ni cobros. No usar reset para actualizar una base con datos. La reversión de esta migración elimina estas tablas; no constituye una cancelación ante el proveedor ni detiene suscripciones externas.

## Planes y precio contratado

El plan tiene un código estable, estado habilitado y una referencia a su revisión publicada. Cada revisión conserva nombre, descripción, textos de beneficios, importe mensual final en centavos GTQ y explicación fiscal `taxDisclosure`. El importe anual se calcula en servidor como diez mensualidades; no se admite otro importe anual enviado por el cliente. Los precios son enteros, nunca valores monetarios en coma flotante.

Solo se usa GTQ. El importe mensual admite 500–100000000 centavos; el mínimo técnico de checkout en Recurrente es Q5. Los importes concretos todavía los debe definir administración. `monthlyPriceCents` debe ser el total final que se cobrará, con los impuestos aplicables ya considerados; el código no añade una tasa fiscal supuesta ni implementa FEL. El texto fiscal es obligatorio al crear una revisión. Antes de habilitar cobros hay que definir el precio final y configurar los datos fiscales de la cuenta de Recurrente.

Crear una revisión no la publica. Publicar es una acción explícita que cambia inmediatamente la revisión visible y la oferta para nuevos contratos. Las revisiones anteriores permanecen inmutables; no se pueden editar, borrar o truncar por las operaciones SQL ordinarias protegidas. Para corregir o volver a condiciones anteriores se crea otra revisión. Una revisión publicada histórica no se vuelve a publicar sobre otra; repetir la publicación de la revisión actual es idempotente.

Cada membresía guarda `planVersionId`, `amountCents`, `currency` y `cadence` propios. PostgreSQL impide reescribir esos campos o cambiar el paciente contratado. Una revisión nueva no modifica esos importes, ni los cobros de renovación del mismo contrato. La respuesta separa:

- `contractedVersion`: revisión inmutable aceptada y sus condiciones comerciales.
- `amountCents`/`currency`/`cadence`: importe y modalidad del contrato.
- `currentBenefits`: información publicada actual, sin sustituir el importe contratado por el precio de la revisión nueva.

Los textos de beneficios pueden cambiar para los miembros actuales. Son contenido comercial; el motor de cupos, descuentos y consumos del paso 6 se documenta en benefits.md. Cada consumo registra la revisión operativa aplicada.

Deshabilitar un plan impide nuevos contratos y nuevas sesiones de checkout pendientes. No cancela los contratos pagados ni elimina su información actual. Un checkout ya emitido tiene una cotización de 30 minutos; se conserva su precio durante esa ventana aunque cambie la oferta. Una membresía pendiente sin checkout debe seguir apuntando a la revisión publicada vigente al iniciar el pago; si quedó antigua, se cancela la pendiente y se elige la nueva oferta.

## Estados, períodos y exclusividad

Una membresía se crea `pending`, sin acceso y sin período pagado. Solo un pago confirmado con el proveedor puede agregar un período. La API no expone `activate`, `mark-paid`, edición de vencimientos ni escritura de saldos. Crear una pendiente desde administración tampoco equivale a cobrar.

Hay un contrato abierto por paciente, respaldado por bloqueo del paciente e índice único parcial. La exclusividad se aplica globalmente, no por clínica. Mensual y anual son modalidades del mismo plan; ambas renuevan automáticamente en Recurrente salvo cancelación, según la confirmación del dueño. No hay cambio de modalidad ni traslado entre planes durante el contrato.

Estados calculados en cada consulta:

| Estado | Comportamiento |
| --- | --- |
| `pending` | Aún no existe un período pagado. |
| `active` | El instante actual está dentro de la cobertura pagada. |
| `expired` | Terminó la cobertura y no hay renovación confirmada. |
| `suspended` | Administración suspendió el acceso, con efecto inmediato. |
| `cancelled` | La cancelación ya no conserva cobertura pagada o el contrato está cerrado. |

`eligible` indica la vigencia pagada de la membresía en ese instante. No sustituye la autorización del recurso, la identidad verificada ni los controles de paciente/clínica que deberán aplicar los próximos módulos. La vigencia usa intervalos `[inicio, fin)`: al llegar al vencimiento se pierde el acceso, sin días de gracia y sin depender de un cron.

La zona de aniversario es `America/Guatemala`. Se conserva el día y hora originales: una contratación el 31 termina en el último día de un mes corto y recupera el 31 cuando vuelve a existir. Una contratación el 29 de febrero recupera ese aniversario en otro año bisiesto. El cálculo no depende de la zona horaria del servidor.

Cada pago agrega una fila inmutable en `membership_periods`, con su ID del proveedor, importe, fecha, secuencia e intervalo. Una renovación anticipada empieza donde termina la cobertura ya pagada. Un pago tardío conserva el aniversario original y no crea un nuevo aniversario al reintentarlo. No habilita acceso durante el tiempo en que estuvo impagado. Un pago que llega fuera de todo el siguiente período esperado queda en revisión: no se inventa una política para cobrar varios meses omitidos, condonar deuda o imputarlo a otro período.

La primera implementación verifica cobros con tarjeta de liquidación inmediata y toma `created_at` del intent confirmado como instante del cobro. No aplica ese supuesto a transferencias, efectivo, balances, capturas diferidas o eventos de autorización. Esos medios necesitan una adaptación con su fecha de liquidación antes de habilitarse. La validación con un Sandbox real debe comprobar los horarios de renovación del proveedor frente al aniversario local, incluidos meses cortos y cambios de año. No se debe adelantar un Test Clock del proveedor sin coordinar el reloj usado para evaluar la membresía.

Una cancelación conserva toda la cobertura confirmada y encola la detención de futuras renovaciones. Una suspensión bloquea `eligible` inmediatamente y encola la pausa de Recurrente, conservando el vencimiento original. No se prolonga el período. Se distingue el estado local del contrato de la confirmación de la operación externa.

`billingSync` muestra `not-started`, `active`, `pending`, `paused`, `stopped` o `review`. Que exista `cancelRequestedAt` no prueba que Recurrente ya haya confirmado la detención; `stoppedAt` y el trabajo durable registran esa confirmación. Una cancelación sin checkout ni suscripción externa se cierra inmediatamente. Un contrato pagado no libera la exclusividad antes de terminar su cobertura y confirmarse la detención. Un checkout emitido que aún no tiene suscripción conocida tampoco se da por impagado únicamente porque haya pasado su expiración local: se consulta al proveedor; si estaba pagado se recupera el intent para procesarlo antes de confirmar la detención. Al volver a contratar después del cierre, se usa la revisión y el precio vigentes. La reactivación de una suspensión y los prorrateos no se habilitan por suposición.

## Rutas y permisos

Todas las rutas están bajo `/api/v1`.

| Método | Ruta | Permiso |
| --- | --- | --- |
| POST | `/plans` | `plans:create` |
| GET | `/plans` | `plans:list` |
| GET | `/plans/:id` | `plans:read` |
| POST / GET | `/plans/:id/versions` | `plans:version` / `plans:read` |
| POST | `/plans/:id/versions/:versionId/publish` | `plans:publish` |
| PATCH | `/plans/:id` | `plans:update`; cuerpo `{ enabled }` |
| GET | `/plans/catalog` | `plans:catalog`; solo publicados y habilitados |
| POST / GET | `/memberships` | `memberships:create` / `memberships:list` |
| GET | `/memberships/:id` | `memberships:read` |
| GET | `/memberships/:id/periods` | `memberships:read` |
| POST | `/memberships/:id/cancel` | `memberships:cancel` |
| POST | `/memberships/:id/suspend` | `memberships:suspend` |
| POST / GET | `/memberships/me` | `memberships:self`; paciente vinculado en servidor |
| GET | `/memberships/me/:id` | `memberships:self`; propiedad verificada |
| GET | `/memberships/me/:id/periods` | `memberships:self`; propiedad verificada |
| POST | `/memberships/me/:id/checkout` | `memberships:self`; no admite precios ni URLs del cliente |
| POST | `/memberships/me/:id/cancel` | `memberships:self`; propiedad verificada |
| POST | `/webhooks/recurrente` | Firma Svix válida; no JWT de usuario |
| POST | `/internal/jobs/memberships/dispatch` | Google OIDC del job configurado |

Crear un plan recibe `{ code }`. La primera revisión de Blue Care + debe usar su nombre comercial y el precio que apruebe el dueño, no un precio de fixture. Crear una revisión recibe `name`, `description`, `benefitDescriptions: string[]`, `monthlyPriceCents` y `taxDisclosure`. No admite `annualPriceCents` ni otra moneda.

Crear una membresía propia recibe `{ planVersionId, cadence: "monthly" | "annual" }`. La administrativa agrega `patientId`. La propiedad se obtiene de la relación paciente–cuenta, no de roles, correo enviado o parámetros `userId`. Los cuerpos administrativos y acciones admiten `reason` opcional validado para auditoría.

Listados usan `limit` 1–100 (defecto 25) y `offset`; la lista administrativa de membresías también permite `patientId`. No se admiten filtros ni estados arbitrarios. Las operaciones administrativas de membresías aplican el mismo alcance de pacientes: clínicas activas asignadas o `clinics:all`, además del permiso de operación. Fuera de alcance se responde 404. Los contratos y períodos siguen siendo globales aunque varias clínicas tengan acceso.

Superadmin recibe el catálogo mediante `*`. Admin y customer reciben `plans:catalog` y `memberships:self`; no reciben automáticamente administración comercial global. La delegación sigue limitada a los permisos del operador. Los roles personalizados y asignaciones de clínicas controlan la operación del personal.

## Recurrente y variables

La integración está apagada por defecto:

```dotenv
RECURRENTE_ENABLED=false
RECURRENTE_MODE=test
RECURRENTE_SECRET_KEY=
RECURRENTE_WEBHOOK_SECRET=
FRONTEND_URL=http://localhost:5173
```

Para probar con proveedor, crear un Sandbox nombrado siguiendo [Primer pago de prueba](https://docs.recurrente.com/guias-espanol/comenzar/primer-pago-de-prueba). Configurar su clave `sk_test_...`, registrar el endpoint público HTTPS `/api/v1/webhooks/recurrente`, obtener su signing secret `whsec_...` y habilitar `RECURRENTE_ENABLED=true`. `RECURRENTE_MODE=live` exige una clave `sk_live_...` y frontend HTTPS; no mezclar modos. Las claves de organización no sirven para crear cobros y no se admiten aquí. Nunca guardar claves en este documento ni en Git.

La API del proveedor usa el origen fijo `https://app.recurrente.com/api` y `X-SECRET-KEY`. No se necesita una API pública adicional para estas operaciones de servidor. El checkout se crea con un único producto recurrente inline, precio contractual, GTQ y tarjeta. No se habilitan trials, prorrateos, diferimiento del primer cobro, cambios de productos o cargos adicionales en la suscripción. Esas operaciones tampoco deben configurarse fuera de esta integración sin ampliar su conciliación.

Los retornos del navegador apuntan a `/membership/checkout/success` y `/membership/checkout/cancel` bajo `FRONTEND_URL`; sus pantallas siguen pendientes del frontend. Esos retornos no activan la membresía. El cliente debe consultar su contrato y esperar la confirmación del backend.

Referencias del adaptador: [crear checkout](https://docs.recurrente.com/referencia-api/api-reference/checkouts/create-checkout), [intent unificado](https://docs.recurrente.com/referencia-api/api-reference/intents/get-intent), [webhooks y firma](https://docs.recurrente.com/guias-espanol/comenzar/webhooks), [pausar suscripción](https://docs.recurrente.com/referencia-api/api-reference/subscriptions/update-subscription) y [cancelar suscripción](https://docs.recurrente.com/referencia-api/api-reference/subscriptions/cancel-subscription). Debe verificarse con las credenciales reales de Sandbox antes de habilitar producción; las pruebas automatizadas no crean cargos reales.

## Durabilidad, conciliación y workers

La creación del checkout reserva su estado en PostgreSQL antes de llamar a Recurrente. Dos solicitudes simultáneas no crean dos sesiones. No se supone que un header de idempotencia no documentado funcione. Si se pierde la respuesta, el contrato queda `review` y no se repite automáticamente el POST externo. Un estado `creating` abandonado pasa a revisión tras cinco minutos. La verificación posterior de un pago asociado puede conciliar esa creación. No hay una API para inventar una URL o marcar un pago manualmente.

El webhook verifica el body original y los headers `svix-id`, `svix-timestamp` y `svix-signature`, con HMAC-SHA256 y tolerancia de cinco minutos. Se confirma recepción únicamente después de guardar el ID de mensaje, tipo y recurso en `recurrente_events`. No se almacenan cuerpos completos con datos fiscales o de tarjeta. Los reintentos de transporte se deduplican por ID de mensaje, y los pagos por ID canónico del intent.

El worker consulta `GET /intents/:id` con sus propias credenciales antes de asignar un período; no confía en el importe del webhook o del navegador. Comprueba contrato, checkout/suscripción, importe, moneda, instante y secuencia. Si el pago ocurrió antes de una solicitud de cancelación que adelantó a su webhook, se reconoce la cobertura pagada y se conserva la orden de detener cobros. El período, la cobertura, auditoría, bandeja, outbox de email y finalización del evento se confirman en una sola transacción. Si falla alguno, se revierte la asignación y se reintenta.

Importes incorrectos, recursos desconocidos, medios no soportados, pagos fuera del período esperado o pagos posteriores a una detención quedan en `review`; no se asignan beneficios ni se reembolsa automáticamente. Si se identifica una suscripción de contrato detenido, se vuelve a encolar su detención/pausa aunque antes no se conociera el ID externo. Ante importes/períodos incompatibles se solicita pausa para evitar seguir cobrando sin conciliación. Reembolsos y contracargos requieren todavía reglas expresas y no se traducen en transiciones financieras inventadas.

Procesamiento local de un lote acotado:

```powershell
npm run memberships:drain
npm run notifications:drain
```

El primer comando procesa hasta 25 eventos y 25 comandos de cobro, con leases, recuperación de procesos interrumpidos y backoff de hasta una hora. No usa SMTP dentro de transacciones. El segundo procesa los emails durables con el proveedor existente; Mailpit conserva `localhost:1025` y bandeja `localhost:8025`. Sin credenciales de Recurrente no se crean checkouts ni se verifican pagos ficticios.

En Google Cloud, después de configurar ADC/IAM y las variables ya existentes de jobs:

```dotenv
GCP_MEMBERSHIP_SCHEDULE_ID=blue-care-memberships-sweep
GCP_MEMBERSHIP_SCHEDULE=* * * * *
```

```powershell
npm run gcp:scheduler:sync -- --memberships
```

Este comando explícito configura el barrido OIDC de membresías; sin `--memberships` conserva el de notificaciones. `--remove --memberships` retira únicamente ese job. El arranque de la API no crea recursos cloud ni inicia workers solo en memoria. La cola durable está en PostgreSQL; ejecutar el cron/worker es necesario para confirmar pagos y detener cobros de forma eventual.

El resultado de `memberships:drain` informa pagos, comandos procesados y revisiones pendientes. Para conciliación operacional se consultan `recurrente_events.status/errorCode/resourceId/membershipId` y `membership_billing_jobs.status/attempts/errorCode/nextAttemptAt`. Nunca cambiar manualmente `paidThrough` para resolver un pago incierto. El panel de conciliación y los flujos de corrección financiera siguen pendientes; los casos en revisión requieren contrastar evidencia del proveedor y definir su tratamiento antes de una corrección.

## Auditoría y validación

Eventos: `plan.created`, `plan.version-created`, `plan.published`, `plan.updated`; `membership.created`, `membership.payment-confirmed`, `membership.cancellation-requested`, `membership.suspended`, `membership.billing-stopped`, `membership.provider-cancelled`, `membership.payment-review` y `membership.closed`. Los cambios sensibles guardan snapshots seleccionados; no incluyen checkout URL, tokens, claves ni el cuerpo del proveedor. Los avisos de membresía son generales y usan el outbox existente.

Las pruebas usan PostgreSQL desechable, pasarela y correo sustituidos. Cubren publicación/versionado, exclusividad concurrente, propiedad/sede, firmas originales, deduplicación, vigencia y calendario, precios conservados, actualización de textos, renovaciones anticipadas, errores de auditoría/outbox, cancelación, pausa y no repetición de POST inciertos. Google Cloud, correo externo y Recurrente reales no se han ejecutado.

Validación registrada al cerrar este paso: 230 pruebas unitarias y 67 de integración; build, tipos, lint y formato correctos. La comprobación funcional con Recurrente Sandbox real queda pendiente de sus credenciales y configuración comercial/fiscal.


Actualización del paso 6: beneficios cuantificables y revisiones publicables implementados en benefits.md. El contenido comercial del plan continúa separado de reglas operativas y del precio contratado; DN-15 define aplicación inmediata de beneficios y períodos por aniversario.
