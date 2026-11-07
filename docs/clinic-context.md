# Roles por clínica y contexto firmado

Decisiones del dueño del 05/11/2026, DN-17, DN-18 y DN-19 de business-rules.md. Sustituye la autorización anterior de roles globales más una lista de sedes y el bypass clínico de clinics:all. No crea nuevas migraciones: se modifican las existentes según la autorización expresa de recrear la base ficticia.

## Paciente y personal: modos de sesión

La cuenta es una identidad única. El backend determina automáticamente el contexto de acceso al iniciar sesión: personal si tiene perfil laboral o permisos administrativos; paciente en caso contrario. El cliente no elige el tipo de usuario. La respuesta incluye mode como contexto interno informativo, sin availableModes. Login rechaza el parámetro mode.

- patient: JWT con sub, sid y mode; no contiene clinicId. El guard valida que la sesión persistida coincida y entrega permisos personales explícitos. No consulta el catálogo ni las asignaciones de clínicas. La información propia se autoriza por vínculo/propiedad, sin membresía ni asignación de personal.
- staff: JWT con sub, sid, mode y clinicId (UUID o null). Carga clínicas activas asignadas y permisos por sede. Con cero clínicas sigue siendo personal y puede abrir su perfil; los datos clínicos permanecen bloqueados.

staff_profiles conserva la condición de colaborador independientemente de clinic_staff. La primera asignación y las invitaciones staff:true crean ese perfil dentro de la transacción; quitar la última sede no lo elimina. Los permisos globales administrativos también habilitan el modo personal de trabajo, sin inferirlo del nombre de un rol. Los permisos personales de los roles globales o el vínculo con paciente habilitan la presentación personal; esa presentación nunca agrega grants administrativos.

La ruta POST /api/v1/auth/switch-mode fue retirada (404). No hay selector ni método del cliente para alternar paciente/personal. La firma y la sesión siguen comprobando el contexto interno; renovar credenciales conserva ese contexto. Cambiar de clínica es la única selección contextual expuesta al personal. Si una identidad también tiene datos propios de paciente, la propiedad y los permisos de los endpoints personales siguen aplicándose, sin transformar roles ni la cuenta. Nuevos módulos personales deberán registrar explícitamente su política de propiedad y permisos.

## Modelo de autorización

user_roles contiene id, userId, roleId y clinicId nullable. La unicidad de usuario/rol/ámbito incluye NULLS NOT DISTINCT: un rol global se guarda una sola vez y el mismo rol puede asignarse por separado en varias sedes. clinic_staff sigue representando la asignación de acceso a la clínica. Conceder o retirar acceso mantiene ambas estructuras en la misma transacción.

- clinicId no nulo: rol válido en esa clínica. Ana puede tener recepción en A y un rol administrativo distinto en B.
- clinicId null: rol de plataforma/cuenta, como customer para perfil y acciones propias. La asignación por clínica no crea privilegios globales de gestión de usuarios/configuración. superadmin solo puede ser global.
- Los nombres de roles no conceden acciones implícitas: cada rol mantiene sus permisos configurados. Asignar admin no inventa un conjunto nuevo de derechos clínicos ni cambia automáticamente la matriz de cargos pendiente.
- Los permisos clínicos globales, cuando existan en un rol de plataforma, siguen necesitando una asignación explícita a la sede. Incluso superadmin no obtiene registros clínicos de sedes sin asignación.

En cada petición se resuelven roles y permisos actuales desde SQL. El JWT no congela grants. Un rol de B no permite escribir un recurso de A cuando se consulta Todas. La función SQL blue_care_clinic_allowed verifica usuario asignado, selección firmada y permiso de la operación en la sede concreta; los filtros se aplican antes de contar/paginar.

El paciente y la membresía son registros globales: una persona compartida por A/B puede ser visible si alguna asociación accesible autoriza esa operación. Un evento preventivo o consumo tiene su clínica propia y exige autorización allí, aunque el paciente comparta otra sede. Los saldos siguen siendo globales entre clínicas como decidió el dueño: seleccionar una clínica no reinicia ni duplica cupos. El historial de consumos del personal filtra las sedes autorizadas; el titular conserva su historia propia global.

Una cuenta puede tener cero clínicas. Inicia sesión y usa perfil, seguridad, bandeja y recursos propios; no obtiene datos de sedes no asignadas. Algunas operaciones clínicas devuelven 403 al no existir permiso efectivo y otras 404 al estar el recurso fuera del alcance. Una clínica inactiva no aparece como seleccionable para el trabajo ordinario.

