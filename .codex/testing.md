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
