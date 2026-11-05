# Correos con diseño compartido

Implementación del 04/11/2026. Aplica HTML a los correos de invitación, activación, recuperación, cambio de correo y a las entregas del motor durable. Conserva text/plain para clientes que no muestran HTML. No cambia tokens, URLs de acciones, vigencias, estados, reintentos o proveedores.

## Referencias revisadas

Se revisaron como referencias de lectura, sin modificarlas ni importar una dependencia Kraken:

- Kraken: src/email/email-layout.ts, default-email-templates.ts y email.service.ts: identidad visual resuelta al ejecutar, diseño común, contenido por tipo y envío separado. notifications/channels/email.channel.ts reutiliza el mismo diseño para avisos.
- backend-synctasks: src/email-branding.ts y módulos applications/emails/applicationReceivedEmail.email.ts, applications/notifications/applicationReceived.notification.ts y accountDeletion/emails/accountDeletion.email.service.ts: constructores de contenido por módulo, datos tipados, escape de texto y separación del canal.

Blue Care adapta este patrón a su arquitectura local. No copia la lógica de organizaciones, ni el negocio de vacantes, ni idiomas no implementados. Tampoco adopta las vigencias de Kraken (sus ejemplos usan otros plazos): las acciones actuales de Blue Care siguen teniendo 30 minutos, y una invitación muestra su expiresAt real en Guatemala.

## Organización

- src/shared/domain/email-sender.ts: contrato de transporte y EmailContent tipado (título, vista previa, párrafos, acción opcional y nota).
- src/infrastructure/email/email-layout.ts: documento HTML, tablas de presentación, estilos en línea, encabezado/pie, botón, enlace alternativo y versión de texto. No acepta fragmentos de HTML en valores dinámicos.
- src/modules/auth/infrastructure/emails/account-email.ts: contenido específico por acción; ya no usa el texto genérico de verificación de contacto en recuperación de contraseña.
- src/infrastructure/email/smtp-email-sender.ts: resuelve la identidad desde ConfigService después de cargar entorno/Secret Manager y renderiza antes de enviar. Un mensaje de texto del motor de notificaciones obtiene automáticamente el mismo diseño; su texto sigue intacto. Si hay FRONTEND_URL, incluye acceso a Blue Care sin añadir datos clínicos ni tokens de autenticación.

El transporte elimina content antes de pasar el sobre a Nodemailer y preserva to, subject, text y messageId. Si un constructor interno entrega html explícito, lo conserva sin aplicar dos diseños; ese HTML es un contrato de código confiable, no un campo admitido por endpoints públicos. Para contenido nuevo se recomienda EmailContent con valores escapados y constructor dentro de su módulo.

La bandeja y push no reciben HTML: solo el canal correo renderiza el diseño al entregar. No se guardan tokens de recuperación en el outbox ni se cambia el envío inmediato de las acciones de cuenta. Los avisos previamente persistidos que todavía no se hayan enviado también obtienen el diseño cuando el worker los entregue.

## Diseño y configuración

Encabezado Blue Care, tarjeta blanca sobre fondo claro, título, texto de acción, botón azul, enlace completo alternativo, nota de seguridad y pie. Tablas/estilos en línea evitan depender de CSS de la app, JavaScript o fuentes externas. Existe una vista previa oculta para la bandeja del cliente. El diseño funciona sin imágenes; un logo público es opcional.

Variables opcionales con valores predeterminados en .env.example:

```dotenv
EMAIL_APP_NAME=Blue Care
EMAIL_PRIMARY_COLOR="#1469b8"
EMAIL_LOGO_URL=
EMAIL_SUPPORT_EMAIL=
```

Las comillas del color son necesarias en .env: # sin comillas inicia un comentario. El color admite seis dígitos hex; nombre, contacto y URL se validan al iniciar. Las URLs solo admiten HTTP/HTTPS sin credenciales. Los nombres, párrafos, notas y atributos dinámicos se escapan. Ningún enlace inseguro se inserta como javascript/data.

EMAIL_FROM sigue controlando el nombre/dirección del remitente SMTP y es independiente del diseño. Su ejemplo ahora dice Blue Care; no se modificó el .env real del usuario. Logo y soporte vacíos omiten esos elementos, sin inventar un contacto. No alojar un logo en un objeto clínico privado ni incluir credenciales en su URL.

SMTP_HOST/PORT y SendGrid conservan su configuración. Mailpit existente usa localhost:1025 cuando la API corre en el host; si corre en otro contenedor se configura el hostname accesible desde ese contenedor. No requiere cambios de esquema, migraciones ni permisos nuevos. Al usar el código actualizado, solo los próximos envíos cambian: los mensajes ya recibidos en Mailpit no se reescriben.

## Revisión local sin enviar

Ejecutar `npm run emails:preview`. Genera HTML y texto en docs/email-previews con enlaces de ejemplo y tokens sin validez, sin cargar .env, conectarse a la base ni enviar mensajes:

- [Recuperación](email-previews/reset-password.html)
- [Activación](email-previews/activate-account.html)
- [Invitación](email-previews/invitation.html)
- [Cambio de correo](email-previews/confirm-email.html)
- [Notificación](email-previews/notification.html)

Las vistas son artefactos generados; el código fuente permanece en TypeScript. Para ver el resultado en Mailpit se debe solicitar un correo nuevo desde el flujo normal de la API actualizada; Mailpit mostrará ahora la parte HTML además de Text. No se envió un mensaje al usuario durante esta implementación.

## Verificación

Pruebas del constructor/layout: contenido por acción, vigencia real, zona Guatemala, enlaces con token, escape de nombres/atributos, rechazo de URLs inseguras, identidad opcional y MIME multipart/alternative real mediante Nodemailer en memoria. Pruebas SMTP verifican que el diseño llega al transporte con text y messageId intactos, sin filtrar content, tanto para cuentas como para avisos genéricos. Validación de configuración cubre color, URL, nombre y soporte.

Se revisó visualmente recuperación en Chromium a 920 y 390 píxeles; la vista móvil no tiene desbordamiento horizontal. Esto no equivale a una certificación visual con cada versión de Outlook/Gmail/Apple Mail. No se usaron SMTP real, SendGrid ni credenciales de los proyectos de referencia.

Verificación final: 270 pruebas unitarias (58 suites) y 92 de integración (9 suites) aprobadas; build, tipos, lint sin advertencias y formato correctos. Cobertura de casos de uso/controladores: 100% líneas/sentencias/funciones y 82.57% ramas. Sin envíos reales ni modificaciones de bases/credenciales o repositorios de referencia.
