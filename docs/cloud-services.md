# Servicios de Blue Care: Google Cloud y correo

## Desarrollo actual

La API puede arrancar sin proyecto, credenciales ni recursos de Google Cloud. `GCP_JOBS_ENABLED=false` desactiva la publicación de tareas y rechaza todos los callbacks internos. No hay provisión automática al arrancar. Storage y Secret Manager son opcionales: solo se utilizan si se configura su bucket/secreto y se invocan sus operaciones.

El Mailpit existente publica SMTP en `localhost:1025` y su bandeja en http://localhost:8025. `.env.example` y la configuración local usan:

```dotenv
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_REQUIRE_TLS=false
EMAIL_FROM=Blue Care <no-reply@blue-dent.test>
FRONTEND_URL=http://localhost:5173
GCP_JOBS_ENABLED=false
```

No iniciar otro Mailpit en esos puertos. El identificador del contenedor no se utiliza como host. Si ejecutas la API dentro de Docker, `localhost` será ese contenedor: usa `SMTP_HOST=mailpit` si comparten una red Docker, o `host.docker.internal` para acceder al puerto publicado del host en Docker Desktop. `MAILPIT_UI_PORT` solo configura el compose opcional, no el transporte de la API.

Después de aplicar las migraciones y sincronizar permisos:

```powershell
npm run db:migrate
npm run permissions
npm run notifications:drain
```

`notifications:drain` procesa una única tanda de hasta 25 emails pendientes y deja de iniciar nuevas entregas tras 30 segundos, sin abrir un servidor HTTP. Repetirlo después del backoff para procesar reintentos. No usa temporizadores en memoria ni necesita Cloud Tasks. Los correos de invitación, activación y recuperación siguen enviándose durante la solicitud HTTP y usan el mismo transporte compartido; conservan sus respuestas y estados de entrega existentes. Las pruebas sustituyen el transporte y no envían mensajes.

## Credenciales de Google Cloud

No es obligatorio tener `service-account.json` en desarrollo. Preferir ADC (Application Default Credentials):

```powershell
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

Para probar con la identidad que se utilizará en producción, ADC admite impersonación de una cuenta de servicio:

```powershell
gcloud auth application-default login --impersonate-service-account ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

Tu usuario necesita permiso de impersonación sobre esa cuenta. `gcloud auth login` por sí solo configura la CLI y no reemplaza el login ADC para las bibliotecas de Node. Si el equipo entrega una clave JSON, puedes usar `GOOGLE_APPLICATION_CREDENTIALS` con su ruta absoluta, fuera del repositorio. No copiar claves de Kraken u otros proyectos. No incluir claves en la imagen Docker. En Cloud Run utiliza una identidad de servicio adjunta y deja esa variable sin definir.

Las URLs firmadas de Storage requieren capacidad de firma. Para ADC de usuario usar impersonación de una cuenta que pueda firmar, IAM Credentials habilitado y permisos `signBlob` adecuados; el acceso normal a objetos no basta para firmar. Nunca hacer público el bucket para resolver un error de firma.

