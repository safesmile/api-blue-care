# Beneficios y consumo global

Implementación del paso 6 (04/11/2026). Decisiones de producto: business-rules.md, especialmente DN-08–DN-10 y DN-15. El saldo representa unidades de beneficio, no dinero ni un cobro adicional de Recurrente.

## Configuración y reglas

Cada definición pertenece a un plan y tiene código estable, tipo `discount`, `service` o `item`, destinatario `holder`, `beneficiaries` o `all` y período `monthly`, `annual` o `contract`. Estas dimensiones son inmutables para no reinterpretar consumos anteriores; otra identidad requiere otra definición. Puede deshabilitarse mediante una revisión publicada, sin borrar evidencia.

Las revisiones son inmutables: nombre, descripción, cupo entero (1–100000), habilitado y porcentaje en puntos básicos exclusivamente para descuentos (1500 = 15%). Crear una revisión no la publica. Publicar cambia inmediatamente la regla para miembros nuevos y actuales, conservando el precio contratado. Se descuentan los consumos existentes del mismo período; disponible = máximo(0, límite vigente − unidades consumidas no anuladas). No se vuelve a publicar una revisión histórica retirada. Los detalles comerciales de plans siguen separados de estas reglas cuantificables.

No se siembran porcentajes, entregas del kit ni beneficios comerciales inventados. Los importes y porcentajes presentes en pruebas son fixtures. Administración debe crear y publicar la lista real. No hay cálculo monetario ni redondeo de descuentos sobre facturas en este módulo.

El período mensual sigue el aniversario original en Guatemala incluso para membresías de pago anual. Los meses cortos ajustan el vencimiento y después recuperan el día original. Períodos semiabiertos [inicio, fin); no se acumulan sobrantes. `annual` sigue el aniversario anual; `contract` abarca el contrato. El saldo se identifica por membresía + beneficio + persona + período: nunca por clínica. Solo una membresía pagada vigente, paciente activo, persona vigente y beneficio habilitado permiten consumo. Cancelación conserva acceso pagado; suspensión e impago al vencer lo detienen.

## Familia

Se almacena por paciente, no por contrato. Se conservan familiares y bloqueos al recontratar, aunque los cupos sean de la nueva membresía. Límite predeterminado cuatro personas adicionales al titular; configurable por plan entre 0 y 100. Cada persona tiene cupo independiente: no hay bolsa familiar compartida. La respuesta paginada de familia incluye `maxBeneficiaries`.

Se requieren `firstName` y `lastName`; `birthDate` opcional YYYY-MM-DD real, no futura según Guatemala. No se crean cuentas. No se permite duplicar exactamente nombre/apellido/fecha en la familia vigente. Cada posición mantiene identidad estable y persona histórica inmutable. Reemplazar después del bloqueo anual crea otra identidad y otro bloqueo de un año; no modifica consumos históricos. Reducir el máximo preserva existentes y bloquea nuevas altas por encima del máximo. No existen eliminación libre, edición que sustituya identidad ni excepción al bloqueo no aprobada.

## Consumo, concurrencia y corrección

La recepción autorizada registra al prestar el servicio: membresía, beneficio, familiar opcional (omitir = titular), clínica, unidades 1–1000, referencia del servicio e `idempotencyKey` UUID. Fecha, actor, persona, período, regla y saldo se determinan en servidor. El registro guarda nombres de actor/clínica/persona como evidencia, revisión aplicada, porcentaje, límite y unidades.

Las escrituras bloquean paciente y membresía para serializar consumos entre clínicas. La lectura de la revisión bloquea primero el puntero publicado y luego resuelve sus datos, evitando mezclar una publicación nueva con límites anteriores. Dos canjes que disputan el último cupo no pueden dejar saldo negativo. Las consultas son instantáneas consistentes, no reservas.

Repetir la misma clave y datos devuelve el resultado original; reutilizarla con otros datos da 409. La referencia del servicio también evita duplicar el mismo servicio con claves distintas. La corrección libera esa referencia para registrar el servicio corregido. Un conflicto transitorio de concurrencia da 409; reintentar conservando la clave original.

Anular requiere permiso independiente, acceso a la clínica original, UUID de idempotencia y motivo no vacío de hasta 500 caracteres. Solo hay una anulación por consumo: nunca se borra ni edita el registro. Devuelve unidades al período original; no crea saldo en el actual si ya cambió el período. Es posible corregir contratos vencidos/suspendidos y clínicas inactivas conservando alcance autorizado. Una anulación no vuelve a habilitar el comprobante ya utilizado. La evidencia conserva UUID/nombre del operador aunque se elimine su cuenta; esas referencias no tienen FK a users deliberadamente.

Consumo, comprobante, referencia, auditoría y aviso durable son atómicos: si falla cualquiera se revierte todo. Las tablas históricas rechazan UPDATE/DELETE/TRUNCATE por triggers. Los avisos son generales en bandeja propia, sin correo ni detalles clínicos; la auditoría tiene snapshots explícitos y permisos separados. No registrar cuerpos completos, comprobantes ni sus hashes en auditoría.

## Presentación para QR y alcance

El titular autenticado genera un comprobante para beneficio/persona/unidades. Contiene token aleatorio de 40 bytes (80 caracteres hex), dura cinco minutos y se almacena solo su SHA-256. La respuesta lleva Cache-Control: no-store. No reserva cupo: al canjear se vuelve a comprobar vigencia, reglas y saldo. No registrar el token ni incluirlo en URLs de infraestructura.

