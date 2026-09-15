# Seguimiento y futura integración Zoho

## Regla de negocio

Todo lead abierto tiene responsable, próxima acción y fecha. Registrar una gestión exige resultado y siguiente compromiso; Ganado y No viable permiten cerrar sin actividad futura. Estado comercial y escalamiento operativo son conceptos separados.

## Mapeo propuesto (los nombres API deben verificarse en la cuenta)

| Pulso | Zoho propuesto | Tipo |
|---|---|---|
| name | Last_Name / First_Name | Texto |
| company | Company | Texto |
| owner | Owner | Referencia a usuario (resolver ID) |
| email / phone | Email / Phone | Correo / teléfono |
| stage | Lead_Status | Lista configurable |
| action | Proxima_Accion | Texto |
| due | Fecha_Proxima_Accion | Fecha/hora |
| last | Fecha_Ultima_Gestion | Fecha/hora |
| attempts | Intentos_Contacto | Entero |
| escalation | Nivel_Escalamiento | Entero |
| history.text | Resultado_Ultima_Gestion y actividad relacionada | Texto |

## Reglas

1. Alta: asignar responsable y primer contacto en SLA configurable (por defecto 24 horas transcurridas).
2. Gestión: validar resultado y siguiente acción antes de guardar; actualizar el compromiso y añadir historial en una sola operación local.
3. Vencimiento: nivel 1 al superar la fecha; nivel 2 tras otras 24 horas. Solo alerta visual en esta versión.
4. Cierre: retirar el lead de la cola activa. Una reapertura exige próximo compromiso.
5. Integración futura: ID externo único, cursor de sincronización, fechas UTC, resolución de conflictos, reintentos e idempotencia. No activar workflows simultáneos en ambos sistemas sin definir cuál controla cada regla.

## Guías oficiales consultadas

- [Configurar workflows](https://help.zoho.com/portal/en/kb/crm/automate-business-processes/workflows/articles/configuring-workflow-rules): acciones condicionadas y programadas.
- [API v8: configurar workflow](https://www.zoho.com/crm/developer/docs/api/v8/config-workflow.html): las tareas automáticas requieren configuración previa.
- [Validaciones mediante funciones](https://help.zoho.com/portal/en/kb/crm/customize-crm-account/validation-rules/articles/create-validation-rules-using-functions): reglas complejas sobre valores API.

Este documento es un diseño de mapeo, no una configuración aplicada a una cuenta Zoho. La edición, permisos, dominio regional, campos y disponibilidad deben verificarse antes de conectar.
