# Pulso CRM

CRM independiente de seguimiento comercial, visual y adaptable por configuración. Pulso administra sus propios datos, usuarios, reglas y comunicaciones; no depende de Zoho ni contempla integrarlo en el alcance actual. Node.js 24+, sin dependencias externas.

## Ejecutar

```sh
npm start
```

Abrir http://127.0.0.1:4310. Pruebas: `npm test`.

## Funcionalidad incluida (v0.2)

- Agenda de vencidos, próximas 24 horas, programados y sin próxima acción; búsqueda por nombre, empresa y ejecutivo.
- Creación de leads, prevención de duplicados por correo/teléfono y registro de gestiones con historial.
- Validaciones en servidor: datos básicos, medio de contacto adecuado al canal, próximo paso y fecha futura para leads abiertos.
- Plantillas de correo editables con variables y vista previa; no envían mensajes.
- Automatizaciones activables: primer contacto con SLA y escalamiento visual periódico por vencimiento.
- Configuración de negocio, sector, SLA y campos adicionales obligatorios.
- Preparación de proveedor/cuenta para correo, WhatsApp, SMS, RCS y telefonía. No hay conectores activos aún.
- Inicio de sesión, invitaciones de un solo uso, equipos y roles de administrador, supervisor y ejecutivo.
- Acceso a leads controlado en servidor por usuario/equipo, reasignación con motivo y auditoría administrativa.
- Cambio de contraseña, sesiones revocables y desactivación con protección de leads asignados.
- Persistencia SQLite en `data/crm.sqlite`, excluida de Git.

## Alcance de esta iteración

Aplicación local de un solo espacio con autenticación y roles; escucha exclusivamente en loopback. En la primera apertura, crea tu cuenta de administrador; después usa **Equipo** para organizar personas e invitarlas. No hay credenciales predeterminadas. Los registros previos se conservan y pasan al administrador para reasignación. Consulta [Usuarios y permisos](docs/usuarios-y-permisos.md).

Los enlaces de invitación funcionan en este mismo equipo, sin envío de correo. Para acceso remoto quedan pendientes despliegue HTTPS, recuperación de acceso y copias de seguridad operativas. No es multiempresa. Las automatizaciones necesitan el proceso encendido.

Próximas iteraciones: conexiones directas con proveedores de correo, WhatsApp, SMS, RCS y telefonía; envíos con consentimiento e idempotencia; constructor de automatizaciones. Pulso es la fuente principal de datos y ejecuta las reglas de seguimiento.

## Control de cambios

Repositorio: https://github.com/misteryshopperonline-code/crm

Una rama `codex/` por funcionalidad; pruebas de las invariantes de negocio y pull request antes de integrar. No versionar datos reales ni credenciales.