## Login, JWT y req.user

POST /api/v1/auth/login:

```json
{"email":"ana@example.com","password":"...","clinicId":"UUID-DE-CLINICA-A"}
```

En modo staff, clinicId null significa Todas las clínicas asignadas. Omitirlo en login usa null; sin sedes disponibles el selector muestra No hay clínicas seleccionadas. No enviar la cadena all o todas. Seleccionar una sede no asignada/inactiva se rechaza con 403 después de validar credenciales.

El JWT HS256 de staff contiene sub, sid, mode y clinicId, además de sus claims habituales. sessions guarda el mismo modo y clínica; patient guarda clinicId null en SQL y lo omite del token. El guard comprueba firma, sesión vigente y coincidencia de la selección; después obtiene el contexto actual y lo pone en req.user.clinicId. El permiso de ruta se usa también para limitar el alcance de la operación en SQL.

Login, cambio de contexto y auth/me proporcionan un usuario con:

- mode: contexto interno determinado por el backend; no es una elección ni un tipo editable por el cliente.
- clinicId: selección actual en staff, UUID o null; ausente en patient.
- permissions y roles: proyección efectiva del contexto seleccionado; permisos clínicos sin ninguna sede no se habilitan por el mero nombre del rol.
- globalPermissions/globalRoles: asignaciones de plataforma, para administración explícita. No usarlas para habilitar botones clínicos ignorando el contexto.
- clinics: clínicas activas asignadas con id, name, roles locales y permissions por sede. La lista sirve al selector, incluso si el usuario no puede consultar el catálogo administrativo. Puede estar vacía.

Los permisos de cuenta siempre se comprueban como antes. El portal del paciente sigue usando propiedad de su vínculo, sin exigir una membresía o asignación de personal.

## Cambiar de sede y refrescar

POST /api/v1/auth/switch-clinic, con Bearer actual en modo staff:

```json
{"refreshToken":"REFRESH-ACTUAL","clinicId":"UUID-DE-CLINICA-B"}
```

Para Todas usar clinicId:null explícito. El refresh debe pertenecer al usuario y a la misma sesión autenticada; no se acepta el de otra cuenta o sesión. La operación consume el refresh bajo bloqueo y crea sesión/JWT nuevos, conservando el vencimiento absoluto original. Solo un cambio concurrente puede ganar. El JWT y refresh anteriores dejan de servir.

Respuesta: token, refreshToken, clinicId y user actualizado. Sustituir ambos tokens de forma coordinada antes de lanzar consultas; vaciar los datos/cache del contexto anterior. POST /auth/refresh conserva la selección original y también devuelve el contexto actual. Si esa clínica dejó de estar disponible, refresh recupera la sesión en Todas las asignadas, que puede estar vacía. Una selección explícita de sede ajena o inactiva sigue rechazándose. El frontend descarta las respuestas del contexto previo y no repite una escritura contra otro contexto.

Retirar una asignación se refleja en la próxima petición de sesiones ya abiertas. El perfil/bandeja pueden seguir funcionando para mostrar el aviso y permitir cambiar contexto; no se revoca toda la cuenta por quitar una sede. No se confía en encabezados o parámetros para reemplazar clinicId del token.

## Consultas en una clínica y Todas

Sin filtro adicional, las consultas clínicas usan la selección del JWT. Los clinicId de query/body/ruta que ya existían solo pueden restringirla: un token seleccionado en A no permite consultar B enviando ?clinicId=B. En Todas se evalúan las clínicas asignadas donde se tenga el permiso concreto, no la unión irrestricta de los permisos de todas las sedes.

Ejemplo: si recepción en A solo lee y administración en B puede editar pacientes, Ana puede listar A/B desde Todas, pero no editar un paciente exclusivo de A. Un paciente compartido A/B podrá editarse desde Todas si B autoriza la operación; seleccionando A no podrá hacerlo usando el permiso de B. Las fechas/estados de dashboard, prevención y membresías conservan sus reglas de negocio.

La auditoría de recursos clínicos también filtra por sede/paciente autorizados; los eventos de plataforma (usuarios, roles y configuración) siguen necesitando el permiso global de auditoría. Un rol local con permiso de auditoría no abre eventos de plataforma. El historial no se elimina cuando pierde visibilidad.

## Administración de personal

