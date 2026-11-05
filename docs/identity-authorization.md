# Identidad, nombres y autorización

Estado: implementado en el backend. El alcance por clínica y la matriz de permisos clínicos siguen pendientes de definición. No hay multitenencia ni asignación automática de personal a sedes.

## Nombres canónicos

`POST /api/v1/users` recibe `email`, `firstName`, `lastName`, `password` y `roles`. `PATCH /api/v1/users/:id` permite `firstName`, `lastName`, `enabled` y `roles`. El campo `name` se conserva en las respuestas por compatibilidad y se calcula al crear o editar el perfil; ya no se acepta como campo de entrada.

Nombre y apellido se recortan en los extremos, deben tener entre 1 y 60 caracteres cada uno y sumar como máximo 120 contando el espacio intermedio. Se utilizan las mismas restricciones combinadas en invitaciones. Los nombres no se truncan. El cambio de un solo componente conserva el otro y recalcula `name`.

No se divide automáticamente un nombre histórico para inventar un apellido. Las identidades antiguas incompletas conservan sus datos hasta que un operador proporcione las partes faltantes; si una edición parcial no produce un nombre válido, la API responde 400. No se ha ejecutado una corrección masiva de datos del usuario.

Actualizar el perfil no sobrescribe email, passwordHash, verified ni asignaciones de roles omitidas. Esos datos tienen sus propios casos de uso; esto evita restaurar credenciales antiguas si el perfil se leyó antes de un cambio de contraseña concurrente.

## Responsabilidades de autorización

`AuthGuard` verifica el JWT, la sesión revocable, el estado habilitado/verificado y los permisos declarados por la ruta. Una ruta privada sin política continúa denegada. No interpreta el cuerpo HTTP ni reconoce nombres de recursos para decidir propiedad o asignación de roles.

Los casos de uso de usuarios exigen un actor explícito con el permiso de la operación. `AccessPolicy` decide propiedad, delegación y protección de superadmin. La persistencia vuelve a comprobar las restricciones críticas al escribir usando transacciones y bloqueos. Las llamadas internas a `UsersUseCase` sin actor también se deniegan; la provisión operativa sigue usando el script específico.

- `users:read`, `users:update` y `users:delete` permiten actuar sobre la identidad propia, según la operación concedida.
- Para otras identidades se necesita además `users:manage`. Listar o crear usuarios también exige `users:manage` y el permiso específico.
- Un rol personalizado puede recibir ese alcance global sin llamarse literalmente `admin`. El permiso global no equivale a acceso clínico por sede.
- Modificar o eliminar una cuenta con rol `superadmin` requiere ser superadmin. Tener `users:manage` no permite eludir esa regla.
- Cambiar roles exige `roles:assign`, existencia de todos los roles y permisos suficientes para delegarlos. Solo superadmin puede otorgar superadmin.

Los permisos de pacientes, clínicas y membresías se definirán en sus módulos. Estas políticas de identidad no sustituyen su futura autorización por recurso o clínica.

## Roles configurables

`DEFAULT_ROLE_NAMES` identifica únicamente los roles iniciales `superadmin`, `admin` y `customer`. Los DTOs aceptan nombres de roles personalizados con formato `^[a-z][a-z0-9-]{1,59}$`; el servidor exige que existan en PostgreSQL. Un nombre aceptado por validación no crea un rol automáticamente.

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET | `/api/v1/roles` | `roles:list` |
| GET | `/api/v1/roles/:id` | `roles:read` |
| POST | `/api/v1/roles` | `roles:create` |
| PUT | `/api/v1/roles/:id` | `roles:update` |
| DELETE | `/api/v1/roles/:id` | `roles:delete` |
| GET | `/api/v1/permissions` | `permissions:list` |

