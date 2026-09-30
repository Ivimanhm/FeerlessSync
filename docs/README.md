# Desarrollo de PersoBuilder · Fearless Sync

Guía de desarrollo de la web Vite, Preact y TypeScript. La API local usa Node y SQLite; la entrada alojada preparada para Sites usa D1. Requiere Node.js 24 para el desarrollo local. Consulta [la preparación para Sites](sites.md) antes de publicar.

## Estructura del proyecto

```text
src/
  frontend/
    app/             # Coordinación de la aplicación y navegación
      hooks/         # Estado de series y navegación
    pages/
      Inicio/        # InicioPage.tsx e Inicio.css
      Historial/     # HistorialPage.tsx e Historial.css
    components/
      layout/        # Cabecera y menú lateral
      champions/     # Rejilla y tarjetas de campeones
      series/        # Búsqueda, estadísticas y borrado
      history/       # Tablas de partidas y edición de ganadores
      ui/            # Marca, indicadores y tarjetas comunes
    services/
      api/           # Cliente HTTP y consultas de series
      championCatalog.ts
    data/
    types/
    styles/
    public/          # Retratos y recursos estáticos
    index.html
  server/
    routes/          # Endpoints HTTP
    services/        # Validaciones, autenticación y catálogo
    repositories/    # SQLite local y D1 alojado
    data/            # Base local, excluida de Git
  tests/
    frontend/
    api/
    e2e/
package/
  scripts/
    dev.mjs          # Desarrollo del frontend
    release.mjs      # Comprobación TypeScript y compilación de producción
    run.mjs          # Ejecución compartida
  vite.config.ts
  vitest.config.ts
  playwright.config.ts
  tsconfig.json
src/server/worker.ts   # Worker de Sites: API D1 y assets estáticos
migrations/            # Esquema inicial D1
.openai/hosting.json   # Nombre del enlace D1, sin secretos
docs/
  README.md
  api.md
  sites.md
README.md
package.json
package-lock.json
.gitignore
```

`src/frontend/app/App.tsx` coordina la interfaz. Los hooks `useSeries` y `useNavigation` gestionan consultas y navegación, respectivamente. Las páginas combinan componentes sin hacer peticiones HTTP directamente. `src/server/index.ts` inicia la API y `src/server/nodeServer.ts` adapta las peticiones de Node a las rutas. `dist/` se genera al compilar y no se sube a Git.

## Ejecución local

Instala dependencias con `npm.cmd ci` y arranca la vista local de ejemplo:

```powershell
npm.cmd run dev
```

Abre `http://localhost:5173`. La serie `fearless-001` trae tres partidas de muestra.
La navegación, los filtros, el cambio de ganador y los borrados funcionan sin API.
Escribe cualquier clave no vacía en los diálogos. Los cambios se guardan en el
almacenamiento local del navegador y «Restaurar ejemplo» repone la serie.

Para trabajar con la API real, inicia el servidor en una terminal PowerShell:

```powershell
$env:FEARLESS_ADMIN_TOKEN = 'clave-admin-local'
npm.cmd run dev:api
```

En otra terminal arranca la web apuntando a esa API:

```powershell
$env:VITE_API_BASE_URL = 'http://127.0.0.1:8787'
npm.cmd run dev
```

La web consulta `fearless-001` al abrirse. Con `VITE_API_BASE_URL` configurada,
las series y partidas se crean mediante la API y persisten en `src/server/data/fearless.db`.

Cuando la serie tenga partidas, la web muestra «Borrar partidas» y «Eliminar serie». La primera acción requiere la clave de administrador y escribir `BORRAR`; conserva la serie. La segunda requiere la misma clave y escribir el ID exacto; elimina la serie, sus partidas y eventos. FEARLESS_ADMIN_TOKEN se configura por separado en la API local y en Sites; sin ella, las acciones administrativas responden 503. La clave se envía en `Authorization` durante la petición y se limpia del diálogo al cerrarlo.

`VITE_API_BASE_URL` puede apuntar a otra API autorizada. El mock solo se activa
en desarrollo cuando no hay URL de API configurada; la compilación de Sites
consulta la API del mismo origen.

## Páginas y catálogo

- Inicio (`#/`): búsqueda, estado, fecha, administración, estadísticas y campeones disponibles. La rejilla ocupa la altura libre de la ventana cuando hay suficientes resultados y mantiene su scroll propio; no hay tabla de historial.
- Historial (`#/historial`): una tabla por partida, con ambos equipos ordenados por TOP, JG, MID, ADC y SUP y el ganador. Permite seleccionar, cambiar o quitar el ganador con la clave de escritura de la API.

El catálogo visual y los 173 retratos están incluidos en `src/frontend/`. La interfaz usa las versiones JPG optimizadas de los retratos, `Logo-small.png` y `landscape.jpg`; conserva los PNG originales como fuente. El Worker incluye estas imágenes optimizadas en el build para servirlas sin depender de un CDN externo. La instantánea visual indica la versión 16.18.1 de [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon). La página no necesita Internet para mostrar las imágenes ni filtrar el catálogo local. La ruta API `/availability` consulta un catálogo remoto actualizado y sí necesita acceso HTTP a Riot. Cada equipo guardado usa el orden TOP, JG, MID, ADC y SUP; Historial muestra esas posiciones por índice. Los nombres, retratos y posiciones iniciales proceden de `PersoBuilder/src/frontend/public/champions.json` (conjunto generado el 14 de septiembre de 2026). Para que el filtro también muestre flex picks, las posiciones se ampliaron con los [listados por posición de OP.GG](https://op.gg/lol/champions) del parche 16.19. El filtro es una instantánea más amplia que el JSON de PersoBuilder y puede variar con el metajuego.

## Verificación

```powershell
npm.cmd test
npm.cmd run test:e2e
npm.cmd run release
```

Las pruebas de navegador usan Edge en Windows y una base SQLite aislada en memoria. En otros sistemas, instala Chromium con `npx playwright install chromium`. Las capturas quedan en `test-results/`.

El build genera la web estática en `dist/` y el Worker de Sites en `dist/server/index.js`. En local, la API sigue siendo un proceso independiente con SQLite; en Sites, `/api/*` usa el Worker y D1. La primera petición prepara el esquema D1, conservando los datos que ya haya. La base SQLite local no se migra automáticamente.

El contrato de todas las rutas está en [api.md](api.md). `GET /api/series/count` cuenta las series persistidas. La ruta `availability` consulta un catálogo actualizado remoto y responde `503` si no está disponible.

## Archivos para Git

Incluye el código, los recursos de `src/frontend/public/`, las pruebas, la configuración, las migraciones y `package-lock.json`. El `.gitignore` excluye dependencias instaladas, builds, resultados de pruebas, bases de datos locales y archivos `.env` y `.dev.vars` con claves. La base SQLite se crea al iniciar la API; no se sube a Git. El repositorio tiene ramas `main` y `develop` y está enlazado a GitHub mediante `origin`.
