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

## Notificaciones y prioridad de seguimiento

La cabecera muestra alertas internas para los leads visibles según el rol. Desde una alerta se abre el formulario de gestión; las alertas se recalculan al guardar y durante la actualización de la vista (cada minuto mientras está visible y no se está editando). No son mensajes por correo ni notificaciones del sistema operativo. No hay estado de lectura: permanecen hasta resolver su causa.

La agenda permite separar pendientes de fin de semana, leads sin primera gestión y leads ya gestionados. El fin de semana usa sábado y domingo según `America/Guayaquil`, con la fecha de creación registrada; no desaparece al llegar el lunes. Una gestión registrada, o el estado Contactado/Calificado/Propuesta, identifica continuidad de seguimiento; un intento no prueba que el cliente haya respondido.

La prioridad suma: 50 por compromiso vencido o próximo paso ausente; 30 por fin de semana sin gestión; 20 por acción en menos de 24 horas; 20 por espera de al menos 48 horas desde la creación o última gestión; 15 por estado Calificado/Propuesta; 5 por disponer de correo y teléfono. Alta desde 50, media desde 20, normal por debajo. Los cerrados no generan alertas. La puntuación ordena la lista y muestra sus motivos al consultar las notificaciones o el indicador de prioridad.

Esta versión usa campos existentes y reglas fijas visibles en la agenda. No infiere presupuesto, intención de compra ni calidad personal. Quedan pendientes reglas editables por negocio y calendario configurable.

## Contacto efectivo y calendario laboral

Al guardar una gestión se exige un resultado estructurado: Sin respuesta, Contacto efectivo, Respuesta recibida, Datos de contacto incorrectos u Otra gestión. Solo Contacto efectivo y Respuesta recibida registran `firstContactAt` y `lastContactAt`. La primera fecha se conserva en las siguientes gestiones; el resultado queda en el historial. Las notas históricas y el estado comercial no se interpretan como prueba de contacto: los registros anteriores aparecen sin contacto confirmado hasta registrar uno explícitamente.

En Configuración se puede activar el cálculo en horas hábiles, seleccionar zona horaria IANA, días laborables, apertura/cierre en horas enteras y feriados por fecha. Se admite una jornada continua, sin turnos nocturnos ni pausas intermedias. Por compatibilidad, el calendario comienza desactivado; mientras tanto se usan horas transcurridas. El horario sugerido es lunes a viernes, 09:00–18:00, America/Guayaquil.

Los nuevos leads conservan `firstContactDue`, calculado al crearse. Cambiar el calendario no altera ese límite ni los compromisos existentes. Las fechas sugeridas de nuevas gestiones usan el calendario vigente. El vencimiento de un compromiso explícito sigue respetando su fecha exacta. El límite de primer contacto vencido añade 50 puntos mientras no exista contacto efectivo. Las esperas de 48 horas de prioridad pasan a horas hábiles cuando se activa el calendario y se cuentan desde la creación o el último contacto efectivo. Las prioridades usan la hora del servidor.

Estas reglas sustituyen la clasificación anterior basada en intentos/estado comercial y el calendario fijo. Los leads históricos sin límite inicial conservan las alertas de antigüedad y próxima acción, sin inventar un SLA retroactivo.
