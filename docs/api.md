# API de Fearless Sync

Todas las rutas están bajo `/api` y usan JSON. En el despliegue, la API y `/api/health` aceptan llamadas CORS desde cualquier origen (`Access-Control-Allow-Origin: *`); no se habilitan credenciales de navegador. La API local restringe CORS a los orígenes de desarrollo configurados. Las escrituras siguen necesitando Bearer token. En desarrollo, la API escucha por defecto en `http://127.0.0.1:8787` y guarda sus datos en SQLite (`src/server/data/fearless.db`). La entrada preparada para Sites reutiliza las mismas rutas y guarda datos en D1 con el enlace `DB`. Su funcionamiento alojado debe validarse al importar el proyecto.

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/health` | Comprobar API y base de datos (`200` o `503`). |
| OPTIONS | `/api/*` | Preflight CORS. |
| POST | `/api/series` | Crear una serie vacía con `seriesId` único. |
| GET | `/api/series?limit=20&offset=0` | Listar series con paginación, número de partidas y última actualización. |
| GET | `/api/series/count` | Contar las series guardadas sin devolver el listado. |
| GET | `/api/series/{seriesId}` | Leer serie, partidas en orden, campeones usados y última actualización. |
| DELETE | `/api/series/{seriesId}` | Borrar serie, partidas y eventos, o `404` si no existe. |
| POST | `/api/series/{seriesId}/games` | Guardar partida confirmada. |
| DELETE | `/api/series/{seriesId}/games` | Borrar todas las partidas y conservar la serie. |
| GET | `/api/series/{seriesId}/games` | Listar partidas en orden ascendente. |
| GET | `/api/series/{seriesId}/games/{gameNumber}` | Leer una partida, ganador y fecha de creación. |
| PATCH | `/api/series/{seriesId}/games/{gameNumber}` | Corregir equipos con las mismas validaciones que POST. |
| DELETE | `/api/series/{seriesId}/games/{gameNumber}` | Borrar partida y recalcular campeones usados. |
| PUT | `/api/series/{seriesId}/games/{gameNumber}/winner` | Asignar `blue`, `red` o `null` sin cambiar equipos. |
| GET | `/api/series/{seriesId}/used-champions` | Leer IDs únicos usados. |
| GET | `/api/series/{seriesId}/availability` | Leer usados y disponibles desde un catálogo completo y versionado. |
| GET | `/api/series/{seriesId}/events?limit=20&offset=0` | Consultar eventos cronológicos de auditoría. |

La interfaz solo consulta series y ofrece las dos acciones de borrado cuando la serie tiene partidas. Crear series, registrar partidas, corregir equipos y asignar ganadores se hace mediante la API. No se crean series de muestra al iniciar.

## Cuerpos de escritura

```json
{ "seriesId": "fearless-001" }
```

```json
{
  "gameNumber": 1,
  "blueTeam": [103, 64, 7, 222, 412],
  "redTeam": [266, 254, 238, 81, 111]
}
```

Para cambiar un ganador, envía `{"winner":"blue"}`, `{"winner":"red"}` o `{"winner":null}` a la ruta `PUT /winner`. `PATCH /games/{gameNumber}` admite `blueTeam`, `redTeam` o ambos; no cambia el número de partida ni el ganador.

## Validación y autenticación

- Cada partida pertenece a una serie. La pareja `(seriesId, gameNumber)` es única.
- Cada equipo tiene exactamente cinco campeones. No se repiten IDs entre equipos ni entre partidas de una misma serie.
- Las rutas POST, PATCH, PUT y DELETE de partidas individuales exigen `Authorization: Bearer <FEARLESS_API_TOKEN>`.
- Las dos rutas que borran una serie o todas sus partidas exigen `Authorization: Bearer <FEARLESS_ADMIN_TOKEN>`.
- En la API local, si FEARLESS_ADMIN_TOKEN no está definida, se usa FEARLESS_API_TOKEN. En Sites la clave de administrador es independiente y obligatoria.
- Las claves se configuran en el servidor o como secretos alojados en Sites. Nunca se incluyen en `VITE_*`, archivos públicos ni en el código frontend. CORS no mantiene secretos: cualquier cliente con la clave válida puede invocar las rutas protegidas.
- `seriesId` puede tener hasta 128 caracteres: empieza por una letra o un número y después admite letras, números, puntos, guiones y guiones bajos. `count` está reservado.
- `gameNumber` debe ser un entero positivo. `limit` admite de 1 a 100 y `offset` debe ser no negativo.
- Un error devuelve un estado HTTP apropiado y JSON con `success: false` y un campo `error` estable. Sin la clave configurada, una escritura o un borrado responde `503`.
- El borrado de una partida libera sus campeones. El borrado de una serie elimina también partidas y eventos mediante claves foráneas.
- Los eventos se guardan en la misma transacción que la operación que registran.

`GET /api/series` y `GET /events` devuelven `series` o `events` junto con `total`, `limit` y `offset`. Las rutas de partidas devuelven `games` en orden ascendente o una partida individual.

`GET /availability` devuelve `catalogVersion`, `totalChampions`, `usedChampions` y `availableChampions`. El servidor consulta y valida el catálogo versionado de Riot Data Dragon y lo conserva en memoria durante una hora. Si no puede consultarlo, devuelve `503 catalog_unavailable`; si un ID usado no pertenece al catálogo, devuelve `409 unknown_champion_ids`. Esta ruta requiere conexión a Internet en la configuración actual.

## Respuestas y catálogo

El frontend consulta la API del mismo origen por defecto; Vite dirige `/api` a la API local. `VITE_API_BASE_URL` permite cambiar el origen en desarrollo. El catálogo visual de 170 campeones y sus retratos están incluidos en el proyecto, sin consultas externas. `GET /api/series/{seriesId}` devuelve `seriesId`, `createdAt`, `updatedAt`, `games` en orden de `gameNumber` y `usedChampions`. Cada partida incluye ambos equipos, `winner` y `createdAt`.

`GET /api/series/count` consulta la base de datos persistida. Una respuesta es:

```json
{ "success": true, "count": 12 }
```

`count` es un entero no negativo y cuenta las series persistidas. No existe estado de cierre, así que todas las series guardadas se consideran activas. Si la base de datos falla, responde `503` con `{"success":false,"error":"database_unavailable"}`. La misma ruta está conectada a la entrada D1 de Sites, pendiente de validación en el despliegue.

La web calcula la disponibilidad visual con su catálogo local de 170 campeones. La ruta API `/availability` usa el catálogo remoto de Riot, que puede tener un número distinto de campeones y devolver `503` si la consulta externa falla.
