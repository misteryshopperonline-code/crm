# Pulso CRM

Primera iteración de un CRM visual de seguimiento comercial, adaptable por configuración. Node.js 24+, sin dependencias externas.

## Ejecutar

```sh
npm start
```

Abrir http://127.0.0.1:4310. Pruebas: `npm test`.

## Funcionalidad incluida

- Agenda de vencidos, próximas 24 horas, programados y sin próxima acción; búsqueda por nombre, empresa y ejecutivo.
- Creación de leads, prevención de duplicados por correo/teléfono y registro de gestiones con historial.
- Validaciones en servidor: datos básicos, medio de contacto adecuado al canal, próximo paso y fecha futura para leads abiertos.
- Plantillas de correo editables con variables y vista previa; no envían mensajes.
- Automatizaciones activables: primer contacto con SLA y escalamiento visual periódico por vencimiento.
- Configuración de negocio, sector, SLA y campos adicionales obligatorios.
- Preparación de proveedor/cuenta para correo, WhatsApp, SMS, RCS y telefonía. No hay conectores activos aún.
- Persistencia SQLite en `data/crm.sqlite`, excluida de Git.

## Alcance de esta iteración

Aplicación local de un solo espacio, sin autenticación ni roles; escucha exclusivamente en loopback. No desplegar como aplicación multiusuario hasta añadir autenticación, autorización, aislamiento entre negocios, migraciones, copias de seguridad y gestión segura de secretos. Los responsables son texto libre en esta iteración. Las automatizaciones necesitan el proceso encendido. No existe sincronización con Zoho todavía.

La siguiente iteración debe definir si Zoho será la fuente principal de datos o un conector opcional. Después: identidad/equipo, primer canal con OAuth y webhooks verificados, envíos con consentimiento e idempotencia, y constructor de workflows.

## Control de cambios

Repositorio: https://github.com/misteryshopperonline-code/crm

Una rama `codex/` por funcionalidad; pruebas de las invariantes de negocio y pull request antes de integrar. No versionar datos reales ni credenciales.
