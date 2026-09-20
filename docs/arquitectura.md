# Arquitectura de Pulso v0.3

## Objetivo

Migrar el CRM a Next.js conservando el comportamiento y los datos de v0.2. El framework y la base de datos son adaptadores; las reglas de negocio no dependen de ellos.

## Capas y dirección de dependencias

1. **Dominio**: entidades tipadas, reglas del siguiente compromiso, duplicados y políticas de visibilidad/asignación. Solo usa TypeScript y funciones del lenguaje.
2. **Aplicación**: `AuthService`, `LeadService`, `TeamService`, `ConfigurationService` y `QueryService` coordinan casos de uso. Reciben `Repository`, `Security`, reloj e identificadores mediante inyección de dependencias.
3. **Infraestructura**: `SqliteRepository` implementa persistencia; `nodeSecurity` implementa hashes de contraseña y tokens. `container.ts` construye los servicios en el servidor y mantiene una instancia por proceso.
4. **HTTP**: valida Host/Origin, tamaño del cuerpo y JSON; traduce errores de aplicación a códigos HTTP y administra cookies. Los casos de uso no reciben objetos Request/Response.
5. **Presentación**: componentes React por funcionalidad, formularios accesibles, navegación con Next Link y proveedor de estado con tratamiento de sesión caducada. Los componentes no consultan SQLite ni contienen SQL.
6. **Next App Router**: rutas de páginas, layout, metadata, manejo de errores y route handler. Son puntos de entrada pequeños.

ESLint impide importar Next.js, React o infraestructura desde dominio/aplicación. Las pruebas con un repositorio en memoria comprueban que un caso de uso funciona sin framework ni base de datos.

## Persistencia y migración

Se conserva el esquema SQLite existente: JSON del CRM en `state`, tablas `users`, `teams`, `sessions`, `auth_attempts` y `audit`. No se renombran cuentas ni se vuelven a generar contraseñas o sesiones.

Antes de usar una base existente se crea una copia consistente mediante `VACUUM INTO`: `crm.before-nextjs.sqlite` para v0.2; `crm.before-auth.sqlite` para bases anteriores sin usuarios. Las copias son privadas y no se incluyen en Git ni en el empaquetado del servidor.

Cada transacción usa `BEGIN IMMEDIATE`, carga una vista actualizada, aplica el caso de uso y persiste solo las filas modificadas/eliminadas. Si una validación o escritura falla, se revierte la transacción completa. Las lecturas usan una transacción consistente. Ningún trabajo asíncrono se ejecuta dentro de una transacción: los hashes se calculan antes y las condiciones de la cuenta se comprueban nuevamente al guardar.

El agregado se carga completo para mantener compatibilidad con el esquema del prototipo. Para volúmenes grandes convendrá normalizar leads/actividades y añadir consultas paginadas, detrás del puerto de persistencia. Este cambio no se mezcla con la migración de framework.

## Autenticación y permisos

Se conservan scrypt, cookies HttpOnly/SameSite=Strict, vencimiento de 12 horas, tokens de invitación de un solo uso y hash, límites de intentos persistidos, revocación de sesiones y permisos en servidor. En esta instancia local, el límite de acceso es por operación local y por cuenta; no se confía en IPs declaradas por cabeceras externas.

La política CSP usa nonces por petición para permitir los scripts de hidratación de Next.js sin habilitar scripts inline arbitrarios. Las páginas se renderizan dinámicamente para recibir el nonce. En desarrollo se permite `unsafe-eval` para las herramientas del framework; en producción no. La API nunca se almacena en caché y solo devuelve usuarios/actividades dentro del alcance autorizado.

## Automatizaciones

`instrumentation.ts` arranca un temporizador por proceso Node de larga duración. La misma actualización se calcula al solicitar el tablero, de modo que una pausa o reinicio no oculta actividades vencidas. Esta ejecución está pensada para un servidor persistente local, no para funciones serverless. Un despliegue serverless requeriría un programador de tareas externo.

## Versiones y herramientas

- Next.js 16.3.5, etiqueta npm `latest` comprobada el 15-09-2026.
- React y React DOM 19.3.0.
- TypeScript 6.0.3, modo estricto; compatible con ESLint de Next.js.
- Node.js 24: necesario para la API nativa `node:sqlite` utilizada por el adaptador.
- Prettier para formato, ESLint para calidad/límites entre capas, pruebas unitarias y pruebas HTTP sobre compilación de producción.

Documentación consultada: [instalación oficial](https://nextjs.org/docs/app/getting-started/installation), guías de Route Handlers y CSP incluidas en `next@16.3.5/dist/docs`.
