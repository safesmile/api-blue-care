# Auditoría y eventos de los módulos actuales

Estado: implementado en el backend para usuarios, roles, invitaciones y cambios confirmados de credenciales. Requiere Node.js 22 o superior, la migración `202611030002-audit-events.ts` y sincronizar permisos. El alcance de pacientes y clínicas se amplió posteriormente en [patients-clinics.md](patients-clinics.md); no crea membresías, pagos ni eventos preventivos.

## Instalación y consulta

```powershell
npm run db:migrate
npm run permissions
```

Se agrega `audit_events`. La migración conserva los datos existentes y no reconstruye tablas de usuarios. No ejecutar `db:migrate:reset` para actualizar una instalación con datos; el reset y la reversión de esta migración eliminan el historial que contienen.

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET | `/api/v1/audit` | `audit:list` |
| GET | `/api/v1/audit/:id` | `audit:read` |

Ambos permisos acceden a información sensible de la auditoría completa. Superadmin los recibe mediante su política de todo el catálogo. Admin y customer no los reciben automáticamente; un superadmin puede concederlos mediante un rol personalizado. Tener permisos sobre un usuario no implica poder consultar el historial global.

Listados aceptan `limit` (1–100, defecto 25), `offset`, `actorId`, `action`, `resourceType`, `resourceId`, `from` y `to`. Las fechas deben ser ISO 8601 con hora y zona explícita, por ejemplo `2026-11-03T00:00:00-06:00`. Los límites temporales son inclusivos. El resultado es `{ items, total }`, ordenado por fecha e ID descendentes. Los filtros desconocidos y rangos invertidos se rechazan; no se acepta SQL, orden ni campos arbitrarios del cliente.

## Datos registrados

Cada registro tiene ID, fecha del servidor, identificador de solicitud, actor, tipo de actor (usuario o sistema), nombre del actor como snapshot, acción, tipo/identificador del recurso, motivo opcional y valores anteriores/nuevos. Actor y recurso no tienen una FK que elimine el historial al borrar sus cuentas. El nombre del actor conserva la identificación disponible en el momento del cambio.

El interceptor genera `X-Request-ID` en servidor. Conserva por solicitud únicamente ese ID, el actor autenticado y un motivo administrativo opcional. No almacena headers de autorización, cookies, cuerpos completos, query strings ni enlaces de recuperación. Headers o campos del cliente no pueden seleccionar al actor. Las operaciones públicas autorizadas mediante un token de un solo uso se atribuyen a la identidad que ese token verifica, nunca a un `userId` libre del cuerpo.

Los DTOs administrativos permiten `reason` opcional, texto recortado de 1–500 caracteres: altas/ediciones/bajas de usuarios, creación/edición/baja de roles, creación/reenvío/revocación de invitaciones. Un motivo obligatorio por operación no está definido como regla de negocio. No escribir credenciales ni datos clínicos en motivos, nombres o descripciones.

Cada módulo define explícitamente los campos de snapshot permitidos. Hay sanitización adicional de claves relacionadas con password, token, secret, authorization, cookie y credential, incluso en objetos anidados. No se registran contraseñas, hashes de contraseñas, tokens, hashes de tokens ni claves SMTP/SendGrid. Un evento de cambio de contraseña expresa que ocurrió el cambio sin conservar la contraseña anterior/nueva. Los errores del escritor no exponen las sustituciones SQL del evento en los logs del framework.

Los snapshots contienen datos personales de identidad como nombre y email, además de estados, roles y permisos cuando corresponda. No son registros anónimos. Retención, anonimización, exportación externa y acceso operacional de base de datos requieren una política posterior; no se aplica limpieza automática ni se inventa un plazo.

## Eventos conectados

| Acción | Auditoría | Notificación durable |
| --- | --- | --- |
| `user.created` | Estado inicial de identidad y roles | Bandeja del usuario, disponible al poder iniciar sesión |
| `user.updated` | Perfil, habilitación y asignaciones efectivamente cambiadas | Bandeja del usuario |
| `user.deleted` | Último estado, antes de eliminarlo | Ninguna al usuario eliminado |
| `user.activated` | Activación por contacto o invitación aceptada | Bienvenida en bandeja |
| `user.password-changed` | Confirmación del cambio y revocación coordinada de sesiones | Bandeja y email de seguridad |
| `user.password-reset` | Recuperación completada por token válido | Bandeja y email de seguridad |
| `user.email-changed` | Contacto anterior/nuevo tras verificar el nuevo | Bandeja y email al contacto nuevo verificado |
| `role.created` / `role.deleted` | Definición creada/eliminada | Ninguna |
| `role.updated` | Descripción y permisos anteriores/nuevos | Bandeja de usuarios asignados si cambiaron los permisos del rol |
| `invitation.created` / `.resent` / `.revoked` / `.accepted` | Identidad invitada, roles, emisor, estados y fechas; sin credenciales | La aceptación crea además la bienvenida de la identidad |
| `permissions.synchronized` | Configuración anterior/nueva de roles iniciales | Ninguna; es una operación de configuración |

Las ediciones que no cambian el snapshot canónico no generan eventos `.updated` ni avisos duplicados. El orden de los códigos de permisos o nombres de roles no convierte por sí solo una edición en un cambio. Dos cambios reales distintos sí producen eventos distintos.

`createSuperUser` registra una provisión del sistema si la tabla de auditoría ya está instalada. La sincronización de permisos también registra su ejecución y las configuraciones iniciales cuando la tabla existe. Ambos comandos mantienen compatibilidad con las actualizaciones anteriores que requieren sincronizar permisos antes de instalar todas las migraciones. No se fabrica un historial retrospectivo. Los seeders de cuentas de prueba no se presentan como operaciones clínicas/productivas auditadas.

