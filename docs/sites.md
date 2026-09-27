# Preparación para ChatGPT Sites

La web se compila en `dist/`. Las peticiones del mismo origen a `/api/*` entran por
`functions/api/[[path]].ts` y usan la base D1 enlazada como `DB`. El esquema está en
`migrations/0001_initial.sql`. `.openai/hosting.json` declara el nombre del enlace D1;
Sites añadirá el identificador del proyecto cuando lo aprovisione. El logo, el fondo
y los 170 retratos son archivos estáticos; no requieren R2.

## Antes de publicar

1. Trabaja sobre un commit del repositorio. Las ramas locales `main` y `develop` ya
   existen y `origin` apunta al repositorio de GitHub. Abre el proyecto en Sites y
   solicita que compruebe la compatibilidad de `dist/`, las Pages Functions y el
   enlace D1 `DB`. La documentación de Sites no promete que todos los patrones de
   servidor sean compatibles.
2. Aprovisiona D1 con el nombre de enlace `DB` y aplica `migrations/0001_initial.sql`
   antes de aceptar tráfico. La API devuelve 503 si falta el enlace o el esquema.
3. En **Sites → Más acciones → Configuración**, añade el secreto
   `FEARLESS_ADMIN_TOKEN`. Usa una clave larga generada por un gestor de contraseñas.
   Para crear o corregir series mediante la API, añade también un secreto distinto
   llamado `FEARLESS_API_TOKEN`.
4. Guarda una versión para revisión. Después de revisar el resultado y los datos,
   despliega esa versión. Si cambias un secreto, vuelve a desplegar la versión guardada.

Sites vincula cada versión creada desde un proyecto local al commit utilizado para
compilarla. Revisa el diff y guarda los cambios en Git antes de crear una nueva versión
alojada. Para publicar `main`, selecciona esa rama o indica expresamente a Sites qué
commit debe usar.

No pongas valores secretos en `.openai/hosting.json`, archivos del proyecto,
`VITE_*`, mensajes de chat ni recursos de `src/frontend/public/`. La interfaz pide
la clave de administrador cuando se borra una serie o sus partidas y la envía en
esa petición; no la guarda en almacenamiento del navegador.

## Datos

La base D1 empieza vacía. La base SQLite local y los datos de un Site anterior no
se copian automáticamente. Si hay series que conservar, exporta y migra esos datos
antes de dirigir la aplicación al nuevo Site. La migración inicial crea `series`,
`games`, `events` y un índice de campeones que impide repetir uno en la misma serie.
Al eliminar una serie, sus partidas, eventos e índice se borran en cascada.

La API Node y SQLite sigue disponible para desarrollo local mediante `npm run dev:api`.
El frontend usa `/api` del mismo origen tanto en desarrollo (proxy de Vite) como en
Sites. Deja `VITE_API_BASE_URL` sin definir en Sites para usar esa ruta.

La compilación local y la ruta API se han comprobado, pero la compatibilidad de la
función con el runtime de Sites se confirma al importar y crear una versión alojada.
Si Sites rechaza el formato de la función o la migración, hay que adaptar esos puntos
antes de publicar.

Referencias: [ChatGPT Sites](https://learn.chatgpt.com/docs/sites),
[Pages Functions](https://developers.cloudflare.com/pages/functions/),
[D1](https://developers.cloudflare.com/d1/worker-api/).
