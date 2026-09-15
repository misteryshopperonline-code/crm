# Pulso CRM

CRM independiente de seguimiento comercial. Next.js **16.3.5** (última versión estable verificada en npm el 15 de septiembre de 2026), App Router, React **19.3.0** y TypeScript estricto.

## Ejecutar

Requiere Node.js 24 y npm. La base local se conserva en `data/crm.sqlite`.

```sh
npm ci
npm run dev
```

Abrir http://127.0.0.1:4310. Para usar la compilación de producción:

```sh
npm run build
npm start
```

Al abrir un espacio nuevo, crea el administrador; no hay credenciales predeterminadas. En **Equipo** se organizan personas, roles e invitaciones. Si ya usabas v0.2, tus usuarios, contraseñas, sesiones y leads se conservan. Antes de abrir la base existente con Next.js se genera `data/crm.before-nextjs.sqlite`.

## Funcionalidades

- Agenda de vencidos, próximas 24 horas, programados y sin próximo paso; búsqueda de leads.
- Creación, gestión e historial; próximo compromiso obligatorio y prevención de duplicados.
- Usuarios, equipos, roles de administrador/supervisor/ejecutivo y filtrado en servidor.
- Invitaciones de un solo uso, cambio de contraseña y sesiones revocables.
- Reasignación con motivo y auditoría administrativa.
- Plantillas de correo con variables y vista previa.
- Primera gestión automática y escalamiento por vencimiento mientras el servidor permanece encendido.
- Configuración de negocio, SLA, campos obligatorios y referencias de proveedores de comunicaciones.

## Arquitectura

```text
src/
  domain/           Entidades, validaciones y políticas de acceso
  application/      Casos de uso y puertos de persistencia/seguridad
  infrastructure/   SQLite, criptografía y composición de dependencias
  interfaces/http/  Adaptador HTTP, cookies y traducción de errores
  presentation/     Componentes React, formularios y estado de interfaz
  app/              Rutas y layouts de Next.js
```

El dominio y los casos de uso no importan Next.js, React ni SQLite. Las dependencias se inyectan mediante interfaces. La API conserva las rutas `/api/*` anteriores y la interfaz se divide en páginas de App Router; no existe un servidor HTTP paralelo ni HTML generado por concatenación.

- [Arquitectura y decisiones](docs/arquitectura.md)
- [Usuarios y permisos](docs/usuarios-y-permisos.md)
- [Seguimiento](docs/seguimiento.md)

## Verificación

```sh
npm run lint
npm run typecheck
npm run format:check
npm test
npm run build
npm run test:integration
```

Las pruebas HTTP arrancan Next.js de producción en un puerto temporal con una base aislada. Las pruebas unitarias validan el dominio, los casos de uso con un repositorio en memoria y la compatibilidad transaccional de SQLite. GitHub Actions ejecuta los controles en cada cambio.

TypeScript 6.0.3 se fija por compatibilidad con el analizador oficial de Next.js; TypeScript 7 todavía no es compatible con typescript-eslint de esta versión. Next.js se mantiene en la última versión estable, sin usar canary.

## Alcance

Un negocio por instancia y acceso local. Los canales todavía no envían ni reciben mensajes. Las invitaciones se comparten manualmente y funcionan en el equipo donde se ejecuta Pulso. El acceso remoto, HTTPS, recuperación de contraseña por correo, MFA e integraciones externas quedan para siguientes iteraciones.

`DATA_DIR` permite indicar otra carpeta de persistencia. `PORT` debe coincidir con el puerto del servidor si se inicia con parámetros distintos; Host y Origin se validan contra localhost/127.0.0.1. No cambiar a una interfaz pública sin implementar la configuración de despliegue correspondiente.

## Control de cambios

[Repositorio en GitHub](https://github.com/misteryshopperonline-code/crm). Una rama `codex/` y un PR por iteración. Datos, copias de seguridad, secretos y artefactos de compilación quedan excluidos de Git y del trazado de despliegue.
