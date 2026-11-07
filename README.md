# API Blue Dent

Las decisiones de producto vigentes de Blue Care + se encuentran en [docs/business-rules.md](docs/business-rules.md), con su registro central en Notion. Leerlas antes de desarrollar pacientes, membresías, pagos, beneficios, núcleo familiar o roles; distinguen decisiones confirmadas de preguntas abiertas.

API NestJS 11 para Blue Dent (Node.js 22+), con DDD pragmático, PostgreSQL y Sequelize. Las reglas para futuras conversaciones están en .codex/architecture.md y el alcance actual en .codex/project-context.md; AGENTS.md enlaza ambos.

## Arranque local

1. npm ci
2. Copiar .env.example a .env. Ajustar DB_PASSWORD y generar JWT_SECRET aleatorio (32 caracteres mínimo). Ajustar CORS_ORIGINS al frontend.
3. Ejecutar desde la raíz de la API: docker compose --env-file .env -f docker/docker-compose.yaml up -d postgres mailpit (o reutilizar los servicios que ya tengas).
4. npm run db:migrate y luego npm run permissions
5. Ejecutar npm run createSuperUser y responder nombre, apellido, email, contraseña y confirmación. La cuenta se crea habilitada, verificada y con rol superadmin.
6. npm run start:dev

La API usa /api/v1. GET /api/v1/health comprueba que el proceso responde. No se altera el esquema automáticamente. db:migrate:undo revierte la última migración y puede destruir los datos que contiene: utilizar solo deliberadamente.

## Migraciones

- `npm run db:migrate`: ejecuta las migraciones pendientes y conserva los datos existentes.
- `npm run db:migrate:reset`: revierte todas las migraciones registradas, eliminando las tablas y sus datos, vuelve a aplicar todas desde cero y ejecuta los seeders. La secuencia se detiene si falla cualquiera de los pasos.

Ambos comandos usan la conexión configurada en el entorno o en .env. El reinicio afecta las tablas gestionadas por las migraciones de esta API; no elimina la base de datos completa. El reset termina ejecutando db:seed, que sincroniza roles/permisos y crea las cuentas de prueba. db:migrate por sí solo no ejecuta seeders.

## Seeders de prueba

`npm run db:seed` ejecuta los seeders sobre una base ya migrada. `npm run db:migrate:reset` los ejecuta automáticamente después de reconstruir las tablas. El seeder sincroniza primero los permisos y roles.

| Rol | Email |
| --- | --- |
| superadmin | superadmin@blue-dent.test |
| admin | admin@blue-dent.test |
| customer | customer@blue-dent.test |

Las tres cuentas están habilitadas y verificadas. Su contraseña de prueba es `Pa$$word123`, guardada como hash bcrypt con una sal diferente por usuario. Los roles se asignan mediante user_roles, sin columnas de permisos directos.

El seeder también crea **Clínica Blue Care de prueba** (`blue-care-test`, UUID `00000000-0000-4000-8000-000000000101`) y asigna las cuentas de prueba superadmin/admin mediante clinic_staff, staff_profiles y un rol admin local. superadmin conserva su rol global; nunca se asigna superadmin por sede. La cuenta customer no recibe asignaciones de personal. Los permisos de admin siguen siendo los del catálogo; este seeder no inventa una matriz clínica nueva.

El seeder utiliza identificadores reservados: repetirlo restaura esas tres cuentas, contraseñas y roles globales sin duplicarlas, y revoca sus sesiones anteriores. Crea la clínica y las asignaciones solo si faltan; conserva otras asignaciones por clínica y no sobrescribe los datos de una clínica existente con el mismo ID/código. Si el email/identificador de usuario o el código/identificador de clínica colisionan con otro registro, se detiene sin sobrescribirlo y revierte la creación de fixtures. La reversión elimina sus tres cuentas y retira la clínica únicamente si no tiene referencias de otros registros; conserva los roles y no elimina otros usuarios. No emite correos, push ni notificaciones operativas: son fixtures explícitos de desarrollo/pruebas.