| Endpoint, bajo /api/v1 | Contrato |
| --- | --- |
| GET /clinics | Catálogo de sedes asignadas según contexto/permisos |
| GET /clinics/available | Metadatos para administrar asignaciones, clinics:staff-manage |
| GET /clinics/:id/staff | Miembros y roles de la sede, clinics:staff-list |
| PUT /clinics/:id/staff/:userId | `{roles:["recepcion"]}`, clinics:staff-manage y delegación roles:assign |
| DELETE /clinics/:id/staff/:userId | Retirar acceso y todos los roles de esa sede, 204 |

PUT sustituye roles solo en esa clínica y concede acceso inmediatamente, con 204. No afecta roles globales ni otras sedes. Lista vacía no es una retirada implícita: usar DELETE. Repetir el mismo conjunto o retirar una asignación inexistente no duplica eventos/avisos. GET staff devuelve userId, clinicId, createdAt, name, email y roles locales.

Un administrador de una sede puede gestionar esa sede si tiene los permisos y no puede delegar grants que no posea allí. Un gestor global con clinics:staff-manage y clinics:all puede consultar las sedes disponibles y administrar asignaciones sin tener acceso clínico a sus pacientes. Esta es una capacidad de administración de accesos, no un bypass para datos de negocio. clinics:all queda limitado a esa administración explícita; no amplía las consultas clínicas. El rol admin global incorpora la gestión de personal e invitaciones dentro de su límite de delegación; el rol superadmin permite la configuración inicial. Las demás capacidades se otorgan con roles configurables.

El catálogo available admite búsqueda y enabled (activo por defecto) con paginación. GET staff es información administrativa que el gestor global puede consultar al administrar accesos. Usuarios/directorio y configuración de roles conservan sus permisos globales existentes. Las definiciones de roles son reutilizables; los permisos de lectura de catálogo pueden delegarse para asignar roles sin permitir modificar globalmente sus definiciones.

Crear una clínica no asigna silenciosamente al creador. Para operar sus registros, el administrador debe asignar explícitamente su propia cuenta si corresponde. Los usuarios iniciales tras reset empiezan sin clínicas.

Concesión, cambio de roles, retirada, auditoría y aviso se persisten en una transacción. Se crea una notificación en bandeja inmediatamente y se preparan correo/push para el worker; no se exige esperar SMTP/FCM para conceder acceso. Si falla persistir el aviso, el acceso no queda parcialmente concedido. Un fallo posterior del proveedor usa los reintentos del motor. No hay envíos externos dentro de la transacción.

## Invitaciones de colaboradores

POST /auth/invitations requiere clinicAssignments explícito, incluso si es []. staff:true permite invitar colaboradores sin sedes; las asignaciones no vacías también establecen su perfil laboral. El roles existente corresponde a la cuenta global; para colaboradores ordinarios usar customer como base y asignar los roles de trabajo dentro de clinicAssignments:

```json
{
  "email":"ana@example.com",
  "firstName":"Ana",
  "lastName":"Pérez",
  "roles":["customer"],
  "clinicAssignments":[
    {"clinicId":"UUID-A","roles":["recepcion"]},
    {"clinicId":"UUID-B","roles":["administracion-clinica"]}
  ]
}
```

Se permiten cero clínicas. No se repite un clinicId ni se asigna superadmin dentro de una sede. Los grants y la autoridad sobre cada clínica se validan al crear, reenviar y aceptar. Un invitador que perdió acceso no deja una invitación capaz de restaurarlo. Aceptar crea la cuenta, roles por sede, acceso, notificaciones y auditoría atómicamente; si algo falla no se crea una identidad parcial.

Una invitación pendiente reserva también sus roles locales contra borrado. El listado de invitaciones de un operador local no muestra invitaciones de sedes ajenas; las invitaciones multi-sede requieren alcance sobre todas para mostrarse a ese operador. Un gestor global conserva administración de invitaciones de la plataforma. Las invitaciones a cuentas existentes siguen rechazándose como antes: se usa la asignación directa para una cuenta ya creada. No se sustituyen vínculos paciente-cuenta por coincidencia de nombre.

## Migraciones y datos ficticios

Se modifican solamente:

- 202610280001-identity: clinicId/mode de sessions y restricción de contexto válido.
- 202610280003-roles-permissions: user_roles con ID, clinicId y unicidad por ámbito.
- 202611040001-patients-clinics: referencias, clinicAssignments/staff de invitaciones, staff_profiles y función de alcance.

No se creó una migración nueva. La reversión de la migración de clínicas tolera el esquema anterior sin las nuevas referencias para permitir el reset solicitado. Cambiar estos archivos no actualiza una base ya migrada mediante un simple migrate: debe reconstruirse el esquema ficticio con el flujo reset del proyecto. Las sesiones/JWT previos no son compatibles con el nuevo contexto firmado y deben descartarse.

