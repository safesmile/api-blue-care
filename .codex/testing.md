# Normas de formato y pruebas

## ESLint y Prettier

Referencia: backend-synctasks/.eslintrc.js (base GTS, JSDoc, spellcheck e importaciones sin uso). Las reglas se trasladaron a eslint.config.mjs para ESLint 9 con plugins actuales. No se usa la versión antigua de GTS, que arrastra otro parser y ESLint 8. Las reglas retiradas se sustituyeron por las equivalentes vigentes; node/* se expresa como n/*.

Comillas dobles, punto y coma, dos espacios, sin tabuladores ni comas finales, arrowParens avoid, bracketSameLine true. Prettier y ESLint comparten ancho de 120 columnas: la referencia tenía printWidth 10000 en Prettier y 120 en ESLint, una contradicción que aquí se resuelve. quotes permite avoidEscape exclusivamente para no entrar en conflicto con Prettier cuando una cadena contiene comillas dobles, como SQL con identificadores PostgreSQL.

No console.log: usar Logger de Nest en servidor; info/warn/error/debug en herramientas. Mantener JSDoc con descripción, parámetros y retorno cuando proceda, especialmente clases y métodos. No dejar importaciones o variables sin uso. Comparación estricta, const en lugar de var, sin espacios al final. Saltos de línea según el sistema, como la referencia. Prohibidos describe.only e it.only. No desactivar reglas globalmente para ocultar errores; las pruebas usan las mismas normas de código.

## Organización

Se usa src/test siguiendo el patrón de Kraken:

- src/test/modules/auth/auth.usecase.spec.ts y auth.controller.spec.ts.
- src/test/modules/auth/account-actions.usecase.spec.ts y account-actions.controller.spec.ts.
- src/test/modules/identity/users.usecase.spec.ts y users.controller.spec.ts.
- src/test/app.controller.spec.ts para liveness.
- src/test/infrastructure/config/environment.spec.ts para configuración.
- src/test/helpers para fixtures y utilidades compartidas, sin lógica de negocio.
- src/test/integration/*.e2e-spec.ts para pruebas con PostgreSQL real desechable.

Cada nuevo caso de uso y controlador debe tener su propio archivo de pruebas con el mismo nombre base, bajo su módulo. No colocar specs junto al código productivo. src/test se excluye de compilación para producción, pero se comprueba con test:typecheck.

Casos de uso: probar resultados y efectos observables, éxito, ausencia, conflictos, estados deshabilitados, expiración/consumo y fallos de dependencias cuando apliquen. Usar puertos tipados y dependencias aisladas; no acceder a servicios externos reales.

Controladores: probar cada ruta, método HTTP, estado, validación y rechazo de propiedades extra, conversión de parámetros, envío al caso de uso y propagación de errores. Usar una aplicación Nest aislada con casos de uso sustituidos; los guardias reales y permisos se verifican en la integración completa. La lectura de me se prueba directamente con el usuario del guard y también por HTTP en integración.

La suite de cobertura incluye todos los casos de uso concretos y controladores, incluso los nuevos. Umbrales: 100% líneas, sentencias y funciones; 80% ramas (la instrumentación incluye condiciones generadas por los decoradores de TypeScript). No reducir los umbrales ni excluir clases para introducir código sin pruebas.

Comandos de validación: npm run lint:check, npm run format:check, npm run test:typecheck, npm run build, npm run test:cov -- --runInBand, npm run test:integration. Integración crea su propio PostgreSQL con Docker, aplica migraciones, reemplaza el correo y elimina el contenedor; nunca utiliza la base del usuario.

Los scripts interactivos se prueban con entradas simuladas bajo src/test/scripts y con su función de provisión en PostgreSQL desechable. Nunca ejecutar el asistente sobre la base real para verificarlo. Comprobar que las migraciones de autorización no siembran roles/permisos, que la sincronización es repetible y que el superusuario queda verificado con el rol superadmin sin sobrescribir cuentas.

Scripts y base de datos: test:typecheck también incluye scripts/**/*.ts y database/**/*.ts. Las migraciones, seeders y configuración usan .ts y las mismas reglas TypeScript de lint/formato. Las pruebas database-tools.e2e-spec.ts verifican en una base temporal independiente el cambio de nombres históricos .cjs, la preservación de usuarios, reversión, reconstrucción y seeders, además de conflictos de historial.