Crear y actualizar un rol recibe `name`, `description` y `permissions`. La descripción admite hasta 255 caracteres, y la lista hasta 200 códigos distintos del catálogo real. El nombre es un identificador estable: al editar se envía el mismo nombre; pueden cambiar descripción y permisos. Listados de roles usan `limit`, `offset`, `items` y `total`.

El catálogo de permisos es privado y de solo lectura. Cada módulo sigue siendo dueño de sus códigos; HTTP no permite inventar permisos ni otorgar `*` a un rol personalizado.

Un administrador solo puede crear o asignar roles con permisos que él ya tenga. Para editar/eliminar un rol también debe tener los permisos que ese rol posee actualmente; no puede usar la edición para retirar privilegios fuera de su autoridad. Superadmin administra todo el catálogo.

Los roles iniciales y los roles históricos protegidos no se editan ni eliminan por HTTP. Se administran mediante la configuración y la sincronización existentes. Los nombres `superadmin`, `admin`, `customer` y el prefijo `legacy-` no se pueden utilizar al crear roles personalizados. Roles legacy no se pueden asignar a cuentas o invitaciones nuevas.

Un rol personalizado solo puede eliminarse si no tiene usuarios asignados ni invitaciones pendientes vigentes. Se devuelve 409 en caso contrario. Los bloqueos de sus filas coordinan asignaciones y cambios de definición para impedir borrados concurrentes que pierdan accesos.

## Roles iniciales y despliegue

- `superadmin`: todos los permisos registrados.
- `admin`: perfil/credenciales propios, bandeja propia, gestión de roles personalizados, consulta del catálogo de permisos y `roles:assign`. No recibe automáticamente permisos de usuarios, pacientes o clínicas aún no definidos. Un superadmin debe conceder las operaciones adicionales mediante un rol personalizado.
- `customer`: perfil/credenciales y bandeja propios.

`npm run permissions` registra el catálogo ampliado y sincroniza los roles iniciales. Conserva roles personalizados, sus IDs, permisos vigentes y asignaciones. Los permisos retirados del catálogo dejan de ser válidos para todos los roles. No hay nueva tabla ni migración necesaria específicamente para roles dinámicos: se utilizan las tablas relacionales existentes. Aplicar las migraciones pendientes del proyecto normalmente, sin reset de datos.

Los permisos efectivos se resuelven en cada petición: cambiar un rol afecta a sesiones ya abiertas. Ni `users.permissions` ni copias de los grants en el JWT son fuente de autorización.

## Invitaciones y activación

Las invitaciones aceptan roles personalizados existentes. Crear y reenviar valida la autoridad del actor; la escritura vuelve a validar con bloqueo de las definiciones. Al aceptar se verifica nuevamente la elegibilidad y capacidad de delegación del invitador original, porque un rol mutable pudo ganar permisos desde el envío. Si el invitador fue eliminado, deshabilitado, perdió verificación o ya no puede otorgar el rol, se rechaza la aceptación sin crear la identidad. El operador puede revocar la invitación y emitir otra desde una identidad autorizada.

Las invitaciones antiguas migradas sin invitador conservan su flujo histórico de aceptación, sin inventar una identidad emisora. La existencia de los roles sigue comprobándose durante la asignación transaccional.

Una identidad no verificada con un rol personalizado puede solicitar y confirmar activación por el contacto registrado, igual que una con rol inicial. Activar no exige membresía, no crea una membresía y no convierte la cuenta en administradora.

## Auditoría y pendientes separados

No están implementados por estos cambios: matriz de personal por clínica, módulos de pacientes/membresías, pantallas del frontend. El documento de negocio conserva las decisiones y preguntas correspondientes. La protección y delegación de permisos aquí descritas constituyen controles de seguridad generales, no una matriz clínica inventada.

Los cambios de usuarios y roles ya generan auditoría y notificaciones transaccionales según [audit-events.md](audit-events.md). El motivo administrativo opcional se recibe como reason; no selecciona al actor. El historial global requiere audit:list/audit:read y no se concede automáticamente a admin/customer.
