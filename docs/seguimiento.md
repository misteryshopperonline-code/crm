# Seguimiento en Pulso CRM

## Arquitectura de producto

Pulso es un CRM totalmente independiente. Administra sus propios leads, actividades, usuarios, plantillas, validaciones y automatizaciones. Las comunicaciones se conectarán directamente a sus proveedores mediante adaptadores por canal. No requiere cuenta, licencia, API ni sincronización con Zoho.

## Regla de negocio

Todo lead abierto tiene responsable, próxima acción y fecha. Registrar una gestión exige resultado y siguiente compromiso; Ganado y No viable permiten cerrar sin actividad futura. Estado comercial y escalamiento operativo son conceptos separados.

## Campos actuales

| Campo           | Uso                                                          |
| --------------- | ------------------------------------------------------------ |
| name / company  | Contacto y empresa                                           |
| owner           | Nombre del responsable; `ownerId` referencia al usuario real |
| email / phone   | Medios de contacto                                           |
| stage           | Estado comercial                                             |
| channel         | Canal preferido                                              |
| action / due    | Próxima acción y fecha                                       |
| last / attempts | Última gestión y contador                                    |
| escalation      | Nivel de escalamiento operativo                              |
| history         | Resultado, responsable y fecha de cada gestión               |

## Reglas implementadas

1. Alta: asignar responsable y primer contacto en SLA configurable (por defecto 24 horas transcurridas).
2. Gestión: validar resultado y siguiente acción antes de guardar; actualizar el compromiso y añadir historial en una sola operación local.
3. Vencimiento: nivel 1 al superar la fecha; nivel 2 tras otras 24 horas. Solo alerta visual en esta versión.
4. Cierre: retirar el lead de la cola activa. Una reapertura exige próximo compromiso.
5. Calidad: validar datos en servidor, evitar duplicados y exigir los campos adicionales configurados.

## Siguientes funcionalidades

1. Implementado en v0.2: usuarios, equipos y permisos propios; acceso de ejecutivo, supervisor y administrador. Ver [Usuarios y permisos](usuarios-y-permisos.md).
2. Conexión directa con el primer proveedor de comunicaciones, autenticación segura y recepción de eventos verificados.
3. Bandeja de conversaciones vinculada a leads y actividades.
4. Constructor de automatizaciones con condiciones, acciones, reintentos y registro de ejecución.
5. Configuración de etapas, campos y reglas por negocio.

Cada integración debe conservar identificadores externos, evitar envíos duplicados y mostrar su estado real. Actualmente los canales solo guardan referencias de configuración y no envían ni reciben mensajes.