Los envíos de invitación/activación/recuperación que contienen enlaces de autorización conservan su envío inmediato y el manejo SMTP existente. Sus tokens no se trasladan a este outbox de mensajes generales. Los avisos posteriores de seguridad no contienen enlaces secretos. Los intentos de transporte de invitaciones conservan sus campos `deliveryStatus`/fechas propios; no se duplican como snapshots de credenciales en la auditoría general.

## Atomicidad, entrega y recuperación

Los adaptadores SQL escriben el cambio de negocio, `audit_events`, la bandeja y el outbox en una misma transacción. Un fallo al registrar la auditoría o sus notificaciones revierte también la mutación original. Un rollback no deja una notificación sobre un cambio inexistente. No hay SMTP ni llamadas a Google dentro de esa transacción.

Los eventos de ciclo de vida se recuperan mediante el barrido ya existente de Cloud Scheduler o con:

```powershell
npm run notifications:drain
```

El barrido trabaja con registros pendientes confirmados en PostgreSQL. No necesita que el proceso que atendió la solicitud permanezca vivo, y funciona con Mailpit sin credenciales Google usando el comando local. `NotificationsUseCase.notify` conserva su publicación inmediata opcional en Tasks para emisores que lo usen directamente; los avisos transaccionales de estos módulos no dependen de que una llamada después del commit consiga encolar.

Cada notificación transaccional usa una clave estable por evento y destinatario. Se conservan las leases, deduplicación de bandeja, backoff, reintentos y límites existentes. El email se dirige solo al contacto actual de una identidad habilitada/verificada. Un cambio posterior de email o estado puede cancelar el envío pendiente a un contacto que ya no sea válido. La bienvenida en bandeja no verifica por sí sola la cuenta.

SMTP sigue teniendo entrega al menos una vez: una caída después de que el proveedor acepte el mensaje y antes de marcarlo enviado puede producir una copia. `sent` no significa leído ni garantiza entrega final al buzón. Los eventos no se utilizan para prometer exactamente un envío externo.

Los cambios de rol notifican a sus usuarios asignados mediante escritura dentro de la transacción. Esta primera implementación utiliza fanout transaccional, no una cola separada de expansión masiva; deberá revisarse su tamaño si existen roles con grandes volúmenes de usuarios. Los conflictos de base de datos revierten de forma segura el cambio completo.

## Protección del historial

La API solo expone lectura. Triggers PostgreSQL rechazan UPDATE, DELETE y TRUNCATE sobre `audit_events`. No existe endpoint para modificar registros, borrar motivos o limpiar evidencia. Borrar usuarios/roles/invitaciones no borra sus eventos.

Esto es protección de integridad operativa, no una firma criptográfica ni garantía frente a un propietario/superusuario de base de datos que pueda alterar tablas o deshabilitar triggers. Las migraciones deliberadas siguen pudiendo retirar la tabla. El control de acceso a PostgreSQL, backups y archivo externo siguen siendo responsabilidades de despliegue.

## Extensión a los próximos módulos

Los eventos de membresías, cobros de Recurrente, consumos, correcciones y prevención se conectarán al implementar sus repositorios. Cada módulo debe definir su acción, snapshots permitidos y mensajes; su adaptador invocará `recordChange(db, transaction, input)` dentro de la misma transacción del cambio. No emitir mensajes antes del commit ni confiar en un evento solo en memoria.

Auditoría de intentos fallidos de autenticación, lecturas de datos, sesiones/login/logout individuales, integración de webhooks externos y políticas de retención no se incorporan por inferencia. La implementación actual registra los cambios sensibles completados enumerados arriba. La interfaz visual de auditoría queda para el frontend.

## Verificación

Las pruebas usan PostgreSQL temporal y transportes de correo simulados. Cubren permisos, filtros, correlación y actores concurrentes; eliminación de campos sensibles; eventos de recursos; bloqueo de alteraciones del historial; rollback del cambio cuando falla auditoría/outbox; deduplicación; permanencia tras bajas; y envío de avisos desde el worker después del commit. Google Cloud y SendGrid reales siguen pendientes de sus recursos y credenciales.

Ampliación del 04/11/2026: clínicas/pacientes registran sus mutaciones y asociaciones con la misma transacción; las bajas de identidades auditan asignaciones de clínicas eliminadas. Los snapshots de paciente incluyen DPI, fecha de nacimiento y dirección cuando existan, sujetos a los permisos sensibles de auditoría. Los avisos al paciente no incluyen esos datos. Ver patients-clinics.md.

Ampliación de planes/membresías (04/11/2026): ver plans-memberships.md. Cambios de publicación, precio contractual, períodos confirmados y órdenes de cancelación/pausa mantienen la transacción con sus eventos y avisos. Webhooks y workers se atribuyen al sistema, sin arrastrar identidad del navegador. No se guardan claves ni URLs de checkout en snapshots.

## Beneficios

Configuración/publicación, familia, consumo, presentación y anulación registran snapshots explícitos y metadatos dentro de la transacción de negocio. Los tokens y hashes de comprobantes nunca entran en auditoría. Consumos conservan regla/período/actor/clínica; una anulación es evidencia adicional con motivo obligatorio. Los avisos asociados son genéricos y durables en bandeja, sin datos clínicos ni correo. Ver benefits.md.

## Prevención y dispositivos push

Tipos, altas/reprogramaciones, realizaciones/cancelaciones y generación de recordatorios se auditan en la transacción de recurso, con snapshots permitidos. Dispositivos registran identificador/plataforma/estado, nunca token ni hash. Una falla de auditoría revierte también programación, bandeja y outboxes. Entregas SMTP/FCM ocurren después, con leases y códigos genéricos de fallo. Ver prevention-reminders-dashboard.md.
