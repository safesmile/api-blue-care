# Reglas de negocio confirmadas — Blue Care +

Fecha: 2026-11-03 (America/Guatemala).

Fuente de producto: respuestas 1–12 del dueño en la conversación «Revisar requisitos y backend Blue Care». Registro central: [Reglas de negocio en Notion](https://app.notion.com/p/3f8c0e4d04e7810fb0a8e67cee569272).

Esta copia guía el desarrollo junto con las instrucciones del repositorio. Las decisiones de esta fecha prevalecen sobre propuestas anteriores incompatibles; no convierten pendientes en decisiones ni autorizan implementarlos por suposición.

## Decisiones confirmadas por el dueño del proyecto
Fecha: 2026-11-03. Fuente: respuestas 1–12 en la conversación «Revisar requisitos y backend Blue Care». Estas decisiones actualizan las propuestas previas; no significan que las funcionalidades estén implementadas. Los detalles no contestados se conservan como pendientes.

### DN-01 — Oferta, invitación y contratación (respuesta 1)
El doctor presenta la membresía en la clínica. Si el paciente desea contratar, recepción envía una invitación por email para crear su usuario. El paciente acepta, registra su información y dentro de Blue Care encuentra la opción para pagar mediante Recurrente. Recurrente realiza los cobros mensuales de la membresía. La explicación comercial también menciona pago en recepción con ayuda de Recurrente: falta precisar si recepción solo asiste el mismo flujo digital o dispone de un flujo de cobro adicional. No asumir que recepción activa beneficios marcando manualmente un pago.

### DN-02 — Plan, modalidades y precios (respuesta 2)
El plan inicial se llama Blue Care +. Tiene dos modalidades de pago del mismo plan: mes a mes y un año completo pagado por adelantado. El precio anual equivale a diez mensualidades. El monto exacto aún no fue indicado. Los precios se pueden subir o bajar para nuevos clientes; quienes ya contrataron conservan el precio que tenían al contratar. Confirmado el 04/11/2026: al cancelar y volver a contratar se aplica el precio vigente para nuevos contratos. El cambio de modalidad durante un contrato sigue pendiente.

### DN-03 — Contenido y beneficios administrables (respuestas 2 y 8)
Los beneficios contemplan descuentos en las clínicas para el titular y su familia, un kit de cepillo y otros instrumentos útiles, y acceso a cupones de comercios aliados. Los detalles visibles del plan deben poder editarse desde administración sin desplegar una nueva versión. El sistema debe soportar distintas formas de beneficio: porcentajes de descuento, cantidades de servicios y otras reglas. «Dos limpiezas por mes» fue un ejemplo de flexibilidad, no un cupo aprobado para Blue Care +. Los porcentajes, cupos exactos y condiciones del kit no están definidos.
Confirmado expresamente: los cambios de beneficios también se aplican a miembros actuales, conservando el precio que contrataron. Precio contratado y configuración de beneficios deben tratarse por separado. Esta decisión sustituye la propuesta de congelar todos los derechos por versión del plan. Confirmado en DN-15: efecto inmediato al publicar, contabilizando los consumos ya realizados; saldo mínimo cero.

### DN-04 — Vigencia por pago (respuesta 3)
La vigencia comienza cuando el paciente paga. El acceso al período siguiente depende de que se haya realizado el pago correspondiente, tanto para modalidad mensual como anual. El día 15 se utilizó como ejemplo de aniversario de contratación; no se aprobó una fecha de cobro universal. Confirmado expresamente: si la renovación no se paga, los beneficios terminan al finalizar el período ya pagado, sin días de gracia. Un cobro fallido anticipado no recorta por sí solo el período que ya fue pagado. Confirmado el 04/11/2026: los pagos tardíos conservan el aniversario original; se usa America/Guatemala y se ajusta al último día de meses cortos recuperando después el día original. Siguen pendientes reintentos especiales, reembolsos, contracargos y pagos fuera de todo el siguiente período esperado.

### DN-05 — Cuenta independiente de la membresía (respuesta 4)
Una persona puede abrir y usar su cuenta sin membresía. No recibe beneficios ni acceso a cupones de membresía. Puede acceder a Blue Care Meds, notificaciones de citas, historial y otras capacidades generales cuando esas funcionalidades estén disponibles. Crear o activar la cuenta no crea una membresía. Esta decisión no habilita por sí sola registro público libre: el flujo confirmado es por invitación.
Alcance confirmado posteriormente: Recurrente para membresías se incluye en Entrega 1; cupones se mantienen en Entrega 2 y Meds+ en Entrega 3. No se ha adelantado la integración clínica.

### DN-06 — Continuidad y exclusividad (respuestas 5 y 6)
Una renovación anticipada inicia su nuevo período al terminar el actual. Cada paciente puede tener una sola membresía vigente y un solo plan vigente a la vez, incluso si en el futuro se agregan más planes. Actualmente no existe cambio entre planes porque solo hay uno; mensual y anual son modalidades de pago. No se definieron cambios entre esas modalidades ni prorrateos.

### DN-07 — Suspensión administrativa y cancelación del paciente (respuesta 7)
Un administrador puede suspender una membresía y su efecto sobre beneficios es inmediato. Cuando el paciente cancela, conserva beneficios hasta terminar el mes o año de membresía ya pagado, según modalidad. No confundir solicitud de cancelación con pérdida inmediata de acceso.
Confirmación posterior: durante la suspensión administrativa Recurrente no debe seguir cobrando. Confirmado el 04/11/2026: cancelar detiene futuras renovaciones mensuales/anuales y suspender conserva el vencimiento original. Siguen pendientes reactivación, devoluciones y contracargos.

### DN-08 — Núcleo familiar (respuestas 8 y 9)
El paciente define su núcleo familiar. El máximo inicial es cuatro beneficiarios adicionales al titular; este máximo debe poder configurarse desde administración. Cada beneficiario dispone inicialmente de un descuento en limpieza al mes. El cupo es individual, configurable desde administración y se reinicia cada mes; no es una bolsa familiar compartida. Un beneficiario no se puede cambiar hasta que transcurra un año desde su creación. Deben existir límites de usos mensuales y de cambios de beneficiarios. Un beneficio mensual no utilizado se pierde; no se acumula al siguiente mes.
DN-15 resuelve datos mínimos, reemplazo anual, conservación de familiares/bloqueos al recontratar, reducción del máximo y períodos por aniversario. Las excepciones al bloqueo siguen pendientes; no se implementa una autorización para omitirlo.

### DN-09 — Consumo y registro (respuesta 10)
El beneficio se descuenta al prestarse el servicio. Un administrador debe poder registrar o canjear ese beneficio; el QR se propuso como mecanismo posible, sin protocolo definitivo aprobado. Deben guardarse fecha, clínica, quién realizó el canje y demás información relevante. Se mantiene la regla previa de saldo global entre clínicas. Aquí «cobrar el beneficio» se entiende como registrar/canjear el uso, no como un cobro monetario adicional definido.

### DN-10 — Correcciones y límites (respuesta 11)
Un administrador puede revocar un consumo registrado por error. No se permite otorgar un beneficio sujeto a cupo cuando no haya saldo. No se aprobó una excepción que permita saldos negativos. DN-15 confirma motivo obligatorio y devolución únicamente al período original. Registrar trazabilidad de la corrección es consistente con RF-023. No se exige una segunda aprobación no definida por el dueño.

### DN-11 — Roles configurables (respuesta 12)
Los administradores tendrán las operaciones administrativas descritas y podrán crear roles. El sistema no debe quedar limitado a superadmin, admin y customer: son roles iniciales, no el universo cerrado de roles del producto. Las operaciones deben depender de permisos. La matriz de funciones por rol sigue pendiente; el 04/11/2026 se confirmó el alcance por clínicas asignadas y un permiso global (DN-13). La delegación técnica está limitada a los permisos del propio administrador.

### DN-12 — Decisiones previas conservadas
Se mantienen una sola organización, múltiples clínicas, membresía válida en todas las sedes y separación de identidad, paciente y membresía. Los descuentos/cupos no se duplican por visitar otra clínica. Blue Care sigue separado del sistema clínico.

## Contradicciones e impactos sobre la línea base
- RN-006 decía como propuesta que la membresía precedía a la activación. Queda sustituida: la cuenta puede existir y activarse antes de contratar.
- La visión ubicaba checkout/pagos/suscripciones en Entrega 3 y P-002 asumía ausencia de checkout en Entrega 1. Contratar la membresía dentro de Blue Care mediante Recurrente agrega integración de pagos al flujo de membresías. El dueño confirmó posteriormente Recurrente para membresías en Entrega 1, manteniendo cupones en Entrega 2 y Meds+ en Entrega 3.
- Cupones estaban en Entrega 2 y Meds+ en Entrega 3. El dueño confirmó que permanecen en esas entregas, aunque la cuenta sin membresía pueda utilizar Meds+ cuando esté disponible.
- La propuesta original de RF-014 impedía cambiar derechos de miembros antiguos al editar el plan. El dueño la sustituyó: el precio contratado permanece, pero los cambios de beneficios sí se aplican también a miembros actuales. Debe conservarse el historial para reconstruir el precio y las reglas aplicadas a cada consumo, sin congelar por ello todos los beneficios futuros.
- RF-008 exige alcance por clínica; la respuesta 12 confirmó roles dinámicos. La aclaración del 04/11/2026 resuelve el alcance por asignaciones y permiso global, según DN-13.
- Limitación anterior resuelta en el backend: usuarios e invitaciones admiten roles personalizados existentes, y hay endpoints privados para gestionarlos. Los tres roles iniciales siguen protegidos. Ver identity-authorization.md; la matriz de cargos concretos continúa pendiente; el alcance por asignaciones/global ya fue confirmado (DN-13).
- Familias, no acumulación, anulación de consumos y condiciones de vigencia precisan preguntas previas; no contradicen una política familiar aprobada anteriormente, porque esa decisión estaba abierta.

## Preguntas que siguen abiertas antes de diseñar restricciones definitivas
1. Confirmado el 04/11/2026: únicamente GTQ; anual equivale a diez mensualidades. Pendientes el precio exacto y los impuestos; los importes finales quedan configurables por administración, sin valor comercial sembrado.
2. ¿Pago exclusivamente dentro de la cuenta o también un cobro iniciado por recepción? ¿La cuenta solo se abre por invitación?
3. Confirmado: sin pago de renovación, los beneficios terminan al finalizar el período pagado y no hay días de gracia. El pago tardío conserva aniversario (04/11/2026). Pendientes: reintentos especiales, reembolsos, contracargos y cobertura de varios períodos omitidos.
4. Confirmado el 04/11/2026: la anual se renueva automáticamente salvo cancelación; cancelar detiene futuras renovaciones de ambas modalidades. Suspender detiene cobros y conserva el vencimiento original, sin extenderlo. Reactivación y devoluciones siguen pendientes.
5. Confirmado: los cambios de beneficios se aplican también a miembros actuales, conservando su precio contratado. DN-15 confirma efecto inmediato de publicación contando consumos existentes. Pendiente: cambio de modalidad. Precio al recontratar confirmado: se aplica el vigente para nuevos contratos.
6. Confirmado: cuatro beneficiarios adicionales al titular, con máximo configurable. DN-15 confirma nombre/apellido y fecha de nacimiento opcional, sin cuenta propia; UUID interno independiente.
7. Confirmado: un descuento mensual por beneficiario, cupo individual configurable, reinicio cada mes y sin acumulación. DN-15 confirma aniversario mensual, incluido pago anual, y reemplazo anual por beneficiario.
8. ¿Cómo se autorizan y registran excepciones al bloqueo anual de beneficiarios y cambios de máximos?
9. ¿Frecuencia de entrega del kit y lista exacta de beneficios iniciales?
10. DN-15 confirma motivo obligatorio y devolución al período original. Sigue pendiente la matriz de cargos: canjear y anular exigen permisos independientes y alcance de clínica.
11. Confirmado el 04/11/2026: acceso por clínicas asignadas y permiso global. Sigue pendiente la matriz de funciones por cargo; la implementación técnica impide delegar permisos que el operador no posee.
12. Confirmado: Recurrente de membresías en Entrega 1, cupones en Entrega 2 y Meds+ en Entrega 3. Pendiente: qué historial y notificaciones de citas estarán disponibles inicialmente sin integración clínica.


## Referencias contrastadas

- [Visión y entregas](https://app.notion.com/p/3f8c0e4d04e781d39453faa62720788f).
- [ERS Entrega 1, RF-001–RF-023](https://app.notion.com/p/3f8c0e4d04e7816ca2c7d7011905a0df).
- [Reglas y preguntas anteriores](https://app.notion.com/p/3f8c0e4d04e7810fb0a8e67cee569272).
- [Arquitectura y ADR](https://app.notion.com/p/3f8c0e4d04e78164a330e924450c11b0).

La comparación de esta sesión cubre esas páginas y la documentación/código local. No se volvió a inspeccionar el material comercial original citado por Notion (presentación, investigación, resumen y guía); no se afirma haber contrastado aquí esas fuentes originales por separado.



## Aclaraciones posteriores del dueño
Fecha: 2026-11-03. Fuente: respuestas 1–6 posteriores a DN-01–DN-12.
- Confirmado: cuatro beneficiarios adicionales al titular, máximo configurable.
- Confirmado: un descuento al mes por beneficiario, cupo individual configurable, reinicio mensual y sin acumulación.
- Confirmado: una membresía suspendida administrativamente no debe continuar generando cobros de Recurrente. No se respondió aún si su vencimiento se extiende.
- Confirmado: Recurrente de membresías en Entrega 1, cupones en Entrega 2 y Meds+ en Entrega 3.
- Respuesta 3 aclarada expresamente: «Sí, sin días de gracia». El impago interrumpe beneficios al terminar el período ya pagado, sin prórroga.
- Respuesta 5 aclarada expresamente: «Sí, también a miembros actuales». Los cambios de beneficios alcanzan a esos miembros y se conserva su precio contratado.


## DN-13 — Pacientes y alcance por clínicas (04/11/2026)

Fuente: respuestas del dueño al comenzar el paso 4, «Implementar pacientes y clínicas».

- Alcance confirmado: «Clínicas asignadas + permiso global». El personal opera en las sedes asignadas, con un permiso explícito para operar en todas. Las operaciones siguen requiriendo sus propios permisos. No se concede alcance global por el nombre de un rol.
- Datos solicitados: nombre, apellido, teléfono, correo, «dpi?», fecha de nacimiento y dirección. Se implementan DPI y datos de contacto/perfil adicionales como opcionales para no excluir pacientes que aún no los tengan; el correo se exige para invitar/vincular. El DPI opcional de 13 dígitos y único es una validación de registro, no verificación documental. No se declaró obligatoria toda la ficha al registrarla en recepción.
- Datos técnicos necesarios: UUID, estado, fechas, vínculo opcional uno a uno con cuenta y asociaciones de clínicas. No se agregan datos médicos inferidos.
- Implementación y límites: `patients-clinics.md`. Una asociación de clínica gobierna acceso administrativo al registro; no duplica al paciente ni modifica la validez global de una membresía futura. No se ha definido una matriz cerrada de permisos por cargo ni excepciones de familiares/dependientes.

## DN-14 — Planes, renovaciones y calendario (04/11/2026)

Fuente: respuestas expresas del dueño durante el paso 5, «Implementar planes versionados y membresías».

- Moneda única inicial: GTQ. El monto exacto y el tratamiento fiscal siguen por definir; no se inventa un precio comercial. Los importes finales y su explicación fiscal son entradas explícitas de administración.
- Calendario: zona America/Guatemala. El aniversario del 29/30/31 se ajusta al último día de un mes corto y recupera el día original después. Se conserva la hora local.
- Pago tardío: conserva el aniversario anterior, no comienza otro aniversario al pagar. Sigue sin haber días de gracia. No se ha definido cómo imputar un pago que omite varios períodos completos.
- Cancelación: detiene automáticamente futuras renovaciones, mensuales y anuales, sin quitar la cobertura ya pagada.
- Suspensión administrativa: detiene cobros y conserva el vencimiento original del período pagado; no se prolonga por los días suspendidos. No se aprobó una reactivación automática.
- Recontratación: se usa el precio vigente para nuevos contratos. No se mantiene el precio de un contrato cancelado al crear otro.
- Renovación anual: confirmada expresamente «Sí, renovación anual automática», salvo cancelación del paciente.
- Documentación oficial proporcionada por el dueño: https://docs.recurrente.com/guias-espanol/comenzar/primer-pago-de-prueba. No se proporcionaron credenciales ni acceso real de Sandbox.

Implementación, contratos, límites y configuración: `plans-memberships.md`. Los cambios de contenido comercial publicado se muestran a miembros actuales; el motor de beneficios/consumos y su política de cambios se implementan en el paso 6, según DN-15 y benefits.md.


## DN-15 — Beneficios, períodos y familia (04/11/2026)

Fuente: respuestas expresas del dueño durante el paso 6, incluidas las aclaraciones finales.

- El cupo mensual sigue el aniversario mensual de la membresía, también si el pago es anual. Conserva America/Guatemala y la regla de meses cortos de DN-14; no usa meses calendario ni acumula sobrantes.
- Anular un consumo exige motivo y devuelve cupo únicamente a su período original, sin trasladarlo al mes actual.
- Publicar una revisión de beneficios la aplica inmediatamente a miembros actuales y futuros. Se cuentan los consumos ya hechos en el período; si el límite baja por debajo del consumo, el disponible queda en cero. El precio contratado permanece separado.
- Familiares: nombre, apellido y fecha de nacimiento opcional; no necesitan cuenta propia. Máximo inicial cuatro adicionales al titular, configurable; cupo individual inicial un descuento mensual configurable. No se aprobó un porcentaje comercial específico.
- Cada beneficiario se puede reemplazar tras un año; la persona nueva inicia su propio bloqueo anual. Si disminuye el máximo, se conservan existentes y se bloquean nuevas altas mientras se exceda. No se retiran familiares automáticamente.
- Al cancelar y volver a contratar se conservan familiares y bloqueos anuales. La nueva membresía inicia sus propios períodos y cupos, con precio vigente para nuevos contratos conforme DN-14.

Implementación: benefits.md. Estas precisiones resuelven preguntas abiertas; no contradicen DN-01–DN-14. Se conserva expresamente la sustitución histórica de RF-014: precio protegido y reglas de beneficios actualizables. Pendientes: porcentajes reales, entrega/frecuencia del kit, matriz de cargos y excepciones familiares. No se inventan valores comerciales ni excepciones.


## DN-16 — Prevención y canales de recordatorio (04/11/2026)

Fuente: respuestas expresas del dueño durante el paso 7.

- El intervalo para calcular la próxima limpieza lo indica el personal por paciente; no hay frecuencia médica general impuesta.
- Los recordatorios deben usar el motor de notificaciones: correo electrónico, notificaciones de sistema y push.
- Plazos iniciales: siete días y un día antes. Desde administración se puede configurar manualmente cuándo enviar el aviso.
- El trabajo solicitado en esta etapa es backend; las pantallas se implementarán después.

Decisión técnica de esta implementación: los plazos se configuran por evento en horas de anticipación y se heredan al siguiente evento del paciente. No se exige membresía para prevención. Una próxima fecha calculada es una sugerencia, no una reserva de cita externa. FCM se prepara como adaptador de push mediante ADC, deshabilitado hasta configurar Firebase/dispositivos. Detalles, contratos y limitaciones: prevention-reminders-dashboard.md. No se introducen excepciones a las reglas de membresías o beneficios.
