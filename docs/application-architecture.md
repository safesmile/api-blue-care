# Casos de uso, CRUD y autorización

Decisión del dueño, 06/11/2026. Esta estructura sustituye las clases de aplicación que agrupaban CRUD, operaciones comerciales y comprobaciones repetidas de permisos.

## Estructura vigente

- `crudPlans.usecase.ts`, `crudMemberships.usecase.ts`, `crudPatients.usecase.ts`, etc. contienen exclusivamente las operaciones CRUD disponibles y sus métodos internos de persistencia/validación. No se inventan bajas o actualizaciones que el negocio no permite.
- Publicar un plan, cancelar una membresía, consumir un beneficio, invitar a un paciente, renovar una sesión o procesar una cola son casos de uso independientes, cada uno con su archivo y clase. La entrada pública de esos casos es `execute`; la implementación de negocio está en `perform`.
- `CrudEntityUseCase` y `EntityUseCase` son clases abstractas con implementación compartida. Las políticas se declaran por operación y se aplican antes de ejecutar el negocio. Se conserva el contrato síncrono/asíncrono de cada operación anterior.
- `CrudEntityController` comparte la delegación tipada del CRUD. Los controladores concretos siguen declarando explícitamente rutas, DTO, permisos, estados HTTP y parámetros. La herencia no publica endpoints automáticamente.
- Las reglas auxiliares utilizadas por varios casos se inyectan como servicios internos `*Rules.service.ts`. No son fachadas de casos de uso ni exponen operaciones HTTP. Evitan copiar emisión de credenciales, entrega de invitaciones, validaciones de familiares, pacientes o frecuencias de cobro.

Ejemplos: `CrudMembershipsUseCase` agrupa crear/leer/listar contratos; `CancelMembershipUseCase`, `SuspendMembershipUseCase`, `CheckoutMembershipUseCase` y `DrainMembershipUseCase` resuelven sus propias operaciones. La cancelación no se convierte en un borrado CRUD. Los controladores inyectan directamente las clases necesarias; los módulos y las herramientas de procesamiento usan los mismos proveedores.

## Responsabilidades de seguridad

Los códigos se obtienen de `PermissionCode`, un objeto constante tipado en `src/shared/domain/permission-code.ts`. Su valor almacenado y transmitido sigue siendo el código existente, por ejemplo `memberships:cancel`. Los catálogos de módulos conservan descripciones/grupos, y `src/permissions.ts` conserva las políticas de roles. No cambian permisos, roles, asignaciones ni tokens por esta refactorización.

Hay tres controles con responsabilidades distintas:

1. El guard autentica la sesión vigente y exige la política explícita de la ruta.
2. La base de aplicación comprueba la política declarada una sola vez por invocación, incluyendo la variante personal y la propiedad de identidad. No se escriben `require(actor, "permiso")` al inicio de cada método de negocio. También se protegen las llamadas internas al CRUD.
3. La persistencia comprueba el recurso real, la clínica concreta, la propiedad y la delegación vigente. Las escrituras sensibles revalidan bajo transacción/bloqueos. Estas comprobaciones no se sustituyen por la unión de permisos del JWT.

El contexto `actor` sigue siendo una entrada interna de seguridad cuando se necesita para propiedad, clínica o auditoría. Lo aporta el servidor, nunca el cuerpo de la solicitud. No se introduce un usuario global mutable ni se pierde contexto en trabajos asíncronos. Cuando el negocio no lo necesita, `perform` y los métodos internos del CRUD no reciben ese parámetro; la base lo usa al aplicar la política.

## Errores y compatibilidad

Los mensajes funcionales de las excepciones se devuelven en español. `ApiValidationPipe` conserva whitelist, rechazo de campos adicionales, transformación y validación anidada; sus mensajes no incluyen los valores rechazados. `ApiExceptionFilter` traduce errores generales del framework y oculta detalles internos. Se mantienen los estados HTTP y el contrato `statusCode`, `message`, `error`; `message` puede ser texto o lista de errores de validación.

Las rutas HTTP y las reglas comerciales permanecen iguales. Los imports internos de las antiguas clases agrupadas cambian: utilizar la clase CRUD o el caso específico. Las herramientas de procesamiento de membresías, prevención y notificaciones ya están adaptadas. No se modifican migraciones, datos, credenciales ni configuración de proveedores en esta tarea.

## Verificación

Las pruebas de regresión existentes componen las nuevas clases mediante adaptadores ubicados exclusivamente bajo `src/test/helpers/usecases`; no se registran en la aplicación. Se conservan las comprobaciones de resultados, efectos, propiedad, delegación, clínica, sesiones y atomicidad. Hay pruebas adicionales de las bases, denegación antes del efecto de negocio, operaciones no disponibles, validación anidada y errores HTTP en español. Las bases y el manejo de errores forman parte de la cobertura, sin reducir umbrales ni excluir casos de uso.

La integración utiliza PostgreSQL desechable y sustituye los servicios de correo/pagos/push. No requiere cambios de datos locales ni envía mensajes reales.


Verificación de esta refactorización (06/11/2026): 295 pruebas unitarias en 61 suites y 116 pruebas de integración en 11 suites aprobadas. Cobertura: 100% líneas, sentencias y funciones; 80% ramas, manteniendo los umbrales y ampliando la cobertura a las bases, AccessPolicy y errores/validación HTTP. Compilación, tipos, lint sin advertencias y formato correctos. PostgreSQL de integración desechable; sin cambios de datos locales ni mensajes reales.