Identidad y roles: las pruebas cubren políticas de propiedad sin depender de nombres de roles, delegación limitada a grants propios, roles del sistema protegidos, roles personalizados en activación/invitaciones y sesiones abiertas, rechazo de entradas name/null y preservación de credenciales al editar perfiles. authorization.e2e-spec.ts usa PostgreSQL desechable y transporte de correo simulado. Los helpers de pruebas deben pasar un actor explícito a UsersUseCase; no introducir bypass de autorización para las pruebas.

Auditoría: audit.e2e-spec.ts verifica en PostgreSQL temporal el rollback cuando falla el historial o el outbox, persistencia de registros tras bajas, triggers append-only, permisos explícitos, correlación, sanitización y entrega desde worker sin SMTP real. No deshabilitar la auditoría para sortear fallos; un fallo de persistencia revierte la mutación original.

Pacientes/clínicas: patients-clinics.e2e-spec.ts cubre scopes de clínicas, revocación en sesiones abiertas, propietario de paciente, perfiles, invitación vinculada con alcance revalidado, un solo vínculo por cuenta incluso concurrente, contacto verificado propagado, desactivación, correcciones de asociaciones y atomicidad de auditoría. Usar siempre PostgreSQL efímero y correo sustituido.

Planes/membresías: specs de dominio/casos de uso/controladores y plans-memberships.e2e-spec.ts cubren versiones, contratos concurrentes, precio conservado, publicación de textos, períodos, firmas Svix originales, comprobación del proveedor sustituida, eventos/pagos duplicados, pausa/cancelación y fallos de auditoría/email outbox. Las cuentas extra de fixtures pasan por los casos de uso reales de activación/login para no agotar los límites HTTP públicos; no se deshabilitan guards ni se actualiza verified por SQL. Nunca usar claves LIVE o enviar cargos reales al validar este módulo.

Paso 6: specs separados de ambos casos de uso y tres controladores de benefits, calendario y fecha familiar. Integración PostgreSQL desechable prueba 12 solicitudes concurrentes entre sedes, publicación/consumo simultáneos, idempotencia/referencia de servicio, reversión, presentación limitada por token, familia y rollback de auditoría/aviso. Reloj inyectado mediante spy solo en pruebas, sin configuración de bypass productiva. No usar SMTP, Recurrente o base reales.

Verificación final del paso 6: 245 pruebas unitarias (47 suites) y 82 de integración (8 suites) aprobadas; cobertura de casos de uso/controladores 100% líneas, sentencias y funciones, 82.4% ramas. Build, tipos, lint sin advertencias y formato aprobados. PostgreSQL temporal detenido al terminar; sin migraciones sobre la base del usuario ni servicios externos reales.

Paso 7: prevention-dashboard.e2e-spec.ts comprueba alcance de paciente/clínica, prevención sin membresía, versiones concurrentes, próximo evento único, recordatorios concurrentes, cancelación/reprogramación/expiración, rollback con fallo de auditoría, outbox de tres canales, tokens protegidos y leases de push, métricas concordantes. Transporte FCM y SMTP sustituidos; nunca usar Firebase/credenciales reales. Specs separados para los nuevos casos de uso/controladores y adaptador FCM; fechas con zona y calendario Guatemala.

Verificación final del paso 7 (04/11/2026): 261 pruebas unitarias en 57 suites y 92 pruebas de integración en 9 suites aprobadas. Cobertura de casos de uso/controladores: 100% líneas/sentencias/funciones y 82.57% ramas. Compilación, tipos, lint sin advertencias y formato aprobados. PostgreSQL de pruebas desechable detenido al terminar; correo y FCM sustituidos, sin tocar la base del usuario ni servicios reales.

Correos HTML: email-layout.spec.ts comprueba escape, URLs, contenido específico y multipart MIME real con transporte en memoria; smtp-account-mailer/email-sender verifican render final y preservación de texto/messageId. No enviar a SMTP real para estas pruebas. Las vistas de docs/email-previews se generan con emails:preview y datos ficticios. QA visual de recuperación en Chromium desktop/móvil, sin afirmar cobertura visual de todos los clientes de correo.

Verificación final: 270 pruebas unitarias (58 suites) y 92 de integración (9 suites) aprobadas; build, tipos, lint sin advertencias y formato correctos. Cobertura de casos de uso/controladores: 100% líneas/sentencias/funciones y 82.57% ramas. Sin envíos reales ni modificaciones de bases/credenciales o repositorios de referencia.
