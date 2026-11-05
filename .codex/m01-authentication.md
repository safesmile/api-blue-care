# M01 — Autenticación y autorización

## Alcance acordado

Actualización de producto del 03/11/2026: la cuenta puede crearse/activarse sin membresía. La elegibilidad de activación no debe interpretarse como tener una membresía pagada. El flujo confirmado parte de una invitación de recepción; no se ha aprobado registro público libre. El usuario completa su información y puede contratar Blue Care + mediante Recurrente desde su cuenta. Los roles superadmin/admin/customer son iniciales; el producto debe permitir roles creados por administración. Los roles dinámicos ya están implementados según docs/identity-authorization.md; las capacidades comerciales siguen pendientes. Consultar ../docs/business-rules.md para decisiones, contradicciones y pendientes.

El módulo patients mantiene ahora un registro independiente de la identidad: ver docs/patients-clinics.md. No se deduce el vínculo del nombre del rol customer ni se crea automáticamente por activación ordinaria. M01 no crea membresías comerciales. Los canales de contacto implementados son emails; no existe integración de SMS o teléfonos. Los scripts operativos y fixtures verificados son provisión explícita del operador, nunca registro público.

## Requisitos y evidencia

| Requisito | Implementación actual | Verificación |
| --- | --- | --- |
| RF-001 Activación | Un usuario previamente registrado, habilitado, con un rol existente inicial o personalizado y verified=false recibe un token en su email registrado. Solo consumir ese token permite establecer contraseña y verified=true. No se crea otro usuario, paciente o membresía durante activación. También se verifica una nueva identidad invitada al aceptar el token enviado a su contacto. | Identidad no verificada rechazada por login, refresh y AuthGuard; token inválido no activa; activación de customer y staff conserva el mismo ID y roles. |
| RF-002 Sesiones | JWT asociado a una sesión persistida, refresh rotatorio y revocación comprobada en cada petición. Logout y cambios de contraseña/contacto revocan acceso. | JWT y refresh revocados son rechazados; renovaciones concurrentes no reutilizan una sesión. |
| RF-003 Autorización | Permisos de roles calculados en servidor; operaciones privadas declaran sus permisos. El acceso a otras identidades requiere users:manage además del permiso específico, independientemente del nombre de rol. Un permiso users:read aislado solo permite la propia identidad. auth/me siempre usa la identidad autenticada. | Cuenta A no lee la identidad B, aun concediéndole users:read; campos userId/invitedBy/roles no pueden inyectarse en operaciones públicas. |
| RF-004 Recuperación/canal | Recuperación solo al email de una identidad verificada. Cambio de contraseña exige la contraseña actual. Cambio de email exige sesión verificada, contraseña actual y token enviado al email nuevo; hasta confirmar no cambia el contacto ni se vincula otra cuenta. | Token inválido/reutilizado no cambia email; el cambio conserva userId, exige email único y revoca sesiones; dos recuperaciones concurrentes consumen una única autorización efectiva. |

Integración vigente con pacientes: una invitación puede declarar patientId; crear, reenviar y aceptar revalida estado/contacto del paciente y alcance actual del invitador. Aceptar crea el vínculo solo tras verificar el token. Los endpoints patients/me usan la relación persistida paciente–identidad; las operaciones administrativas comprueban clínicas asignadas o clinics:all. Las invitaciones sin paciente y la activación ordinaria siguen funcionando sin crear un paciente. Los recursos clínicos futuros deberán comprobar propiedad y sus propios permisos, no inferirla del rol.

## Invitaciones

La tabla invitations conserva id, email, firstName, lastName, roles, tokenHash, invitedBy (FK), invitador como snapshot de nombre/email, createdAt, expiresAt, acceptedAt, acceptedUserId, status, deliveryStatus, lastSendAttemptAt y lastSentAt. Un invitador eliminado no borra el historial. Nunca devolver tokenHash ni el token generado en las respuestas HTTP.

Estados: pending, accepted, revoked y expired. La vista calcula expired al vencer expiresAt aunque el estado almacenado siga pendiente. La consulta pública solo devuelve datos mínimos de una invitación vigente; estados cerrados/vencidos devuelven 410 y tokens inexistentes devuelven 404. El listado administrativo sí conserva el historial completo.

