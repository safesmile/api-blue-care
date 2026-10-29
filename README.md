# API Blue Dent

API NestJS 11 para Blue Dent, con DDD pragmático, PostgreSQL y Sequelize. Las reglas para futuras conversaciones están en .codex/architecture.md y el alcance actual en .codex/project-context.md; AGENTS.md enlaza ambos.

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

El seeder utiliza identificadores reservados: repetirlo restaura esas tres cuentas, contraseñas y roles sin duplicarlas, y revoca sus sesiones anteriores. Si el email o el identificador pertenece a otra cuenta, se detiene sin sobrescribirla. La reversión del seeder elimina únicamente sus tres cuentas, conserva los roles y no modifica otros usuarios.

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
| GET | users | users:list |
| GET | users/:id | users:read |
| POST | users | users:create; email/name/password/roles |
| PATCH | users/:id | users:update; name/enabled/roles |
| DELETE | users/:id | users:delete |

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

Cada módulo define su propio catálogo (shortcode, scope, descripción y grupo) en su archivo de dominio *.permissions.ts: identity.permissions.ts y auth.permissions.ts. Los controladores importan los permisos de su módulo. src/permissions.ts solo define las políticas de superadmin, admin y customer; no reúne catálogos ni operaciones de módulos. La sincronización registra los catálogos en la infraestructura de authorization, y los límites públicos viven en auth.throttle.ts. Se sigue la filosofía de Kraken: permisos con códigos estables, roles protegidos que agrupan permisos y acceso efectivo como unión de los roles del usuario, sin organizaciones ni multitenencia.

Las tablas son permissions, roles, role_permissions y user_roles. Los permisos se resuelven en cada petición, por lo que cambiar un rol no exige volver a iniciar sesión. users.permissions no se persiste: la migración 005 retira la columna heredada. La propiedad permissions en la respuesta JSON es una lista calculada mediante user_roles → roles → role_permissions → permissions; sirve para conocer el acceso efectivo, no es una copia guardada en users. PostgreSQL muestra un array vacío como {}, lo que no indica un objeto JSON ni que falten los permisos del rol. En usuarios e invitaciones se envía roles, por ejemplo ["customer"]; el servidor devuelve roles y permissions calculados. Crear y cambiar asignaciones exige también roles:assign. Solo superadmin puede otorgar superadmin o modificar/eliminar cuentas que ya tienen ese rol.

Roles predeterminados:

- superadmin: política "*", que la sincronización resuelve a todos los permisos de los módulos registrados.
- admin: perfil y cambio propio de contraseña/email; los permisos administrativos se definirán en el archivo central.
- customer: perfil y cambio propio de contraseña/email; los permisos de negocio de cliente se incorporarán cuando existan esos módulos.

No se agregaron permisos de catálogo público ni endpoints de catálogo en línea. Cada nuevo caso de uso privado debe registrar su código en el archivo de permisos de su propio módulo y declarar @Permissions en su endpoint. Al agregar un módulo, registrar su catálogo en permission-registry.ts y ampliar el tipo Permission compartido; las políticas de roles seleccionan códigos de cada módulo. Un endpoint privado sin política se deniega. Un caso público debe declarar @Public y un límite @Throttle; no se le exige un permiso porque todavía no hay usuario autenticado.

Aplicar los cambios desde la raíz de la API:

```powershell
npm run db:migrate
npm run permissions
```

La sincronización es transaccional e idempotente: actualiza descripciones y códigos, elimina permisos retirados del catálogo y reemplaza los permisos de los tres roles predeterminados, conservando sus IDs y las asignaciones de usuarios. Los cambios manuales en esos roles serán sustituidos por lo definido en el archivo central. No crea usuarios ni cambia sus roles por defecto.

createSuperUser sincroniza permisos y roles antes de crear la cuenta, por lo que superadmin siempre existe antes de asignarlo. No exige una tabla users vacía: permite crear una nueva cuenta operativa incluso si ya hay usuarios, pero rechaza emails duplicados sin cambiar su contraseña ni elevar la cuenta existente. admin:create es un alias de compatibilidad para el mismo asistente.

```powershell
npm run db:migrate
npm run createSuperUser
```

Nombre y apellido se guardan por separado; name conserva el nombre completo. El script valida email y contraseña, solicita confirmación y oculta la escritura de ambas entradas de contraseña. Solo funciona en terminal interactiva; no recibe contraseñas por argumentos ni por variables ADMIN_*. No crea una cuenta de forma automática al arrancar el servidor.

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