Después de ejecutar `npm run db:seed`, iniciar sesión de nuevo. Las dos cuentas de personal verán la clínica real en el selector superior y en su perfil.

## Servicios locales con Docker

La configuración está en docker/docker-compose.yaml. Desde la raíz de la API, copiar .env.example a .env y ajustar DB_PASSWORD antes de iniciar los servicios:

```powershell
docker compose --env-file .env -f docker/docker-compose.yaml up -d postgres mailpit
```

Si ya tienes Mailpit, iniciar únicamente PostgreSQL:

```powershell
docker compose --env-file .env -f docker/docker-compose.yaml up -d postgres
```

La API ejecutada en tu equipo usa DB_HOST=localhost, DB_PORT=5432 y SMTP_HOST=localhost, SMTP_PORT=1025, sin SMTP_USER ni SMTP_PASSWORD para el Mailpit incluido. EMAIL_FROM tiene un remitente local de ejemplo. Si reutilizas un Mailpit existente, ajustar SMTP_HOST y SMTP_PORT a ese servicio.

La bandeja de Mailpit está en http://localhost:8025. DB_PORT, SMTP_PORT y MAILPIT_UI_PORT permiten cambiar los puertos publicados si están ocupados. PostgreSQL y Mailpit conservan sus datos en volúmenes separados. El nombre del proyecto y el volumen de PostgreSQL conservan los del compose anterior en la raíz.

Para detenerlos conservando los datos:

```powershell
docker compose --env-file .env -f docker/docker-compose.yaml down
```

