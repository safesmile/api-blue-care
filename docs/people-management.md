# Colaboradores y pacientes: gestión y altas separadas

Decisión del dueño del 06/11/2026, DN-20 de business-rules.md. Se mantienen una identidad de acceso y perfiles de negocio independientes, con pantallas/formularios separados. No hay cambio de tipo elegido por el usuario.

## Colaborador

POST /api/v1/auth/invitations/collaborators acepta exclusivamente firstName, lastName, email, clinicId y role (más el motivo de auditoría opcional). La clínica y el rol de trabajo son obligatorios. El servidor asigna el rol global protegido staff, que contiene únicamente perfil/credenciales/bandeja/dispositivos propios, y registra el rol solicitado únicamente en esa clínica. Excluye customer, staff, superadmin y roles legacy como opciones locales de este formulario. Un rol local admin nunca se convierte en un rol global admin.

GET /api/v1/auth/invitations/collaborators/roles?clinicId=UUID devuelve opciones permitidas por la autoridad actual del operador y los permisos concretos de esa sede. Usa las mismas comprobaciones transaccionales que la asignación real; no basta con filtrar las opciones en el navegador. Crear exige invitations:create, roles:assign y clinics:staff-manage, además del alcance y delegación vigentes sobre la clínica de destino. Consultar opciones para gestionar accesos exige roles:assign y clinics:staff-manage.

La aceptación registra identidad, staff_profiles, clinic_staff, roles por clínica, auditoría y avisos de acceso en la misma transacción. Revalida las atribuciones actuales del invitador y de los roles. No crea una ficha de paciente ni membresía. Se permite que posteriormente un colaborador quede sin clínicas; conserva su perfil laboral y acceso personal de seguridad.

GET /api/v1/users/collaborators y GET /api/v1/users/collaborators/:id requieren clinics:staff-list. La selección de clínica y el permiso por sede limitan listado, detalle, total y clínicas/roles visibles de cada persona. Una identidad paciente no aparece como colaborador por tener cuenta. La clasificación coincide con el contexto de acceso: perfil laboral, rol básico staff o grants administrativos globales. Solo un gestor global con clinics:all y clinics:staff-list dispone de catálogo administrativo global; seleccionando una clínica se restringe también ese catálogo. Se devuelven datos de contacto/estado y metadatos laborales, sin contraseñas ni permisos efectivos del destinatario.

La gestión de acceso usa PUT /clinics/:clinicId/staff/:userId con roles y DELETE de la misma ruta. Conserva asignaciones de otras sedes y emite avisos/auditoría de forma durable e inmediata. Editar identidad global sigue exigiendo users:update/users:manage y protección de superadmin; no se concede esa capacidad por administrar una clínica.

## Paciente

POST /api/v1/auth/invitations/patients acepta firstName, lastName, email y patientId opcional (más motivo de auditoría opcional). No admite roles, staff, kind, clinicId ni clinicAssignments. El backend fija roles:[customer], staff:false y ninguna asignación de personal. customer es el nombre interno conservado del rol Paciente; no se cambia el nombre de cuentas/roles existentes.

Confirmado por el dueño: la ficha se registra en la clínica actual del invitador. Si clinicId de la sesión es null/Todas, la operación se rechaza y el formulario pide seleccionar una sede en el encabezado. No hay selector de clínica de destino en el formulario de paciente. patient_clinics delimita el trabajo del personal; no concede acceso institucional al paciente ni se escribe una clínica en su JWT.

Crear exige invitations:create y patients:link. Si todavía no hay ficha, exige también patients:create en la sede actual. No requiere roles:assign: el permiso de invitar pacientes autoriza únicamente ese rol personal fijo, no delegación arbitraria. Los nombres de roles no reemplazan estas políticas.

Sin patientId, crea una ficha mínima de nombre/apellido/email y su asociación clínica en la misma transacción que la invitación y la auditoría. Reutiliza una única ficha existente del mismo correo en esa sede, sometida a las verificaciones habituales; si el contacto corresponde a varias fichas exige escoger una existente. No sobrescribe sus datos ni crea duplicados al reenviar o repetir después de revocar. Con patientId revalida paciente activo, sin cuenta, correo registrado y alcance de la clínica seleccionada. Los bloqueos de sede/asignación impiden autorizar una creación con una clínica desactivada o acceso retirado concurrentemente.

Aceptar verifica el contacto y enlaza una única cuenta verificada al paciente. El paciente accede a sus recursos propios sin clínica en el token, sin staff_profiles/clinic_staff/roles locales y sin membresía automática. El vínculo clínico no equivale a autorización de personal. Se conserva el precio/saldo global y todas las reglas comerciales anteriores.

