# API de Fearless Sync

Todas las rutas están bajo `/api` y usan JSON. En Sites, la API y `/api/health` aceptan llamadas CORS desde cualquier origen (`Access-Control-Allow-Origin: *`); no se habilitan credenciales de navegador. La API local restringe CORS a los orígenes de desarrollo configurados. Solo las acciones administrativas necesitan Bearer token. En desarrollo, la API escucha por defecto en `http://127.0.0.1:8787` y guarda sus datos en SQLite (`src/server/data/fearless.db`). El Worker de Sites reutiliza las mismas rutas y guarda datos en D1 con el enlace `DB`.

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/health` | Comprobar API y base de datos (`200` o `503`). |
| GET | `/api/admin/validate` | Validar el Admin Token; devuelve `{ "valid": true }` solo con una clave válida. |
| OPTIONS | `/api/*` | Preflight CORS. |
| GET | `/api/fearless` | Consultar la única serie Fearless activa y sus campeones disponibles. |
| POST | `/api/fearless` | Guardar una partida en la serie activa y archivarla si quedan menos de diez campeones. |
| POST | `/api/series` | Crear una serie vacía con `seriesId` único. |
| GET | `/api/series?limit=20&offset=0` | Listar series con paginación, número de partidas y última actualización. |
| GET | `/api/series/count` | Contar las series guardadas sin devolver el listado. |
| GET | `/api/stats/champions` | Victorias de campeones en todas las series, incluidas las archivadas. |
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
| POST | `/api/series/{seriesId}/prepare` | Obtener la serie para la siguiente partida; crear una continuación si quedan menos de diez campeones. |
| GET | `/api/series/{seriesId}/events?limit=20&offset=0` | Consultar eventos cronológicos de auditoría. |

La interfaz consulta series, muestra la clasificación global y permite asignar ganadores. Ofrece las dos acciones de borrado cuando la serie tiene partidas. Crear series, registrar partidas y corregir equipos se hace mediante la API. No se crean series de muestra al iniciar.

`GET /api/stats/champions` devuelve `success`, `completedGames`, `pendingGames` y
`champions`, con `{championId, wins, gamesPlayed}` por campeón que haya jugado alguna partida con ganador, incluidos los que tienen cero victorias. La web completa la clasificación con todo el catálogo y muestra cero victorias, cero partidas y 0 % para los campeones que aún no han jugado.
`gamesPlayed` solo cuenta partidas con ganador confirmado; una partida pendiente no
suma victorias ni entra en el porcentaje. Cada campeón del equipo ganador recibe una
victoria por partida. Se suman todas las series persistidas, también las archivadas,
sin paginación ni dependencia del catálogo remoto. Los registros se ordenan por
victorias descendentes, porcentaje descendente y ID. La web resuelve nombres y
desempata por nombre. El recuento se calcula directamente desde las partidas, por
lo que corregir equipos o ganadores, vaciar series y borrar partidas o series se
refleja en la siguiente consulta. Si falla la base de datos, responde `503
database_unavailable`, igual que las otras consultas.

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

Los cinco IDs de cada equipo se envían en este orden: **TOP, JG, MID, ADC, SUP**. La posición se deduce del índice del array, también cuando el campeón puede jugar en varios roles. El ganador se guarda por separado y `GET /api/series/{seriesId}` lo devuelve en cada partida.

## Validación y autenticación

- Cada partida pertenece a una serie. La pareja `(seriesId, gameNumber)` es única.
- Cada equipo tiene exactamente cinco campeones. No se repiten IDs entre equipos ni entre partidas de una misma serie.
- Crear series y partidas no requiere token.
- Corregir equipos, asignar ganadores, borrar partidas, borrar una serie o vaciarla exige `Authorization: Bearer <FEARLESS_ADMIN_TOKEN>`.
- La clave de administrador es independiente y obligatoria tanto en la API local como en Sites. La ruta de validación también la exige.
- Las claves se configuran en el servidor o como secretos alojados en Sites. Nunca se incluyen en `VITE_*`, archivos públicos ni en el código frontend. CORS no mantiene secretos: cualquier cliente con la clave válida puede invocar las rutas protegidas.
- `seriesId` puede tener hasta 128 caracteres: empieza por una letra o un número y después admite letras, números, puntos, guiones y guiones bajos. `count` está reservado.
- `gameNumber` debe ser un entero positivo. `limit` admite de 1 a 100 y `offset` debe ser no negativo.
- Un error devuelve un estado HTTP apropiado y JSON con `success: false` y un campo `error` estable. Sin la clave configurada, una operación administrativa responde `503`.
- El borrado de una partida libera sus campeones. El borrado de una serie elimina también partidas y eventos mediante claves foráneas.
- Los eventos se guardan en la misma transacción que la operación que registran.

`GET /api/series` y `GET /events` devuelven `series` o `events` junto con `total`, `limit` y `offset`. Las rutas de partidas devuelven `games` en orden ascendente o una partida individual.

`GET /availability` devuelve `catalogVersion`, `totalChampions`, `usedChampions` y `availableChampions`. El servidor consulta y valida el catálogo versionado de Riot Data Dragon y lo conserva en memoria durante una hora. Si no puede consultarlo, devuelve `503 catalog_unavailable`; si un ID usado no pertenece al catálogo, devuelve `409 unknown_champion_ids`. Esta ruta requiere conexión a Internet en la configuración actual.

## Respuestas y catálogo

El frontend consulta la API del mismo origen por defecto; Vite dirige `/api` a la API local. `VITE_API_BASE_URL` permite cambiar el origen en desarrollo. El catálogo visual de 173 campeones y sus retratos están incluidos en el proyecto, sin consultas externas. `GET /api/series/{seriesId}` devuelve `seriesId`, `createdAt`, `updatedAt`, `games` en orden de `gameNumber` y `usedChampions`. Cada partida incluye ambos equipos, `winner` y `createdAt`.

`GET /api/series/count` consulta la base de datos persistida. Una respuesta es:

```json
{ "success": true, "count": 12 }
```

`count` es un entero no negativo y cuenta las series persistidas. No existe estado de cierre, así que todas las series guardadas se consideran activas. Si la base de datos falla, responde `503` con `{"success":false,"error":"database_unavailable"}`. La misma ruta está conectada al Worker D1 de Sites.

La web calcula la disponibilidad visual con su catálogo local de 173 campeones. La ruta API `/availability` usa el catálogo remoto de Riot, que puede tener un número distinto de campeones y devolver `503` si la consulta externa falla.

## Endpoint fijo Fearless para PersoBuilder

PersoBuilder usa siempre **`/api/fearless`**, con una única serie activa compartida
por todas las apps. El servidor guarda en SQLite o D1 qué serie está activa y qué
series ya se archivaron. Las series creadas manualmente son independientes de
este flujo.

1. `GET /api/fearless` devuelve la serie activa con `games`, `usedChampions`,
   `availableChampions`, `availableChampionsCount`, `catalogVersion`,
   `totalChampions`, `nextGameNumber`, `minimumChampionsPerGame` y `canStartGame`.
   Si no existe una activa, la crea automáticamente. La respuesta no se almacena
   en caché.
2. La app prepara la partida usando esos campeones.
3. Al confirmar, envía `POST /api/fearless` con los equipos, el `nextGameNumber`
   recibido como `gameNumber` y el `seriesId` recibido en el GET. El ID se devuelve
   en el cuerpo para detectar una partida preparada con una serie antigua; la
   URL es siempre la misma. No necesita token.
4. Tras guardar, si quedan **10 o más** campeones, mantiene la serie. Si quedan
   **menos de 10**, la archiva y crea una nueva vacía. La siguiente consulta a
   `/api/fearless` devuelve automáticamente la nueva serie.

Ejemplo de registro:

```json
{
  "seriesId": "fearless-ID-recibido-en-el-GET",
  "gameNumber": 1,
  "blueTeam": [103, 64, 7, 222, 412],
  "redTeam": [266, 254, 238, 81, 111]
}
```

El POST devuelve la partida guardada, su `seriesId`, `seriesArchived` y
`activeSeriesId`. El historial anterior sigue disponible en `/api/series` y
`/api/series/{seriesId}`. Vaciar una serie archivada no la reactiva; borrar la
activa permite que la siguiente consulta cree otra. El esquema nuevo se instala
automáticamente sobre las bases existentes, conservando sus partidas.

La regla usa el catálogo remoto de Riot. Con 173 campeones, se archiva después de
17 partidas y quedan 3. Si falla el catálogo, responde `503 catalog_unavailable`
sin crear ni archivar series. Si la app envía una partida para una serie anterior,
responde `409 fearless_series_changed`; debe consultar Fearless de nuevo. Esta
ruta valida también que todos los campeones enviados pertenezcan al catálogo.

La consulta inicial puede crear una serie y también archiva una activa que haya
quedado agotada por registros hechos en las rutas antiguas. No reserva campeones
frente a otros clientes; los conflictos siguen rechazándose al guardar.

El cliente HTTP incluye `getFearless()` y `createFearlessGame(seriesId, input)`.
La app PersoBuilder debe integrar estas llamadas en su repositorio. La web de
este repositorio conserva la búsqueda de series por ID para consultar historiales.

## Ruta anterior de preparación por ID

Para clientes que todavía gestionan IDs explícitos, sigue disponible
`POST /api/series/{seriesId}/prepare`, sin cuerpo ni token. La serie inicial debe
existir; se crea con el `POST /api/series` habitual. La decisión usa los IDs
disponibles del catálogo de Riot, no el número de victorias ni los jugadores:

- Con **10 o más campeones disponibles**, mantiene el ID actual.
- Con **menos de 10**, crea o reutiliza una serie vacía con otro ID, conservando
  las partidas de la anterior. Las consultas repetidas y concurrentes reutilizan
  el mismo ID. Si esa continuación también se agotó, busca la siguiente.

La respuesta incluye `seriesId`, `previousSeriesId` (el ID solicitado),
`seriesChanged`, `nextGameNumber`, `catalogVersion`, `totalChampions`,
`usedChampions`, `availableChampions`, `availableChampionsCount`,
`minimumChampionsPerGame: 10` y `canStartGame: true`.

PersoBuilder debe guardar el `seriesId` devuelto, usar exclusivamente los
`availableChampions` de esa respuesta para el draft y registrar la partida en
`POST /api/series/{seriesId}/games` con el `nextGameNumber` recibido. En una serie
nueva empieza en la partida 1 y todos los campeones vuelven a estar disponibles.
Con un catálogo de 173 campeones, el cambio ocurre tras 17 partidas, cuando quedan
3. La operación prepara la serie; no reserva una partida frente a otros clientes.

Si no se puede consultar el catálogo, devuelve `503 catalog_unavailable`; si
hay IDs usados desconocidos, devuelve `409 unknown_champion_ids`. En esos casos
no cambia de serie. `/availability` también incluye `availableChampionsCount`,
`minimumChampionsPerGame` y `canStartGame` para consultar el umbral sin crear nada.
La web permite seguir consultando el historial por su ID original. Este
repositorio incluye la API y el método `prepareSeries` del cliente HTTP; la
integración de la llamada en PersoBuilder debe hacerse en su propio repositorio.