El frontend puede codificar el token en un QR; la imagen y pantalla de escaneo no forman parte de esta API. El personal envía token + clínica + referencia + clave. No puede sustituir persona/beneficio/unidades ligados al comprobante. Solo se usa una vez; la repetición idéntica devuelve el mismo resultado y otra clave se rechaza, incluso tras una anulación.

El consumo directo exige alcance sobre paciente y clínica. El comprobante del dueño permite canjear en otra clínica activa asignada al operador, sin otorgarle consulta general del paciente o de su historial fuera de alcance. El historial por clínica ofrece solo evidencia de esa sede. `clinics:all` amplía sedes, pero nunca sustituye el permiso de operación. El dueño puede presentar, no autoaprobar consumos ni anularlos.

## Contratos HTTP

Prefijo general `/api/v1`. Todos requieren sesión y política explícita; las rutas `me` además verifican el vínculo paciente–cuenta.

| Ruta | Operación / permiso |
| --- | --- |
| POST /benefits | Definición, benefits:create |
| GET /benefits?planId=... | Catálogo paginado, benefits:list |
| GET /benefits/:id | Definición y revisión actual, benefits:read |
| POST /benefits/:id/versions | Revisión, benefits:version |
| GET /benefits/:id/versions | Historial de reglas, benefits:read |
| POST /benefits/:id/versions/:versionId/publish | Publicar, benefits:publish |
| GET /benefits/plans/:id/family-settings | Máximo familiar, benefits:read |
| PUT /benefits/plans/:id/family-settings | `{maxBeneficiaries}`, benefits:family-settings |
| GET /benefits/me/:membershipId/balances | Saldo propio, benefits:self |
| GET/POST /benefits/me/:membershipId/family | Familia propia, benefits:self |
| POST /benefits/me/:membershipId/family/:beneficiaryId/replace | Reemplazo propio, benefits:self |
| GET /benefits/me/:membershipId/history | Consumos propios, benefits:self |
| POST /benefits/me/:membershipId/tickets | Presentar beneficio propio, benefits:self |
| GET /benefits/memberships/:id/balances | Saldo autorizado, benefits:balances |
| GET /benefits/memberships/:id/family | Familia autorizada, benefits:balances |
| POST /benefits/memberships/:id/family | Alta, benefits:family-manage |
| POST /benefits/memberships/:id/family/:beneficiaryId/replace | Reemplazo, benefits:family-manage |
| GET /benefits/memberships/:id/history | Historial autorizado, benefits:history |
| GET /benefits/clinics/:id/history | Historial de sede, benefits:history |
| POST /benefits/consumptions | Consumo directo, benefits:consume |
| POST /benefits/tickets/consume | Canje del comprobante, benefits:consume |
| POST /benefits/consumptions/:id/reverse | `{reason,idempotencyKey}`, benefits:reverse |

Listados: `offset`/`limit` (offset 0 y limit 25 por defecto, máximo 100). Balances admite `beneficiaryId`; omitirlo selecciona titular. Cada saldo devuelve `benefit`, `membershipEligible`, `recipientEligible`, `windowStart`, `windowEnd`, `usedUnits`, `remainingUnits`. Los campos no declarados se rechazan.

`superadmin` recibe el catálogo completo. `admin` y `customer` reciben `benefits:self`; los permisos operativos se asignan con roles configurables según la matriz pendiente, sin conceder privilegios por nombre de rol.

## Aplicación y verificación

Migración TypeScript `202611040003-benefits`: definiciones, revisiones, configuración familiar, posiciones/personas, comprobantes, consumos, anulaciones y referencias de servicio. Aplicar `npm run db:migrate` y `npm run permissions` en el entorno elegido; no requiere reset, variables nuevas ni dependencias nuevas. No se ha modificado la base del usuario ni se han realizado cargos, correos reales o aprovisionamiento de nube. Retención/purga de evidencia sigue pendiente; no se agrega borrado automático.

Las pruebas cubren competencia real con PostgreSQL entre doce solicitudes de dos clínicas, publicación concurrente, cupos individuales, cambios publicados contando uso previo, períodos mensuales/anuales/contrato, anulaciones simultáneas y entre períodos, bloqueo anual, snapshots tras reemplazo/eliminación del operador, permisos y comprobantes expirados/reutilizados. Un fallo simulado de persistencia del aviso verifica rollback del canje completo. Solo las pruebas sustituyen el reloj del contexto para avanzar aniversarios; producción siempre usa reloj PostgreSQL.

Verificación final del paso 6: 245 pruebas unitarias (47 suites) y 82 de integración (8 suites) aprobadas; cobertura de casos de uso/controladores 100% líneas, sentencias y funciones, 82.4% ramas. Build, tipos, lint sin advertencias y formato aprobados. PostgreSQL temporal detenido al terminar; sin migraciones sobre la base del usuario ni servicios externos reales.

## Alcance actualizado por DN-17

La selección firmada y los roles por sede se describen en clinic-context.md. Ni clinics:all ni Todas amplían consumos a sedes sin asignación/permisos. El historial del personal filtra la clínica de cada consumo; el paciente conserva su historial propio. La disponibilidad y el uso agregado siguen siendo globales por contrato/persona/período para impedir cupos duplicados; seleccionar una clínica no altera ese saldo global.
