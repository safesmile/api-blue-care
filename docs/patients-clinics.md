# Pacientes y clínicas — primera versión

Implementación de RF-005–RF-008 y extensión de RF-003/RF-023. Fuentes: [ERS Entrega 1](https://app.notion.com/p/3f8c0e4d04e7816ca2c7d7011905a0df), `business-rules.md` y aclaraciones del dueño del 04/11/2026. No implementa expediente clínico, agenda, membresías ni pagos.

## Actualización de una instalación

```powershell
npm run db:migrate
npm run permissions
```

Migración: `202611040001-patients-clinics.ts`. Agrega `clinics`, `clinic_staff`, `patients`, `patient_clinics` y `invitations.patientId`. No modifica ni convierte automáticamente las cuentas existentes en pacientes. No usar reset para actualizar una base con datos. Revertir esta migración elimina estas tablas, sus asociaciones y el vínculo en invitaciones; la auditoría existente se conserva.

## Modelo y datos

Identidad, paciente y membresía son conceptos separados. Un paciente puede existir sin cuenta, y una cuenta puede existir sin paciente o sin membresía. Un paciente tiene un único registro global, asociado a una o varias clínicas; agregar otra asociación no lo duplica ni crea saldos por sede.

Los nombres y apellidos son obligatorios. El resto de los datos puede completarse después: teléfono, correo, DPI, fecha de nacimiento y dirección. El correo es obligatorio para invitar o vincular una cuenta, no para registrar inicialmente al paciente. Una cuenta vinculada debe estar verificada y habilitada.

El DPI es opcional, admite 13 dígitos y no se repite entre pacientes cuando se registra. Esta validación no consulta RENAP ni demuestra identidad gubernamental. La fecha de nacimiento es una fecha de calendario `YYYY-MM-DD`, real y no futura; no incluye hora. No se obliga a registrar DPI para menores u otras personas sin ese documento. No se almacenan alergias, diagnósticos, tratamientos ni documentos clínicos en este módulo.

El registro guarda UUID, estado `enabled`, fechas de alta/actualización y vínculo opcional `userId`. `clinic_staff` y `patient_clinics` tienen claves compuestas que impiden duplicar asociaciones. El vínculo paciente–cuenta es uno a uno, respaldado por índice único. El correo del paciente no es único: puede haber familiares u otras personas que compartan un contacto, pero eso no los vincula a una misma cuenta. El modelo de beneficiarios/dependientes se resolverá en su módulo.

Las clínicas tienen `code` único editable, nombre, dirección/teléfono/correo opcionales, estado y fechas. El código admite minúsculas, números y guiones, de 1–30 caracteres. La API desactiva registros mediante PATCH; no expone borrado físico de clínicas ni pacientes. Borrar una identidad vinculada a un paciente se rechaza con 409; puede deshabilitarse la cuenta conservando el vínculo y el historial.

## Permisos y alcance

Las operaciones se autorizan por permisos, sin comprobar nombres de roles administrativos. Además del permiso de operación:

- `clinics:all` permite operar globalmente; no concede por sí solo permisos de lectura o escritura.
- Sin ese permiso, el personal solo consulta/opera en sus clínicas asignadas. Para un paciente necesita al menos una asociación compartida con una clínica activa a la que esté asignado.
- Los listados filtran antes de paginar y contar. Un paciente fuera de alcance se presenta como 404. La consulta directa de una clínica no asignada devuelve 403.
- Crear una clínica, gestionar asignaciones de personal o agregar/quitar asociaciones paciente–clínica exige alcance global. Un operador local no puede ampliar su propio alcance asignándose otra sede o trasladando un paciente de otra sede.
- Desactivar una clínica detiene nuevas altas/asociaciones allí y deja de conceder acceso local a pacientes. El personal sigue pudiendo consultar la ficha administrativa de su clínica asignada; el acceso global permite consultar los registros preservados.
- Retirar una asignación tiene efecto sobre solicitudes posteriores incluso con una sesión ya abierta. Las escrituras vuelven a comprobar y bloquear las asociaciones dentro de su transacción.

Superadmin recibe el nuevo catálogo mediante `*`. Admin y customer reciben `patients:self`, que únicamente opera sobre su propio vínculo. Los permisos administrativos nuevos no se conceden automáticamente a admin: la matriz de funciones sigue pendiente, y se delegan mediante roles personalizados desde un operador que los posea. Para habilitar una recepción se concede, por ejemplo, `patients:create/read/list/update/link`, `clinics:read/list` y sus clínicas; invitaciones requieren además `invitations:create` y `roles:assign`, con la delegación vigente del rol que se asignará. Nunca conceder `clinics:all` para solucionar una asignación local faltante.

Quitar todas las asociaciones de un paciente no lo elimina; queda accesible únicamente para operadores globales y para su cuenta vinculada. Es una corrección administrativa de acceso, no la cancelación de una membresía. La asociación con una clínica no constituye autorización para un futuro expediente clínico completo: ese contexto necesitará sus permisos específicos.

## Contratos HTTP

Rutas relativas a `/api/v1`:

| Método | Ruta | Permiso y control adicional |
| --- | --- | --- |
| POST | `/clinics` | `clinics:create` + global |
| GET | `/clinics` | `clinics:list`, solo sedes visibles |
| GET | `/clinics/:id` | `clinics:read` + alcance |
| PATCH | `/clinics/:id` | `clinics:update` + alcance; admite `enabled` |
| GET | `/clinics/:id/staff` | `clinics:staff-list` + alcance |
| PUT / DELETE | `/clinics/:id/staff/:userId` | `clinics:staff-manage` + global, 204 |
| POST | `/patients` | `patients:create` + clínica activa accesible |
| GET | `/patients` | `patients:list`, solo pacientes visibles |
| GET | `/patients/:id` | `patients:read` + alcance |
| PATCH | `/patients/:id` | `patients:update` + alcance; admite `enabled` |
| POST | `/patients/:id/account` | `patients:link` + alcance + contacto verificado coincidente |
| GET | `/patients/:id/clinics` | `patients:read` + alcance; asociaciones visibles |
| PUT / DELETE | `/patients/:id/clinics/:clinicId` | `patients:update` + global, 204 |
| GET | `/patients/me` | `patients:self`, vínculo del usuario autenticado |
| PATCH | `/patients/me` | `patients:self`, solo teléfono, fecha de nacimiento y dirección |

Los listados aceptan `limit` (1–100, defecto 25), `offset`, `search` y `enabled=true/false`; pacientes también acepta `clinicId`. No se admiten otros filtros ni orden arbitrario. Búsqueda literal parcial por nombre/código en clínicas, y nombre completo/correo/teléfono en pacientes; `%` y `_` del cliente no actúan como comodines. Se devuelven `{ items, total }` y un orden estable. La búsqueda no incluye DPI ni información clínica.

Ejemplo de alta de paciente:

```json
{
  "clinicId": "UUID-DE-UNA-CLINICA-ACCESIBLE",
  "firstName": "Ana",
  "lastName": "Pérez",
  "email": "ana@example.com",
  "phone": "+502 5555 1234",
  "birthDate": "1990-10-15",
  "address": "Dirección de contacto",
  "reason": "Registro en recepción"
}
```

Los campos opcionales pueden omitirse y limpiarse con `null`. Nombres, código, estado e identificadores no aceptan `null`. No se admite `userId`, roles o membresías en el alta/edición de un paciente. Las mutaciones administrativas admiten `reason` opcional validado; el actor se obtiene de la sesión.

## Vínculo con una cuenta

**Cuenta nueva:** crear el paciente en una clínica y enviar `POST /auth/invitations` con `patientId` y los datos habituales de invitación. El destinatario debe coincidir con el correo registrado del paciente. Se requiere `patients:link` además de los permisos de invitación/asignación. Antes de crear, reenviar y aceptar se vuelven a validar paciente habilitado, sin cuenta, mismo contacto y alcance del invitador. La aceptación verifica el token y crea la identidad, sus roles, vínculo, bienvenida y auditoría en la misma transacción. Si falla la vinculación, no queda una cuenta o invitación parcialmente aceptada. Las invitaciones de personal sin `patientId` conservan su comportamiento.

**Cuenta existente:** `POST /patients/:id/account` con `{ "userId": "..." }`. Un operador con permiso y alcance selecciona explícitamente la cuenta. El servidor exige que esté verificada/habilitada y que su correo sea exactamente el contacto registrado del paciente; no permite vincular por nombre, teléfono, DPI o un ID arbitrario sin esa comprobación. Rechaza pacientes/cuentas ya vinculados a otra persona, incluso con solicitudes concurrentes. Repetir el mismo vínculo no genera otro evento.

No se enlazan automáticamente todos los pacientes con correos coincidentes, ni se migra a todas las cuentas customer. Los casos de contactos compartidos, registros duplicados, menores o reasignación de una cuenta requieren un flujo posterior explícito; esta API no expone desvinculación o sustitución libre de cuenta. Un operador autorizado debe comprobar que el registro y su contacto son correctos antes de invitar/vincular; la comprobación del canal no sustituye verificación documental.

Después del vínculo, la edición administrativa del paciente no puede sustituir su correo. Se usa el flujo existente de cambio de email de la cuenta, con contraseña actual y token al contacto nuevo. La confirmación actualiza también el contacto del paciente y registra `patient.contact-verified` en la misma transacción. Conservar el mismo `userId` permite seguir identificando al propietario y revoca las sesiones como ya exige autenticación.

## Auditoría y avisos

Se registran `clinic.created/updated/staff-assigned/staff-unassigned` y `patient.created/updated/account-linked/clinic-associated/clinic-disassociated/contact-verified`. La baja de una identidad también registra las asignaciones a clínicas que elimina su cascada. Las operaciones repetidas sin cambios no generan nuevos eventos de edición o asociación.

Los eventos de paciente seleccionan expresamente campos administrativos, incluido DPI, fecha de nacimiento y dirección cuando existen: la auditoría contiene datos personales y sus permisos globales deben tratarse como sensibles. No contiene contraseñas, tokens ni notas médicas. Los avisos en bandeja al paciente vinculado usan mensajes generales sin esos datos personales. No se agrega una nueva campaña de emails por cada edición.

Cambios, asociaciones, vínculo, auditoría y avisos se guardan en la misma transacción SQL. Fallos de persistencia revierten el cambio original. No se usan llamadas externas dentro de esas transacciones. Se conservan los reintentos y mecanismos de entrega de notificaciones existentes para los mensajes que soliciten email.

## Verificación y siguientes módulos

Pruebas de casos de uso/controladores y PostgreSQL temporal cubren permisos, aislamiento por sede, revocación sobre sesión abierta, búsqueda, datos inválidos, preservación al desactivar, vínculo de cuenta, aceptación única de invitaciones, cambio verificado de contacto y rollback de auditoría. No se usan la base ni el correo real del usuario.

La matriz de cargos concretos sigue abierta. También quedan fuera fusión de pacientes duplicados, reasignación de cuenta, excepciones documentales, familiares/dependientes, políticas de retención y frontend. Membresías y consumos usarán el UUID global del paciente y su propio saldo; las asociaciones de clínica no deben duplicarlo.

## Actualización vigente DN-17

Leer clinic-context.md: se sustituyen los párrafos anteriores que interpretan clinics:all como acceso a todas las sedes. Ahora las consultas requieren asignación explícita, permiso en la clínica concreta y selección del JWT. user_roles contiene roles por sede, no solo permisos globales. Todas no permite consultar otras clínicas. El gestor global puede administrar metadatos/asignaciones con su permiso explícito, sin abrir pacientes ajenos. PUT staff requiere roles; los cambios crean avisos atómicos; GET staff devuelve datos mínimos de cuenta y roles locales. Se permite no tener clínicas. Invitaciones requieren clinicAssignments y aceptación revalida cada sede.

Actualización DN-20 (06/11/2026): la interfaz gestiona colaboradores y pacientes por separado con formularios de página. Los endpoints específicos fijan la identidad básica staff/customer y no aceptan roles globales del cliente. Paciente usa la clínica actual para su ficha, sin asignación de personal; Todas exige seleccionar una sede. Ver people-management.md para rutas, permisos, historial por kind y creación/aceptación atómicas. La explicación histórica del flujo genérico permanece solo como compatibilidad.
