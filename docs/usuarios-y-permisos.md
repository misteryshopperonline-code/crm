# Iteración 2: usuarios, equipos y permisos

## Primera apertura

1. Ejecutar `npm start` y abrir http://127.0.0.1:4310.
2. Crear el primer administrador con nombre, correo y contraseña de 12 a 128 caracteres. No hay credenciales predeterminadas.
3. En **Equipo**, crear equipos e invitar personas, indicando correo, rol y equipo.
4. Compartir manualmente el enlace de activación; no se envía correo. Dura 48 horas y se consume una sola vez. Cada usuario establece su propia contraseña.
5. Los usuarios activos aparecen en el selector de responsable de los leads. **Reasignar** requiere motivo y registra al autor en el historial.

Esta versión sigue siendo local. Los enlaces de invitación solo funcionan en el equipo que ejecuta Pulso. El acceso desde otras computadoras requiere despliegue con HTTPS en una iteración posterior.

## Matriz de permisos

| Acción | Ejecutivo | Supervisor | Administrador |
|---|---|---|---|
| Ver y gestionar leads | Propios | De su equipo | Todos |
| Crear lead | A su cargo | A usuarios activos de su equipo | A cualquier usuario activo |
| Reasignar | No | Dentro de su equipo | Todo el espacio |
| Historial | De leads visibles | De leads visibles | Todos |
| Ver plantillas | Sí | Sí | Sí |
| Editar plantillas compartidas | No | Sí | Sí |
| Personas y carga de trabajo | Solo su propia información | Su equipo | Todos |
| Crear/editar equipos y usuarios | No | No | Sí |
| Ajustar reglas, negocio y canales | No | No | Sí |
| Cambiar su contraseña | Sí | Sí | Sí |
| Auditoría administrativa | No | No | Sí |

El servidor aplica cada restricción y filtra las respuestas. Ocultar controles en la interfaz solo facilita su uso; no es el mecanismo de autorización.

## Conservación de datos

- Antes de migrar una base anterior se crea `data/crm.before-auth.sqlite`, si no existe.
- La configuración y el historial existentes se conservan. Al crear al administrador, los leads sin ID de usuario pasan a su cargo; el responsable anterior queda en `legacyOwner`.
- No se crean cuentas a partir de nombres de responsables anteriores. El administrador revisa y reasigna esos registros.
- El cambio de equipo o la desactivación se bloquean si el usuario conserva leads, incluidos los cerrados. Primero se reasignan.
- No se permite quitarse el propio acceso de administrador. Cambios de rol, equipo, correo o desactivación invalidan las sesiones del usuario. Cambios sensibles de una cuenta pendiente invalidan también su invitación anterior; puede renovarse.
- Una reasignación conserva próxima actividad e intentos: no cuenta como una gestión comercial.

## Implementación

Contraseñas con scrypt y sal aleatoria; nunca se devuelven hashes en la API. Sesiones opacas de 12 horas persistidas como hash en SQLite, cookie HttpOnly y SameSite=Strict. Cierre de sesión revoca esa sesión; cambio de contraseña revoca las anteriores y genera una nueva. Invitaciones aleatorias de 256 bits con hash, vencimiento y consumo atómico. Los enlaces usan fragmento para que el código no viaje en la URL HTTP ni en referencias.

Validación estricta de Host/Origin, JSON obligatorio y límite de cuerpo para solicitudes que escriben datos. Límite persistente de intentos de autenticación: 10 por ruta/IP y por cuenta de inicio de sesión en 15 minutos; cambio de contraseña limitado por usuario. Guardado transaccional del estado y auditoría. Preparación inicial revalidada dentro de la transacción para evitar dos administradores de arranque concurrentes.

## Verificación y alcance

`npm test` ejecuta reglas de negocio y pruebas HTTP en una base temporal: acceso anónimo, CSRF, migración, invitaciones, aislamiento por usuario/equipo, denegación de acciones, reasignación, desactivación, revocación de sesiones, contraseñas, vencimientos y límite de intentos.

Un espacio de negocio por instancia. No hay aislamiento multiempresa, recuperación de contraseña por correo, MFA, acceso remoto ni proveedores de comunicaciones conectados. Cookie sin Secure exclusivamente porque el servidor está limitado a HTTP loopback; el despliegue remoto deberá incorporar HTTPS, cookie Secure y configuración de origen confiable. No guardar claves de proveedores en los campos actuales de referencia de canales.
