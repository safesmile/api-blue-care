# Prevención, recordatorios y dashboard — Backend

Paso 7, 04/11/2026. Cubre RF-018, RF-019 y RF-022 y las operaciones backend de RF-020/RF-023. Fuente: [ERS de Entrega 1](https://app.notion.com/p/3f8c0e4d04e7816ca2c7d7011905a0df); las decisiones posteriores del dueño prevalecen (business-rules.md, DN-16). No se implementan pantallas, agenda clínica completa, integración con otro expediente, reservas de citas ni consumo automático de beneficios.

## Decisiones confirmadas

El personal selecciona el intervalo por paciente. No se asigna una frecuencia médica general ni se siembra una política de seis meses. El aviso se entrega mediante el motor de notificaciones en bandeja, correo y push; plazos iniciales siete días y un día antes, editables por administración. El paciente no necesita membresía para consultar su prevención o recibir recordatorios.

## Eventos y calendario

Tipos administrables con código estable, nombre y habilitado; no hay tipos comerciales sembrados. Un evento pertenece a paciente, clínica y tipo, con fecha objetivo `dueAt`, estado, intervalo individual `intervalMonths`, plazos `reminderHours`, referencia externa opcional y versión. Nombre del tipo se captura al crear para conservar evidencia. Desactivar el tipo suspende sus recordatorios y nuevas altas; no borra historia ni reescribe nombres anteriores.

Estados abiertos: `planned` (sugerencia preventiva) y `scheduled` (programado por personal). Estados cerrados: `completed` y `cancelled`. Crear y reprogramar exigen fecha futura. Todas las fechas HTTP incluyen hora y zona u offset; se almacenan como instantes. `externalReference` es un identificador opaco, no una URL que la API visita ni una comprobación de cita externa.

`intervalMonths` es obligatorio y puede ser null (evento único), o entero 1–120 seleccionado por personal. `reminderHours` es una lista de hasta diez enteros únicos, 1–8760 horas antes; por defecto [168,24], y [] deshabilita avisos de ese evento. Al reprogramar se envía la programación completa; omitir reminderHours usa el valor predeterminado, por lo que el frontend debe reenviar los plazos elegidos para conservarlos.

Completar exige fecha real `occurredAt`, nunca futura, y `expectedVersion`. Calcula una única siguiente fecha desde esa realización y el intervalo del paciente, con calendario de Guatemala, hora conservada y ajuste al último día de meses cortos. La siguiente entrada es `planned`, conserva intervalo/plazos y referencia a su origen (`followUpOfId`), sin reutilizar la referencia de una cita externa. Si la realización histórica produce una próxima fecha ya pasada, se muestra vencida; no se desplaza artificialmente al futuro. Completar no descuenta un beneficio ni prueba que existió una cita en otro sistema.

Editar/cancelar/completar solo eventos abiertos y con versión vigente. Una escritura concurrente gana y la otra recibe 409 para recargar. Dos confirmaciones no generan dos siguientes eventos. El alta exige UUID `idempotencyKey`; repetir los datos originales devuelve el mismo evento mientras sigan coincidiendo, y reutilizar la clave con datos distintos o estado modificado da 409. Los estados cerrados y la identidad del evento quedan protegidos por triggers; no existe borrado físico. Auditoría conserva actor, fecha y campos explícitos, incluida la referencia externa; exige los permisos globales de auditoría existentes.

## Recordatorios durables

La migración guarda plazos por versión de evento en preventive_reminders. Al crear/reprogramar se programan solo los plazos aún no transcurridos: no se manda un aviso de siete días si el evento fue creado dos días antes. Un barrido retrasado recupera los avisos pendientes mientras el evento siga siendo futuro; al pasar la fecha se marcan expirados. Una reprogramación crea una nueva versión y una nueva programación; no reenvía los avisos de la anterior.

El worker bloquea paciente/evento, vuelve a comprobar estado, clínica/tipo habilitados y cuenta vinculada verificada/habilitada. Genera aviso, outbox de correo y entregas por dispositivo push en una transacción junto a auditoría y marca de generación. Las claves por recordatorio evitan duplicar la generación al ejecutar varios workers. No usa SMTP ni FCM dentro de esa transacción. Trabaja con lotes de hasta 50 eventos y presupuesto de 30 segundos; próximos barridos recuperan lo pendiente. Registros temporalmente no elegibles no bloquean la selección de otros pacientes.

Al editar, completar o cancelar se retiran avisos de versiones anteriores de la bandeja y se cancelan sus entregas pendientes de ambos canales. Ya entregados no pueden retirarse del correo o dispositivo. Una entrega que ya estaba en tránsito puede llegar: la entrega externa es al menos una vez, no exactamente una vez. Los mensajes son generales, sin nombre, procedimiento, fecha clínica, referencia externa ni otros datos sensibles en la pantalla de bloqueo; la app autenticada obtiene los detalles.

Correo reutiliza EmailSender y la configuración actual SMTP/Mailpit o SendGrid. Push reutiliza el mismo aviso y añade outbox por dispositivo; no se crean cuentas de usuario para familiares. Este módulo preventivo inicial corresponde al paciente titular, no crea automáticamente eventos para sus beneficiarios.

## Push con Firebase Cloud Messaging

Puerto PushSender, adaptador FcmPushSender con HTTP v1 y google-auth-library existente. Se usa OAuth/ADC y el endpoint fijo de Google, sin claves de servidor legacy ni credenciales en el frontend. Referencias oficiales: [envío HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api) y [entorno de servidor](https://firebase.google.com/docs/cloud-messaging/server-environment).

Variables nuevas en .env.example:

```dotenv
PUSH_ENABLED=false
FIREBASE_PROJECT_ID=
GCP_PREVENTION_SCHEDULE_ID=blue-care-prevention-sweep
GCP_PREVENTION_SCHEDULE=* * * * *
```

PUSH_ENABLED es independiente de GCP_JOBS_ENABLED: el worker local puede enviar push mediante ADC sin Cloud Tasks. Si push está deshabilitado, las entregas se conservan pendientes y correo/bandeja funcionan. Habilitarlo exige un FIREBASE_PROJECT_ID válido. Debe vincularse/configurarse Firebase en el proyecto deseado, habilitar la API FCM y otorgar a la identidad del backend los permisos de envío correspondientes. En nube, usar cuenta de servicio adjunta; en desarrollo, ADC con una identidad autorizada o GOOGLE_APPLICATION_CREDENTIALS apuntando a una clave de cuenta de servicio mantenida fuera del repositorio. No se requiere un archivo llamado service-account.json: no hay una ruta fija ni se versiona la clave.

El frontend futuro pide permiso de notificaciones, obtiene el token FCM de su plataforma (web, Android o iOS), lo registra autenticado y lo renueva cuando cambie. Web necesita su configuración Firebase, service worker y VAPID; iOS necesita configuración APNs en Firebase. Nada de esto está simulado como si ya existiera en el frontend. El backend solo acepta un token opaco y su plataforma, sin userId arbitrario.

Registro por usuario/dispositivo con token de escritura únicamente: no se devuelve, no entra en auditoría ni en errores del proveedor. Un token activo registrado a otra cuenta no puede apropiarse desde la API. Al cerrar sesión en el dispositivo, el frontend debe revocar el registro antes de perder la sesión; cambiar de usuario en un dispositivo compartido requiere gestionar esa desvinculación. Actualmente una revocación deshabilita el registro, no transfiere propiedad entre cuentas; no se promete que logout revoque automáticamente todos los dispositivos del usuario.

El outbox usa lease de dos minutos, reintentos exponenciales, NOTIFICATION_MAX_ATTEMPTS y resultado terminal. Una respuesta UNREGISTERED deshabilita el dispositivo y cancela lo pendiente para él. Otros fallos se registran con código genérico y se reintentan. Un lease vencido puede recuperarse; un worker anterior no puede sobrescribir al nuevo. El mensaje lleva notificationId estable para que el cliente deduplique y agrupe notificaciones; no se garantiza recepción física por el sistema operativo.

## Contratos HTTP para el frontend

Prefijo /api/v1. Paginación `limit` (25, máximo 100) y `offset` (0). Las rutas privadas declaran permisos explícitos.

| Ruta | Permiso / entrada |
| --- | --- |
| GET /prevention/types | prevention:read |
| POST /prevention/types | prevention:configure; code, name, enabled |
| PUT /prevention/types/:id | prevention:configure; mismo código, name, enabled |
| POST /prevention/events | prevention:create; ejemplo siguiente |
| GET /prevention/events | prevention:read; patientId, clinicId, typeId, status, from, to |
| GET /prevention/events/:id | prevention:read |
| PATCH /prevention/events/:id | prevention:update; expectedVersion y programación completa |
| POST /prevention/events/:id/complete | prevention:complete; expectedVersion, occurredAt |
| POST /prevention/events/:id/cancel | prevention:cancel; expectedVersion, reason opcional |
| GET /prevention/me/events | prevention:self; filtros de línea temporal, siempre propiedad propia |
| GET /prevention/me/events/:id | prevention:self; detalle propio |
| GET /dashboard | dashboard:read; days, clinicId |
| GET /dashboard/memberships/expiring | dashboard:read; days, clinicId, limit, offset |
| GET /dashboard/prevention/upcoming | dashboard:read; days, clinicId, limit, offset |
| POST /notifications/devices | notifications:devices; token, platform |
| GET /notifications/devices | notifications:devices; listado propio sin tokens |
| DELETE /notifications/devices/:id | notifications:devices; 204, solo propio |
| POST /internal/jobs/prevention/dispatch | OIDC Google, no JWT de usuario |

Ejemplo de alta (UUID reales y fecha futura a seleccionar por el frontend):

```json
{
  "patientId": "uuid-del-paciente",
  "clinicId": "uuid-de-clinica",
  "typeId": "uuid-del-tipo",
  "dueAt": "2027-03-15T10:00:00-06:00",
  "status": "scheduled",
  "intervalMonths": 3,
  "reminderHours": [168, 24],
  "externalReference": "cita-en-sistema-externo",
  "idempotencyKey": "uuid-de-la-operacion"
}
```

Reprogramar envía dueAt, status, intervalMonths, reminderHours, externalReference y expectedVersion. Completar devuelve `{event,next}`; next puede ser null. Listados devuelven `{items,total}`; eventos incluyen id, patientId, clinicId, typeId/typeName, dueAt, status, intervalMonths, reminderHours, version, externalReference, completedAt/cancelledAt, followUpOfId y fechas de registro. El backend determina estados finales y fechas de operación, no acepta actor ni saldo desde el cliente. from es inclusivo y to exclusivo, ambos con zona; timeline ordenada por fecha objetivo e ID ascendente.

El personal necesita alcance vigente al paciente y a la clínica concreta del evento. Una asignación en otra sede del mismo paciente no basta para modificar el evento. clinics:all amplía alcance, sin sustituir los permisos de operación. El dueño consulta su historia incluso sin membresía; no puede autoaprobar realizaciones ni cambiar registros del personal. admin/customer reciben prevention:self y notifications:devices; los cargos administrativos se otorgan con roles personalizados y sus clínicas. superadmin recibe todo el catálogo. No se inventa una matriz de cargos.

## Dashboard

Horizonte days configurable en consulta (30 por defecto, 1–365). Respuestas incluyen asOf y until del reloj SQL. Cada respuesta se calcula en una transacción repeatable read; llamadas HTTP separadas pueden reflejar cambios posteriores, por lo que el frontend debe refrescar métricas y listas conjuntamente.

- activeMembers: pacientes activos con cobertura pagada actual, sin suspensión ni cierre; cancelar con período pagado no los retira hasta vencer. No requiere que siga disponible para nuevas contrataciones el plan que contrataron.
- expiringMemberships: esos contratos activos con paidThrough hasta until inclusive. La lista usa el mismo predicado y expone identificador, paciente, nombre, vencimiento y cancelación solicitada, sin detalles de cobro.
- upcomingPreventiveEvents: eventos planned/scheduled de pacientes y clínicas activos, dueAt en [asOf,until). Su lista usa el mismo alcance y devuelve identificación, paciente/nombre, clínica, tipo, fecha y estado.
- overduePreventiveEvents: eventos abiertos anteriores a asOf de pacientes/clínicas activos; no se marcan realizados automáticamente.

Las membresías se cuentan por paciente, sin multiplicar por asociaciones de clínicas; filtrar clinicId usa su asociación con el paciente. Los eventos usan la clínica propia del evento. Todas las cifras y listados se restringen por asignaciones; totals no filtran únicamente la página, sino todos los registros elegibles. Sin métricas de ingresos, asistencia o procedimientos que el backend no registra.

## Operación local y nube

Aplicar `npm run db:migrate` (202611040004-prevention-push) y `npm run permissions` en el entorno elegido. Sin reset ni sincronización automática de modelos. No se ha tocado la base del usuario.

En desarrollo: `npm run prevention:drain` genera una tanda de recordatorios y `npm run notifications:drain` entrega correo y push pendientes. La bandeja queda persistida al generar, sin esperar SMTP/FCM. No se instala un temporizador en memoria ni se ejecutan estos comandos automáticamente al arrancar.

En nube: provisionar explícitamente `npm run gcp:scheduler:sync -- --prevention`, además del scheduler de notificaciones existente, una vez configurados proyecto, ADC/IAM y callback OIDC. El endpoint de notificaciones dispatch conserva sent de correo y añade pushSent. Los avisos preventivos se recuperan por el barrido durable; no necesitan una Cloud Task por cada evento ni exponen un endpoint público de ejecución manual.

Límites pendientes de configuración externa: proyecto Google/Firebase, credenciales y dispositivos reales; aplicación frontend y autorización de push. No se hicieron envíos reales, cargos ni provisión de recursos de nube. La integración clínica y la retención/purga de historia siguen fuera de esta implementación.

Verificación final del paso 7 (04/11/2026): 261 pruebas unitarias en 57 suites y 92 pruebas de integración en 9 suites aprobadas. Cobertura de casos de uso/controladores: 100% líneas/sentencias/funciones y 82.57% ramas. Compilación, tipos, lint sin advertencias y formato aprobados. PostgreSQL de pruebas desechable detenido al terminar; correo y FCM sustituidos, sin tocar la base del usuario ni servicios reales.

## Alcance actualizado por DN-17

La clínica del JWT/sesión y los roles de cada sede se aplican automáticamente al dashboard y prevención. El permiso de una sede no se utiliza sobre eventos de otra, incluso con paciente compartido y vista Todas. clinics:all ya no elimina asignaciones clínicas. Los filtros explícitos solo restringen la selección firmada. Ver clinic-context.md para los contratos de login/cambio y los efectos inmediatos de revocación.