Referencias: [ADC local](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment), [URLs firmadas](https://docs.cloud.google.com/storage/docs/access-control/signing-urls-with-helpers).

## Variables

| Variable | Uso |
| --- | --- |
| `GOOGLE_CLOUD_PROJECT` | Identificador del proyecto propio de Blue Care. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Ruta opcional a credenciales ADC; normalmente se deja sin definir. |
| `GCS_PRIVATE_BUCKET` | Nombre del bucket privado, sin `gs://`. |
| `GCP_CONFIG_SECRET` | Opcional: `projects/PROJECT/secrets/NAME/versions/VERSION`, JSON con valores string. Las variables del proceso y `.env` tienen prioridad. |
| `GCP_JOBS_ENABLED` | `false` hasta tener recursos, IAM y URL de callbacks configurados. |
| `GCP_LOCATION` | Región de Tasks y Scheduler, por ejemplo `us-central1`. |
| `GCP_TASKS_QUEUE` | Nombre corto de una cola existente o creada explícitamente con el comando de provisión. |
| `GCP_CALLBACK_URL` | Origen HTTPS de la API, sin `/api/v1`, query ni credenciales. |
| `GCP_JOBS_AUDIENCE` | Audiencia OIDC; normalmente el origen HTTPS de Cloud Run. Debe coincidir en Tasks, Scheduler y verificador. |
| `GCP_JOBS_SERVICE_ACCOUNT` | Email de la cuenta de servicio autorizada para invocar los jobs. |
| `GCP_NOTIFICATION_SCHEDULE_ID` | Nombre del job Scheduler; defecto `blue-care-notifications-sweep`. |
| `GCP_NOTIFICATION_SCHEDULE` | Cron del barrido; defecto `* * * * *`. |
| `GCP_SCHEDULER_TIME_ZONE` | Defecto `America/Guatemala`. |
| `NOTIFICATION_MAX_ATTEMPTS` | De 1 a 20; defecto 5. Fallos agotados quedan como `failed` para revisión. |
| `EMAIL_PROVIDER` | `smtp` para Mailpit/SMTP propio o `sendgrid` para el relay de SendGrid. |
| `SMTP_HOST`, `SMTP_PORT` | Host y puerto para proveedor `smtp`. |
| `SMTP_USER`, `SMTP_PASSWORD` | Vacíos para el Mailpit actual. |
| `SMTP_REQUIRE_TLS` | `false` para Mailpit; activar STARTTLS donde el servidor lo soporte. Puerto 465 usa TLS implícito. |
| `SENDGRID_API_KEY` | Clave privada con permiso Mail Send; obligatoria con proveedor `sendgrid`. |
| `EMAIL_FROM` | Remitente. Con SendGrid debe estar verificado. |
| `FRONTEND_URL` | Origen del frontend que recibe enlaces de acciones de cuenta. |

## SendGrid

```dotenv
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=YOUR_PRIVATE_SENDGRID_API_KEY
EMAIL_FROM=Blue Care <no-reply@YOUR_VERIFIED_DOMAIN>
```

El adaptador usa `smtp.sendgrid.net:587`, usuario literal `apikey` y la clave como contraseña, con STARTTLS obligatorio. No requiere un segundo password SendGrid ni afecta Google ADC. Guarda la clave en Secret Manager o en un secreto de despliegue, nunca en el frontend. `SMTP_*` no se utiliza cuando el proveedor es `sendgrid`.

Referencia: [SendGrid SMTP](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/integrating-with-the-smtp-api).

## Aprovisionamiento pendiente en Google Cloud

Habilitar Cloud Tasks, Cloud Scheduler, Storage y, si se usan, Secret Manager e IAM Credentials. Crear el bucket con acceso uniforme y prevención de acceso público, y preparar las identidades. No se ha creado ningún recurso real desde este cambio.

Separar permisos de ejecución de permisos de provisión:

| Identidad | Permisos necesarios según función |
| --- | --- |
| Runtime de la API | Acceso a objetos del bucket necesario, acceso al secreto concreto si se utiliza, `roles/cloudtasks.enqueuer` en la cola, `iam.serviceAccounts.actAs` sobre la identidad de los jobs. Para cancelar tareas necesita además `cloudtasks.tasks.delete`, que no está incluido en enqueuer. |
| Identidad que provisiona | Crear/consultar colas; crear/actualizar/eliminar jobs Scheduler; `actAs` sobre la identidad configurada en el job. Usar permisos limitados o roles administrativos solo para este operador. |
| Identidad de los jobs | `roles/run.invoker` en el servicio Cloud Run cuando este exija autenticación de plataforma. Debe coincidir exactamente con `GCP_JOBS_SERVICE_ACCOUNT`. |
| Agentes de Google | Conservar los roles de agente de servicio de Tasks/Scheduler y la capacidad de emitir los tokens OIDC según la configuración oficial. No confundirlos con la cuenta runtime. |

Cuando el proyecto esté listo, configurar las variables y ejecutar deliberadamente:

```powershell
npm run gcp:queue:ensure
npm run gcp:scheduler:sync
```

El primer comando de provisión crea la cola solo si falta y conserva ajustes existentes. La cola nueva limita concurrencia a 5 y tasa a 5/s, con hasta 20 intentos de transporte Cloud Tasks. Los intentos de entrega del outbox tienen su propio límite `NOTIFICATION_MAX_ATTEMPTS`. Scheduler actualiza o crea el job de recuperación. Para eliminar únicamente ese schedule: `npm run gcp:scheduler:sync -- --remove`.

Callbacks:

- `POST /api/v1/internal/jobs/notifications/deliver` con `{ "id": "UUID-de-entrega" }`.
- `POST /api/v1/internal/jobs/notifications/dispatch` para recuperar una tanda de pendientes.

Ambos exigen un ID token firmado por Google, audiencia configurada y email verificado de la cuenta de servicio autorizada. Los headers `X-CloudTasks-*` o `X-CloudScheduler` no autentican. No existe bypass de desarrollo. `@Public` solo excluye el JWT de usuarios; el guard OIDC sigue siendo obligatorio.

Referencias: [Tasks HTTP](https://docs.cloud.google.com/tasks/docs/creating-http-target-tasks), [autenticación Scheduler](https://docs.cloud.google.com/scheduler/docs/http-target-auth).

## Motor de notificaciones

Los módulos futuros importan `NotificationsModule` e inyectan `NotificationsUseCase`. `notify` recibe una clave estable por evento y destinatario, `userId`, `title`, `body`, `email` opcional y `deliverAt` opcional. El destinatario email se obtiene del usuario habilitado y verificado en servidor. No existe un endpoint público para enviar mensajes a otros usuarios.

La migración `202611030001-notifications.ts` agrega `notifications` y `notification_deliveries`. Inbox y outbox se guardan en una única transacción. La clave `(userId, eventKey)` impide duplicar el registro al repetir un evento. Cloud Tasks transporta únicamente el ID de entrega; el contenido permanece en PostgreSQL. Un fallo de publicación no borra el pendiente; Scheduler o el comando local lo recuperan.

Los repositorios actuales de usuarios, roles e invitaciones y los cambios confirmados de credenciales escriben auditoría e inbox/outbox dentro de su misma transacción mediante recordChange y persistNotification. Los futuros repositorios de membresías/beneficios deben utilizar esa integración explícita con su propia transacción; una llamada aislada a notify después del commit no garantiza atomicidad del negocio. No usar este outbox para contraseñas, tokens de recuperación ni información clínica sensible.

Los workers reclaman una entrega mediante una actualización atómica con lease de dos minutos. Solo un worker reclama el registro en condiciones normales; un proceso caído libera trabajo al vencer la lease. Un resultado viejo no pisa una lease nueva. El backoff crece hasta una hora. Los errores persistidos son códigos genéricos sin cuerpos, direcciones ni credenciales. Cambiar el email o deshabilitar/desverificar al destinatario cancela el envío pendiente a su contacto antiguo.

Entrega es al menos una vez: si SMTP acepta el mensaje y el proceso cae antes de confirmar en PostgreSQL, puede enviarse otra copia. Un `Message-ID` estable ayuda a identificarla, pero no garantiza deduplicación del proveedor. `sent` significa aceptado por SMTP; no confirma llegada al buzón, lectura ni ausencia de rebote. Falta integrar eventos de entrega de SendGrid si se necesita ese seguimiento.

`deliverAt` retrasa tanto la visibilidad en bandeja como el email. Tasks admite un horizonte limitado; si rechaza una fecha lejana, el pendiente se conserva para el barrido cuando llegue su fecha. `cancel(userId, key)` cancela lo aún pendiente y oculta la notificación; un envío ya iniciado puede llegar. Para reprogramar un evento, cancelar su clave anterior y registrar la nueva versión con otra clave.

La bandeja expone `GET /api/v1/notifications?limit=25&offset=0` y `PATCH /api/v1/notifications/:id/read`. Ambos usan el usuario de la sesión, nunca un `userId` enviado por el cliente. Los roles predeterminados reciben únicamente acceso a su propia bandeja.

Esta versión ofrece bandeja y email. Push/FCM, registro de dispositivos, preferencias por categoría, resúmenes y suscripciones a eventos de negocio específicos quedan para la integración móvil y las reglas de esos módulos; no se simulan como entregados. Cloud Tasks/Scheduler reemplazan la necesidad de Redis/BullMQ para estos procesos. Kraken se utilizó como referencia de lectura; no es dependencia ni se copiaron su multitenencia o persistencia MongoDB.

## Archivos y secretos

`FileStorage` conserva upload privado, eliminación y URLs de lectura firmadas por cinco minutos. Acepta JPEG/PNG/PDF hasta 10 MiB; el MIME declarado no sustituye inspección de contenido. Los casos de uso deben autorizar el recurso antes de llamar a `signedReadUrl`. No hay endpoint de archivos público ni vínculo clínico creado por este cambio. `GCP_CONFIG_SECRET` se carga antes de Nest; los scripts cloud también usan este cargador.

## Validación y puesta en marcha

Las pruebas automatizadas usan transportes y SDKs simulados y PostgreSQL desechable. No necesitan claves Google/SendGrid. Antes de producción comprobar con recursos propios: ADC/IAM, upload/read/delete privado, firma de URL, task con OIDC, rechazo de identidad ajena, ejecución de Scheduler y remitente verificado de SendGrid. Esa comprobación real está pendiente hasta que exista el proyecto.

### Barrido de membresías

Planes/membresías agregan `npm run memberships:drain` y el callback OIDC `/api/v1/internal/jobs/memberships/dispatch`. Para aprovisionar únicamente ese barrido usar `npm run gcp:scheduler:sync -- --memberships`, con `GCP_MEMBERSHIP_SCHEDULE_ID` y `GCP_MEMBERSHIP_SCHEDULE`. El comando original sin ese flag conserva el barrido de notificaciones. Recurrente no necesita una cuenta de servicio Google: utiliza su clave de Sandbox/LIVE y signing secret propios, detallados en plans-memberships.md. No se han creado jobs ni usado credenciales reales por esta implementación.

## Push y prevención (paso 7)

El motor admite push durable por dispositivo mediante FCM HTTP v1 con ADC. Variables PUSH_ENABLED=false y FIREBASE_PROJECT_ID; no se requieren credenciales nuevas si la identidad ADC ya tiene autorización para Firebase. El proyecto Firebase/API/IAM y clientes deben configurarse expresamente. prevention:drain genera avisos y notifications:drain entrega correo/push. Scheduler separado: gcp:scheduler:sync -- --prevention, con GCP_PREVENTION_SCHEDULE_ID y GCP_PREVENTION_SCHEDULE. Contratos, reintentos y configuración del frontend pendiente en prevention-reminders-dashboard.md.

Los correos de cuentas y del worker ahora se entregan con HTML y texto alternativo mediante el mismo transporte SMTP/Mailpit/SendGrid. Configuración visual y vistas previas: email-templates.md. No exige otra API, credencial, bucket ni migración.