Solo se preparó la configuración; no se ejecutaron servicios. Documentación de la imagen de correo: [Mailpit Docker](https://mailpit.axllent.org/docs/install/docker/).

## Endpoints

| Método | Ruta relativa | Acceso |
| --- | --- | --- |
| POST | auth/login | Público, email/password |
| POST | auth/refresh | Público, refreshToken |
| POST | auth/logout | Público, refreshToken; revoca inmediatamente |
| GET | auth/me | Bearer JWT |
| POST | auth/invitations | invitations:create + roles:assign; email/firstName/lastName/roles |
| GET | auth/invitations | invitations:list; listado con historial |
| GET | auth/invitations/by-token?token=... | Público; preview de invitación vigente |
| POST | auth/invitations/:id/resend | invitations:resend + roles:assign |
| POST | auth/invitations/:id/revoke | invitations:revoke |
| POST | auth/invitations/accept | Público; token/password |
| POST | auth/password/forgot | Público; email |
| POST | auth/password/reset | Público; token/password |
| POST | auth/activation/request | Público; email previamente registrado |
| POST | auth/activation/confirm | Público; token/password |
| POST | auth/password/change | auth:password-change; currentPassword/newPassword |
| POST | auth/email/change | auth:email-change; email/currentPassword |
| POST | auth/email/confirm | Público; token de verificación del nuevo email |
| GET | users | users:list + users:manage |
| GET | users/:id | users:read |
| POST | users | users:create + users:manage + roles:assign; email/firstName/lastName/password/roles |
| PATCH | users/:id | users:update; firstName/lastName/enabled/roles; asignación exige roles:assign |
| DELETE | users/:id | users:delete |
| GET | audit | audit:list; filtros y paginación |
| GET | audit/:id | audit:read |

Listado: limit (1–100, defecto 25), offset (defecto 0), respuesta items/total. No hay registro público. Los permisos administrativos permiten asignar permisos y deben reservarse a administradores.

Login devuelve token, refreshToken y user. El cliente debe coordinar una sola renovación y sustituir ambos tokens: la sesión anterior queda revocada. Logout y cambio de contraseña invalidan accesos activos. Invitaciones duran 24 horas y recuperación 30 minutos; son de un uso. Se almacenan hashes de los tokens. El cliente debe proteger refreshToken y no incluirlo en registros.

## Alcance M01

Los requisitos RF-001 a RF-004 están implementados para la identidad actual customer y el canal email: activación con contacto registrado, bloqueo de no verificados, sesiones revocables, permisos con propiedad de identidad y recuperación/cambio de contacto con verificación. No se crean membresías comerciales. Las fichas y recursos clínicos del futuro módulo de pacientes necesitarán enlazar su propietario y aplicar esta política por recurso. El detalle, los estados y la evidencia están en .codex/m01-authentication.md.

Las invitaciones guardan nombres, apellidos, roles, quién invitó, fechas, estado y resultado del correo. La aceptación establece contraseña y conserva el historial. El reenvío invalida el token anterior y exige esperar un minuto. Si falla SMTP se guarda deliveryStatus=failed y se puede reenviar desde el listado. La consulta pública no devuelve el hash ni datos del invitador.

Los usuarios creados por POST users empiezan sin verificar. Solicitar activación en el email registrado antes de iniciar sesión. Invitaciones aceptadas, provisión operativa por createSuperUser y fixtures explícitos quedan verificados. Ningún endpoint público crea cuentas desde un email libre.

Para actualizar una base existente al nuevo flujo: npm run permissions y npm run db:migrate. La migración 006 conserva las invitaciones antiguas y no requiere reset. El envío SMTP real debe comprobarse con el servidor de correo configurado; las pruebas usan transporte simulado.

## Arquitectura

src/modules/<contexto> contiene domain (entidades/puertos), application (casos de uso), infrastructure (adaptadores SQL), presentation (DTOs/controladores). src/shared contiene contratos pequeños. src/infrastructure contiene configuración e integraciones transversales. Usuarios demuestra herencia CRUD con métodos concretos y rutas explícitas.

## Permisos y roles

Cada módulo define su propio catálogo (shortcode, scope, descripción y grupo) en su archivo de dominio *.permissions.ts: identity.permissions.ts, auth.permissions.ts, authorization.permissions.ts y notification.permissions.ts. Los controladores importan los permisos de su módulo. src/permissions.ts solo define las políticas de superadmin, admin y customer; no reúne catálogos ni operaciones de módulos. La sincronización registra los catálogos en la infraestructura de authorization, y los límites públicos viven en auth.throttle.ts. Se sigue la filosofía de Kraken: permisos con códigos estables, roles protegidos que agrupan permisos y acceso efectivo como unión de los roles del usuario, sin organizaciones ni multitenencia.

Las tablas son permissions, roles, role_permissions y user_roles. Los permisos se resuelven en cada petición, por lo que cambiar un rol no exige volver a iniciar sesión. users.permissions no se persiste: la migración 005 retira la columna heredada. La propiedad permissions en la respuesta JSON es una lista calculada mediante user_roles → roles → role_permissions → permissions; sirve para conocer el acceso efectivo, no es una copia guardada en users. PostgreSQL muestra un array vacío como {}, lo que no indica un objeto JSON ni que falten los permisos del rol. En usuarios e invitaciones se envía roles, por ejemplo ["customer"]; el servidor devuelve roles y permissions calculados. Crear y cambiar asignaciones exige también roles:assign y comprobar que los roles no exceden los permisos del actor. users:manage habilita operar otras identidades junto al permiso específico, independientemente del nombre del rol. Solo superadmin puede otorgar superadmin o modificar/eliminar cuentas que ya tienen ese rol.

Roles predeterminados:

- superadmin: política "*", que la sincronización resuelve a todos los permisos de los módulos registrados.
- admin: perfil, credenciales y bandeja propios; gestión de roles personalizados, catálogo de permisos y roles:assign. Solo puede delegar sus propios permisos; la matriz clínica sigue pendiente.
- customer: perfil, credenciales y bandeja propios; los permisos de negocio de cliente se incorporarán cuando existan esos módulos.

No se agregaron permisos de catálogo comercial público. El catálogo privado de permisos se consulta en GET permissions. Cada nuevo caso de uso privado debe registrar su código en el archivo de permisos de su propio módulo y declarar @Permissions en su endpoint. Al agregar un módulo, registrar su catálogo en permission-registry.ts y ampliar el tipo Permission compartido; las políticas de roles seleccionan códigos de cada módulo. Un endpoint privado sin política se deniega. Un caso público debe declarar @Public y un límite @Throttle; no se le exige un permiso porque todavía no hay usuario autenticado.

Aplicar los cambios desde la raíz de la API:

```powershell
npm run db:migrate
npm run permissions
```

La gestión de roles personalizados y el catálogo privado están implementados. Consultar [docs/identity-authorization.md](docs/identity-authorization.md) para las rutas, permisos, protección de roles iniciales, delegación y requisitos del frontend. Los roles iniciales no limitan los nombres permitidos. El guard valida sesión y política de ruta; propiedad y asignación se comprueban en casos de uso y persistencia.

La sincronización es transaccional e idempotente: actualiza descripciones y códigos, elimina permisos retirados del catálogo y reemplaza los permisos de los tres roles predeterminados, conservando sus IDs y las asignaciones de usuarios. Los cambios manuales en esos roles serán sustituidos por lo definido en el archivo central. No crea usuarios ni cambia sus roles por defecto.

createSuperUser sincroniza permisos y roles antes de crear la cuenta, por lo que superadmin siempre existe antes de asignarlo. No exige una tabla users vacía: permite crear una nueva cuenta operativa incluso si ya hay usuarios, pero rechaza emails duplicados sin cambiar su contraseña ni elevar la cuenta existente. admin:create es un alias de compatibilidad para el mismo asistente.

```powershell
npm run db:migrate
npm run createSuperUser
```

Nombre y apellido se guardan por separado; name se deriva como nombre completo en las altas y ediciones HTTP. POST/PATCH users ya no aceptan name como entrada; el cliente debe enviar firstName/lastName. El script valida email y contraseña, solicita confirmación y oculta la escritura de ambas entradas de contraseña. Solo funciona en terminal interactiva; no recibe contraseñas por argumentos ni por variables ADMIN_*. No crea una cuenta de forma automática al arrancar el servidor.

La migración roles-permissions solo crea las tablas, claves e índices; no contiene INSERT, roles predeterminados ni permisos. La migración user-profile adapta el esquema de perfiles e invitaciones. npm run permissions es quien actualiza los datos de roles y permisos y convierte una sola vez los permisos históricos en roles de compatibilidad, sin ascender usuarios. La migración 005 remove-legacy-permissions elimina las columnas antiguas users.permissions y account_actions.permissions. En una instalación existente, ejecutar primero npm run permissions y después npm run db:migrate: si quedan grants históricos sin convertir, la migración se detiene para no perderlos. No se reconstruyen tablas ni usuarios. No se deben revertir migraciones que ya contienen datos para forzar este cambio.

Los roles legacy son de compatibilidad, no se pueden seleccionar en nuevos DTOs; se pueden sustituir por los roles definitivos cuando se definan sus permisos.

Límites por IP y ruta en ventanas de un minuto: login 10, refresh/logout 30, aceptar invitación 10, recuperar contraseña 5 y restablecerla 10. El límite global se mantiene en 60. También se limitan las solicitudes inválidas. El almacenamiento del limitador es por proceso; varias instancias requieren almacenamiento compartido. No se confía en X-Forwarded-For sin una configuración expresa del proxy.

## Google Cloud y correo

Configurar GOOGLE_CLOUD_PROJECT y GCS_PRIVATE_BUCKET. Usar ADC localmente con gcloud auth application-default login y una identidad de servicio adjunta en Cloud Run. Dar acceso de objetos únicamente al bucket necesario; para URLs firmadas ADC debe poder firmar mediante identidad de servicio (signBlob) o credenciales compatibles. Bucket privado con prevención de acceso público. FileStorage es un puerto interno; los futuros casos de uso clínicos deben autorizar cada objeto antes de generar una URL. URLs de lectura duran 5 minutos. No se han creado endpoints públicos de archivos.

GCP_CONFIG_SECRET acepta projects/PROJECT/secrets/SECRET/versions/VERSION con un objeto JSON de valores string. Se carga antes de Nest; las variables del proceso tienen prioridad. Dar acceso solo a ese secreto. Las migraciones y el bootstrap usan variables del entorno o .env; en despliegue inyectarles los mismos secretos por separado.

SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM y FRONTEND_URL configuran invitaciones y recuperación. El frontend debe implementar /accept-invitation, /reset-password, /activate-account y /confirm-email leyendo token del query string (?token=...). Para invitaciones, primero consultar GET auth/invitations/by-token?token=... y después POST auth/invitations/accept con token/password. Sin SMTP configurado no se enviarán esos correos. Las pruebas reemplazan el transporte y no envían mensajes.

Dockerfile construye el servidor sin permisos de root. Ejecutar migraciones como paso separado antes de desplegar. Cloud Run proporciona PORT; usar Cloud SQL mediante proxy/socket o conectividad privada configurada en DB_HOST. No hay despliegue automático ni recursos aprovisionados.

## Verificación

- npm run build
- npm run lint:check
- npm test -- --runInBand
- npm run test:integration (requiere Docker; crea PostgreSQL efímero con contraseña aleatoria, aplica migraciones y elimina el contenedor al terminar)

La integración comprueba CRUD, permisos, credenciales, rotación concurrente, revocación, expiración, invitaciones de un uso y recuperación. GCS y SMTP reales requieren comprobación con las credenciales y recursos propios del proyecto.

Referencias oficiales: [NestJS 11 JWT](https://docs.nestjs.com/v11/techniques/authentication), [Sequelize en NestJS](https://docs.nestjs.com/data/sequelize), [Google Cloud ADC](https://docs.cloud.google.com/storage/docs/authentication), [URLs firmadas](https://docs.cloud.google.com/storage/docs/access-control/signing-urls-with-helpers).

Estado de dependencias al preparar esta base: npm audit informa 8 avisos bajos y 4 moderados transitivos. Se corrigieron los avisos altos de Multer mediante override compatible. No usar audit fix --force sin revisar cambios de versión de Nest/Sequelize.


## Formato y pruebas por módulo

Se aplican las normas de backend-synctasks adaptadas a ESLint 9: comillas dobles, punto y coma, dos espacios, sin comas finales, JSDoc, detección de importaciones sin uso y restricciones de consola. Prettier y ESLint comparten 120 columnas para evitar formatos contradictorios. Los detalles y adaptaciones están en .codex/testing.md.

Las pruebas están en src/test/modules/<modulo>, con un archivo .usecase.spec.ts y otro .controller.spec.ts por clase concreta. Los helpers están en src/test/helpers y las pruebas reales de PostgreSQL en src/test/integration. src/test/jest-e2e.json configura esa integración.

- npm run format aplica el formato.
- npm run format:check comprueba el formato sin cambiar archivos.
- npm run lint corrige lo reparable; npm run lint:check comprueba sin editar.
- npm run test:typecheck verifica los tipos del código y las pruebas.
- npm run test:cov -- --runInBand ejecuta las pruebas con cobertura de todos los casos de uso y controladores.

Estado: 140 pruebas aisladas y 16 de integración. Cobertura de casos de uso y controladores: 100% líneas, sentencias y funciones; 83.09% ramas. Los umbrales impiden añadir nuevas clases sin cobertura.

## Servicios cloud y notificaciones

Consultar [docs/cloud-services.md](docs/cloud-services.md) para ADC local sin clave JSON, identidad de servicio de Cloud Run, permisos IAM, buckets, Cloud Tasks, Cloud Scheduler y SendGrid. `.env.example` documenta las variables. Mailpit existente: SMTP localhost:1025, bandeja http://localhost:8025; Google jobs desactivados por defecto.

La migración 202611030001 añade bandeja y outbox durables. Después de migrar y sincronizar permisos, `npm run notifications:drain` procesa una tanda local. `gcp:queue:ensure` y `gcp:scheduler:sync` son provisión explícita para cuando exista el proyecto Google; no se ejecutan al arrancar. No requieren Redis/BullMQ. Los callbacks internos verifican OIDC, sin confiar en headers de jobs ni permitir bypass de desarrollo.

Los correos de autenticación conservan el envío inmediato y utilizan el transporte compartido, seleccionable entre Mailpit/SMTP y SendGrid. Las notificaciones generales soportan email y bandeja propia; push y preferencias no están implementados. No se han aprovisionado ni probado recursos reales de Google o SendGrid.

## TypeScript en scripts y base de datos

Todo el código mantenido en `scripts/` y `database/` utiliza `.ts`, con tipos comprobados por `npm run test:typecheck` y las mismas reglas de lint/formato del proyecto. Los comandos npm ejecutan los scripts mediante `ts-node`; no necesitan una compilación previa de la API. La compilación de Nest se limita a `src/`, conservando `dist/main.js` como entrada de producción.

Usar los comandos `npm run db:migrate`, `npm run db:migrate:undo`, `npm run db:migrate:reset` y `npm run db:seed`. El wrapper `scripts/database.ts` conserva sequelize-cli, configura explícitamente las rutas y carga TypeScript. `.sequelizerc` se retiró. La configuración CLI requiere un puente JavaScript temporal generado automáticamente, sin credenciales embebidas, que se elimina al terminar; no se mantiene código JavaScript duplicado en el proyecto.

Antes de invocar Sequelize, el wrapper adapta transaccionalmente los nombres históricos `.cjs` de `SequelizeMeta` (y `SequelizeData` si existe) a los archivos `.ts` presentes. Así no se vuelven a ejecutar migraciones ya aplicadas. Si encuentra ambos nombres para una misma migración, se detiene sin normalización parcial. No hace reset ni cambia registros de negocio para esta adaptación. Para nuevas migraciones usar `.ts` y conservar siempre sus nombres después de ejecutarlas.

Estos comandos son herramientas operativas del repositorio y requieren dependencias de desarrollo instaladas (`npm ci`, incluido `ts-node`). La imagen productiva conserva solo la API compilada; ejecutar migraciones como un paso separado de despliegue con las herramientas disponibles. `db:migrate:reset` mantiene su comportamiento destructivo explícito y sus seeders de prueba; no se utiliza para actualizar instalaciones existentes.

## Auditoría y eventos de ciclo de vida

Consultar [docs/audit-events.md](docs/audit-events.md). La migración 202611030002 agrega auditoría de solo lectura, con protección PostgreSQL contra alteraciones. Los repositorios guardan cambios sensibles, actor, fecha, recurso, motivo opcional y snapshots permitidos en la misma transacción que sus avisos en bandeja/outbox. No capturan contraseñas ni tokens. Las mutaciones administrativas admiten reason opcional; X-Request-ID se genera en servidor. Los errores de auditoría/outbox revierten el cambio original.

Se conectaron usuarios, roles, invitaciones, activación y cambios confirmados de contraseña/email. Los mensajes transaccionales se entregan con el barrido existente o notifications:drain; no se envían correos dentro de la transacción. Los enlaces de autenticación conservan envío inmediato. Membresías/Recurrente/beneficios/prevención se conectarán cuando existan sus módulos. Actualizar con db:migrate y permissions, sin reset.

## Pacientes y clínicas

Implementados RF-005–RF-008: datos administrativos del paciente, catálogo de sedes, personal por clínica, asociaciones, perfiles propios y vínculo cuenta–paciente por contacto verificado. La autorización combina permiso de operación y clínicas asignadas, con `clinics:all` para alcance global. No se crean membresías ni pacientes automáticamente a partir de roles.

Aplicar `npm run db:migrate` y `npm run permissions`. No usar reset para actualizar una base con datos. Contratos, ejemplos, políticas y permisos en [docs/patients-clinics.md](docs/patients-clinics.md). Las invitaciones aceptan `patientId` opcional; la aceptación verifica y vincula dentro de la misma transacción. `GET/PATCH patients/me` usa exclusivamente el vínculo de la cuenta autenticada.

## Planes versionados y membresías

Implementados planes con revisiones inmutables, publicación explícita y precios GTQ. Las membresías son globales por paciente, conservan el precio contratado y registran cada período pagado sin sobrescribir historia. Los textos publicados del plan se actualizan también para miembros existentes. La cancelación conserva cobertura pagada y detiene renovaciones; la suspensión bloquea inmediatamente y pausa cobros sin extender vencimiento.

Migración `202611040002-plans-memberships.ts`; aplicar `npm run db:migrate` y `npm run permissions`. Se agregan `plans:catalog` y `memberships:self` a las políticas iniciales para acceso propio. La pasarela Recurrente está deshabilitada por defecto; no hay activación manual ni pagos simulados en producción. Checkout hospedado y webhook Svix se documentan junto con variables, rutas, límites y configuración de Sandbox en [docs/plans-memberships.md](docs/plans-memberships.md).

Worker local: `npm run memberships:drain`. Google Scheduler: `npm run gcp:scheduler:sync -- --memberships`, únicamente después de configurar nube/IAM. No se siembran precios comerciales ni se crean recursos externos al arrancar. Los saldos, beneficiarios y consumos del paso 6 ya están implementados: ver docs/benefits.md.

### Beneficios y saldo global

Implementado el paso 6: configuración versionada, cupos individuales globales entre clínicas, familia, canjes concurrentes, anulaciones y comprobantes temporales para QR. Contratos, permisos, reglas y límites en [docs/benefits.md](docs/benefits.md); decisiones confirmadas en DN-15 de business-rules.md. Actualizar con `npm run db:migrate` y `npm run permissions`, sin reset. No requiere variables nuevas.

### Prevención, recordatorios y dashboard

Backend del paso 7: eventos preventivos y línea temporal, intervalos por paciente, avisos configurables de siete días y un día por bandeja/correo/push, métricas y listas por clínica. [Contratos y operación](docs/prevention-reminders-dashboard.md). Aplicar `npm run db:migrate` y `npm run permissions`; generar avisos con `npm run prevention:drain` y entregar correo/push con `npm run notifications:drain`. FCM se mantiene deshabilitado (`PUSH_ENABLED=false`) hasta configurar proyecto Firebase/ADC y dispositivos. El frontend sigue pendiente.

### Diseño de correos

Cuentas y notificaciones usan un diseño HTML compartido, con texto alternativo y contenido específico por acción. [Arquitectura, configuración y vistas previas](docs/email-templates.md). Generar ejemplos sin enviar con `npm run emails:preview`. EMAIL_APP_NAME, EMAIL_PRIMARY_COLOR, EMAIL_LOGO_URL y EMAIL_SUPPORT_EMAIL son opcionales; el color se escribe entre comillas en .env. No requiere migración.

### Roles por clínica y selección en sesión

La autorización actual usa roles por clínica y clinicId firmado en JWT/sesión; null significa Todas las asignadas. [Contratos y cambios para frontend](docs/clinic-context.md). Login acepta clinicId; auth/switch-clinic rota ambos tokens; login/refresh/me incluyen clínicas y permisos actuales. PUT staff exige roles y las invitaciones clinicAssignments explícito. Asignaciones generan avisos durables. Migraciones existentes modificadas por autorización para reconstruir datos ficticios; no aplicar un simple migrate esperando convertir esquemas anteriores.

## Colaboradores y pacientes

Los flujos específicos y su frontend de páginas completas están documentados en [Gestión de colaboradores y pacientes](docs/people-management.md). Invitar colaboradores exige clínica/rol local permitido y fija una identidad básica staff; invitar pacientes fija customer y registra su ficha en la clínica actual, sin otorgar acceso de personal. Si está en Todas debe seleccionar una clínica. La nueva interfaz ya no usa el formulario genérico de roles/checkbox ni mezcla pacientes en el directorio del personal. El historial admite kind para separar resultados antes de paginar. El catálogo incorpora staff protegido sin cambiar las tres cuentas del seeder.


Arquitectura de casos de uso: [CRUD, políticas y operaciones separadas](docs/application-architecture.md). Incluye las bases abstractas, los nuevos imports internos y el contrato de errores en español.