No habilitar este procedimiento sobre datos reales: la autorización del dueño se refiere a la base ficticia actual. Para instalaciones con datos reales haría falta una migración incremental y una estrategia de conversión explícita.

## Verificación

Pruebas con PostgreSQL efímero cubren recepción A/admin B, Todas sin fuga de permisos, parámetros que intentan cambiar sede, cero asignaciones, coincidencia JWT/sesión, refresh y cambios concurrentes, deadline absoluto, revocación inmediata, catálogo administrativo separado, invitación con roles locales, autoridad revocada, reserva de roles, rollback de avisos y auditoría clínica fuera de alcance. Los transportes se sustituyen en pruebas; no se envían correos o push reales.

Validación final (05/11/2026): 273 pruebas unitarias en 58 suites y 104 de integración en 10 suites aprobadas; compilación, tipos, lint sin advertencias y formato correctos. Cobertura de casos de uso/controladores: 100% de líneas, sentencias y funciones.

Se ejecutó correctamente el reset autorizado en la base local ficticia blue_dent (localhost:5432): se revirtieron y reaplicaron las 12 migraciones existentes y se ejecutaron los seeds. Verificación posterior: 3 usuarios, 3 roles, 3 asignaciones globales, 0 clínicas y 0 sesiones. Es necesario iniciar sesión nuevamente y asignar explícitamente las clínicas al personal. No se enviaron mensajes externos ni se aprovisionaron servicios en la nube.

## Actualización DN-18 y frontend (05/11/2026)

Frontend adaptado en ../frontend: login con contexto automático, selector superior con clínicas reales del perfil, intercambio atómico de ambos tokens, bloqueo temporal de consultas durante el cambio y descarte de respuestas del contexto anterior. Perfil muestra modo, clínicas/roles y aviso cuando no hay asignaciones. Menú, búsqueda y acceso directo a las pantallas administrativas respetan el modo y permisos; paciente y personal sin permisos aterrizan en /mi-cuenta. Actualizar accesos y recuperar foco consultan auth/me. No persiste roles/clínicas/perfil en sessionStorage: solo credenciales. Las pantallas de negocio pendientes conservan su naturaleza ilustrativa, sin presentarlas como integraciones nuevas.

La separación se comprobó con 276 pruebas unitarias y 107 de integración; incluye paciente sin consultas de staff-clínicas, modo firmado contra sesión, denegación de escalada, doble perfil, invitación sin clínicas y propiedad personal independiente. Cobertura de aplicación/controladores: 100% líneas/sentencias/funciones, 82.79% ramas.

Para adaptar la base local ya reconstruida se aplicó una actualización transaccional del esquema faltante, sin otra migración ni reset: sessions.mode/restricción, invitations.staff y staff_profiles con conservación de asignaciones existentes. Se verificó el destino localhost:5432/blue_dent; conserva sus tres usuarios y cero clínicas. Las sesiones antiguas deben renovarse o iniciar sesión con el contrato nuevo. No se borraron datos ni se enviaron mensajes externos durante esta actualización.

## DN-19 — Sin selección del tipo de usuario (06/11/2026)

Por corrección expresa del dueño se retira el selector paciente/personal, la ruta switch-mode, el parámetro mode de login y availableModes de la respuesta. El discriminador mode firmado/persistido permanece como protección interna. No se modifica el catálogo de roles ni se transforma una cuenta al cambiar de clínica. Este apartado prevalece sobre la propuesta de alternancia de DN-18 y su descripción histórica.

El selector de clínicas del frontend usa Select de Base UI ya presente en el panel: disparador con icono y etiqueta, menú con opción marcada, soporte de teclado, foco, tema oscuro y estado deshabilitado sin clínicas. Mantiene las credenciales rotadas y las restricciones por asignación. Conserva la ruta actual si sigue autorizada; de lo contrario dirige a una ruta permitida. QA contra la API local con ratón/teclado y captura en navegador. Sin nuevas dependencias, migraciones o cambios de datos.

Actualización DN-20 (06/11/2026): la interfaz gestiona colaboradores y pacientes por separado con formularios de página. Los endpoints específicos fijan la identidad básica staff/customer y no aceptan roles globales del cliente. Paciente usa la clínica actual para su ficha, sin asignación de personal; Todas exige seleccionar una sede. Ver people-management.md para rutas, permisos, historial por kind y creación/aceptación atómicas. La explicación histórica del flujo genérico permanece solo como compatibilidad.
