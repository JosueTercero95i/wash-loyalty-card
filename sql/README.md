# Tarjeta sincronizada con Reportes

La consulta pública `get_public_loyalty_card` debe usar los mismos tickets pagados de autolavado que Reportes. El frontend no consulta tablas directamente.

## Aplicación

El proyecto configurado en Wash-Card y en el POS local es `dwbfmphghmquxigmczcc`.

1. En una instalación existente, ejecutar `supabase/migrations/20261025164213_public_loyalty_from_report_tickets.sql` en el SQL Editor de **ese proyecto**, usando una cuenta autorizada. El archivo contiene una transacción y reemplaza solamente la función pública existente.
2. Para una instalación nueva, primero ejecutar `sql/migration_public_loyalty_rpc.sql` sobre el esquema del POS; después aplicar la migración nueva. No volver a ejecutar la versión antigua después de la nueva.
3. Publicar el frontend generado por `npm run build` en el sitio de la tarjeta.
4. Verificar con una consulta autorizada del cliente que los totales por programa coincidan con sus tickets pagados de Reportes. La verificación de borrados debe hacerse con tickets de prueba en un entorno de pruebas.

La cuenta del conector disponible durante esta implementación no tenía permiso sobre ese proyecto. No se aplicó la migración a producción ni se publicó el frontend. Las pruebas SQL se ejecutan en PostgreSQL embebido con datos ficticios.

## Reglas

- Solo tickets `paid` de `car_wash` del cliente encontrado mediante la búsqueda existente.
- Una visita por ticket y programa; se excluyen productos y extras. Premium y Nítido son independientes; Breve no avanza esos programas.
- La clasificación replica `src/lib/customerVisitCategories.ts` del POS: nombre normalizado del catálogo, o un nombre de lavado válido del snapshot cuando falta el servicio.
- Los totales, ciclos e historial moderno se calculan desde los tickets. No dependen de `loyalty_progress` ni de que exista `loyalty_wash_log`. Los cinco lavados recientes son solo un límite de presentación.
- La última visita usa la fecha del último ticket pagado, expresada en America/Managua.
- El historial legacy conserva sus incrementos históricos por servicio, pero solo incluye registros vinculados a tickets pagados existentes del cliente. Los canjes consumidos se conservan como auditoría.
- Las recompensas mostradas deben estar disponibles, no vencidas, respaldadas por un ticket elegible y por el número de hitos alcanzados. Las opciones de una misma elección cuentan como un beneficio. La consulta no emite premios retroactivos ni modifica canjes.
- `remaining` conserva su significado: lavados para completar el ciclo. `remainingForReward` es la distancia al próximo premio. La tarjeta calcula esa distancia también para ser compatible con la versión anterior del RPC.
- La tarjeta vuelve a consultar cada 60 segundos mientras está visible y al recuperar el foco si los datos tienen más de un minuto. Si falla una actualización, indica que muestra la última consulta. No requiere abrir las tablas a usuarios anónimos ni habilitar Realtime.

## Alcance y validación

Esta migración corrige la lectura de la **tarjeta pública**. El POS local ya reconstruye visitas desde los tickets; sus escrituras, procesos de emisión/canje y contadores persistidos no se modifican aquí. No se afirma que esta consulta repare esos contadores ni que cambie pantallas del POS ya abiertas.

`npm test` ejecuta el SQL real en PGlite, además de renderizar la tarjeta para comprobar el mensaje del premio. Cubre tickets eliminados/cancelados, cambio de cliente o servicio, duplicados/extras/productos, ciclos, recompensas, historial legacy, aislamiento de clientes, acceso anónimo y más de 1.000 tickets. `npm run build` valida TypeScript y genera el frontend.