- POST /api/v1/auth/invitations: email, firstName, lastName, roles. Requiere invitations:create y roles:assign; el invitador se toma de la sesión, nunca del cuerpo. Devuelve 201 con metadatos. No crea la identidad aún.
- GET /api/v1/auth/invitations: lista paginada, requiere invitations:list.
- GET /api/v1/auth/invitations/by-token?token=...: preview público limitado, con Cache-Control: no-store.
- POST /api/v1/auth/invitations/accept: token/password. Crea una identidad verificada y sus roles dentro de la misma transacción que marca accepted y acceptedAt. No borra la invitación ni crea membresías.
- POST /api/v1/auth/invitations/:id/resend: invitations:resend y roles:assign; intervalo mínimo 60 segundos. Rota el token y da otras 24 horas de vigencia. El token anterior deja de servir. No reenvía invitaciones aceptadas o revocadas.
- POST /api/v1/auth/invitations/:id/revoke: invitations:revoke. Conserva el historial.

Solo superadmin puede invitar o reenviar superadmin. El fallo de SMTP deja deliveryStatus=failed y una respuesta 503; el operador puede listar la invitación y reenviarla. No hay un outbox durable ni reintentos automáticos de correo.

El email es una invitación explícita: nombre/apellido, quién invita, vencimiento y enlace /accept-invitation?token=.... El frontend debe leer URLSearchParams(location.search), consultar by-token y después enviar token/password a accept. No hay frontend implementado en este repositorio. No registrar URLs con tokens en logs de infraestructura.

## Activación y recuperación

- POST auth/activation/request: email, 202 genérico para no revelar existencia ni elegibilidad.
- POST auth/activation/confirm: token/password, 204 al activar la identidad registrada.
- POST auth/password/forgot: email, 202 genérico. Fallos internos se registran sin emails/tokens y no revelan la existencia de la cuenta.
- POST auth/password/reset: token/password, 204. Revoca sesiones y otras acciones pendientes del contacto.
- POST auth/password/change: currentPassword/newPassword, requiere auth:password-change y usa exclusivamente el usuario autenticado.
- POST auth/email/change: email/currentPassword, requiere auth:email-change. Envía un token al email nuevo y no altera el contacto aún.
- POST auth/email/confirm: token, 204. Confirma únicamente el usuario/contacto vinculados por el servidor y revoca sus sesiones.

Contraseñas: mínimo 8 caracteres, máximo 72 bytes UTF-8, mayúscula/minúscula/número/símbolo y sin espacios. Tokens aleatorios de 40 bytes guardados con SHA-256; invitación 24 horas y verificaciones de cuenta 30 minutos. Las acciones se consumen con transacciones y bloqueos consistentes. Todos los endpoints públicos tienen throttle; preview 20/minuto, activación/confirmación de canal 5/minuto. Los límites anteriores de login, refresh, logout y recuperación continúan aplicándose.

## Despliegue y límites

Migración 006: tabla invitations, campos userId/targetEmail en account_actions y traslado de invitaciones antiguas pendientes sin cambiar el token ni su vencimiento. Si los datos antiguos no registraban apellido/invitador, quedan vacíos/null; no se inventan datos. No se borran usuarios. Actualizar la base existente con npm run permissions y npm run db:migrate. Instalación limpia: migrar primero y después sincronizar permisos. No usar reset para actualizar una base con datos.

admin/customer tienen auth:me, auth:password-change, auth:email-change y bandeja propia; admin también gestiona roles personalizados y consulta el catálogo dentro de sus permisos. Los demás permisos administrativos de negocio siguen pendientes de definición. superadmin obtiene todos los permisos registrados, incluidas las nuevas operaciones de invitaciones.

SMTP integrado mediante nodemailer y configuración del proyecto. Se verifican contenido y URLs con un transporte simulado, sin enviar mensajes reales. PostgreSQL de pruebas es temporal e independiente, sin Docker ni bases del usuario. El almacenamiento del throttle sigue siendo por proceso; varias instancias necesitan un almacén compartido.

Actualización técnica: los usuarios HTTP reciben firstName/lastName y name se deriva. Los roles dinámicos, la comprobación de propiedad/delegación en casos de uso y las validaciones transaccionales están detalladas en docs/identity-authorization.md. Las invitaciones con invitador conocido vuelven a comprobar al aceptar su identidad verificada/habilitada y sus grants actuales. AuthGuard ya no inspecciona body.roles ni decide propiedad de usuarios.

La confirmación de email de una identidad vinculada propaga su contacto verificado al paciente dentro de la misma transacción y conserva userId. No permite sustituir esa cuenta ni vincular otro paciente. La ficha propia solo permite editar teléfono, fecha de nacimiento y dirección; nombres, DPI, estado y vínculo quedan en administración.