Crear, reenviar y aceptar revalidan contacto y autoridad vigente. Los permisos de invitar y vincular deben coincidir en una misma clínica autorizada; no se combinan atribuciones de sedes distintas durante la aceptación pública. Retirar la sede al invitador impide completar un alta pendiente fuera de su alcance. Revocar también exige alcance sobre la ficha, salvo la autoridad de administración global explícita. Una carrera de invitaciones al mismo correo deja una sola invitación pendiente y una ficha, revirtiendo la operación perdedora.

## Historial y compatibilidad

invitations.kind distingue patient, collaborator y general. GET /auth/invitations?kind=patient o kind=collaborator filtra en SQL antes del total y la paginación. Reenvío y revocación conservan estado, cooldown, rotación de tokens e historial. Pacientes pueden reenviarse con los permisos del caso de uso fijo, sin roles:assign; colaboradores mantienen comprobación de delegación. Si SMTP falla después del guardado, se informa 503 y se conserva la ficha/invitación para revisión y reenvío, sin repetir automáticamente una operación ambigua.

El endpoint genérico POST /auth/invitations permanece compatible con clientes anteriores y sus controles de delegación. La interfaz nueva utiliza exclusivamente los endpoints específicos. Los registros anteriores conservan kind general; sus tokens/roles/datos no se convierten silenciosamente. El rol staff se sincroniza como rol del sistema protegido; el catálogo sigue admitiendo roles de trabajo personalizados. El seeder conserva sus tres cuentas de muestra y sus asignaciones; no crea otra cuenta por introducir este rol básico.

## Frontend

- /colaboradores: directorio real de personal y clínicas/roles visibles.
- /colaboradores/invitar: página de invitación con contacto, clínica y un rol permitido.
- /colaboradores/:id/acceso: página para conceder, reemplazar o retirar acceso de una sede.
- /colaboradores/:id/editar: página de datos/estado de identidad para administradores autorizados, sin roles globales editables en este formulario.
- /pacientes: listado real de fichas clínicas dentro del alcance.
- /pacientes/invitar: página de alta con rol personal fijo; desde una ficha permite invitar su contacto registrado.
- /pacientes/:id/editar: edición de nombres/contacto/DPI opcional/fecha de nacimiento/dirección/estado de la ficha, sin roles ni sustitución libre de cuenta o correo verificado.
- /colaboradores/invitaciones y /pacientes/invitaciones: historiales separados, reenvío/revocación y estado de entrega. No se exige una membresía para crear la cuenta.

Los formularios son páginas completas. /usuarios y /usuarios/invitaciones redirigen al directorio/historial de colaboradores. Los datos ilustrativos de pacientes de AdministrationPage ya no sirven estas rutas; las otras pantallas de negocio pendientes mantienen su alcance anterior. Menú, búsqueda y acceso directo aplican permisos, sin sustituir los controles del servidor.

## Esquema y operación

Se edita 202611040001-patients-clinics.ts para incluir kind y su restricción, sin crear una nueva migración. En la base local ya migrada se añadió la columna/restricción mediante una actualización transaccional idempotente y se ejecutó npm run permissions para incorporar staff. Se verificó localhost:5432/blue_dent y ausencia de un rol personalizado staff antes de sincronizar. No se hizo reset, no se borraron usuarios/fichas/invitaciones, ni se modificó .env o credenciales. migrate por sí solo no reaplica una migración histórica editada; una instalación con datos reales requeriría su actualización incremental correspondiente.

Pruebas: 281 unitarias (cobertura de aplicación/controladores 100% líneas/sentencias/funciones), 116 de integración en PostgreSQL desechable y 58 del frontend. Incluyen escalada por payload, paciente sin delegación de roles, filtros por sede/tipo, perfil personal, aceptación revalidada, competencia por contacto, reutilización de ficha y revocación fuera de alcance. QA visual real de ambos formularios sin enviar invitaciones a destinatarios reales. Build, tipos, formato y lint backend correctos; frontend compila y su lint conserva advertencias previas del template.

## Directorio y ficha de pacientes

DN-21 concede lectura y listado al rol admin inicial, dentro de sus clínicas asignadas. /pacientes usa GET /patients con patients:list; /pacientes/:id usa GET /patients/:id con patients:read. La ficha muestra los datos administrativos reales, sin datos ilustrativos de membresía o prevención.

Contrato de listados para pacientes, colaboradores e invitaciones: la petición usa limit y offset, y la respuesta { items, total } contiene el total después del alcance y filtros, antes de paginar. El panel pide 10 o 25 elementos y mantiene 25 como máximo visual. Se conserva el contrato de la API para otros consumidores.

La prueba de integración cubre paginación con total por clínica, lectura dentro del alcance, 404 fuera de alcance y rechazo de escritura. El catálogo se sincronizó en la base local de desarrollo, sin migraciones ni reinicio de datos.
