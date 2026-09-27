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
      history/       # Tabla de partidas y campeones usados
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
functions/api/         # Entrada de la API para Sites
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

Instala dependencias con `npm.cmd ci`. En una terminal PowerShell inicia la API:

```powershell
$env:FEARLESS_API_TOKEN = 'token-local-de-prueba'
$env:FEARLESS_ADMIN_TOKEN = 'clave-admin-local'
npm.cmd run dev:api
```

En otra terminal arranca la web:

```powershell
npm.cmd run dev
```

La web consulta `fearless-001` al abrirse. Vite dirige `/api` al servidor local `http://127.0.0.1:8787`. No se cargan datos de ejemplo automáticamente: las series y partidas se crean mediante la API. Los datos persisten en `src/server/data/fearless.db`.

Cuando la serie tenga partidas, la web muestra «Borrar partidas» y «Eliminar serie». La primera acción requiere la clave de administrador y escribir `BORRAR`; conserva la serie. La segunda requiere la misma clave y escribir el ID exacto; elimina la serie, sus partidas y eventos. En la API local, si no se define FEARLESS_ADMIN_TOKEN se usa FEARLESS_API_TOKEN; si ambas faltan, el borrado responde 503. En Sites se exige FEARLESS_ADMIN_TOKEN por separado. La clave se envía en `Authorization` durante la petición y se limpia del diálogo al cerrarlo.

Puedes definir `VITE_API_BASE_URL` para apuntar a otra API autorizada. Sin esa variable se usa el mismo origen. La aplicación consulta siempre la API; no incluye modo de demostración ni series de ejemplo.

## Páginas y catálogo

- Inicio (`#/`): búsqueda, estado, fecha, administración, estadísticas y campeones disponibles. Cuatro filas visibles con scroll propio; no hay tabla de historial.
- Historial (`#/historial`): partidas completas con ambos equipos y los IDs bloqueados.

El catálogo visual y los 170 retratos están incluidos en `src/frontend/`. La instantánea visual indica la versión 15.2.1 de [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon). La página no necesita Internet para mostrar las imágenes ni filtrar el catálogo local. La ruta API `/availability` consulta un catálogo remoto actualizado y sí necesita acceso HTTP a Riot. La API de partidas no registra posiciones; esa columna muestra `—`. Los filtros usan las posiciones disponibles en el catálogo local, definidas solo para parte de los campeones.

## Verificación

```powershell
npm.cmd test
npm.cmd run test:e2e
npm.cmd run release
```

Las pruebas de navegador usan Edge en Windows y una base SQLite aislada en memoria. En otros sistemas, instala Chromium con `npx playwright install chromium`. Las capturas quedan en `test-results/`.

El build genera la web estática en `dist/`. En local, la API sigue siendo un proceso independiente; en Sites, `/api/*` usa la función alojada y D1. Antes de publicar hay que aplicar la migración D1 y revisar la compatibilidad del proyecto en Sites. Los datos existentes no se migran automáticamente.

El contrato de todas las rutas está en [api.md](api.md). `GET /api/series/count` cuenta las series persistidas. La ruta `availability` consulta un catálogo actualizado remoto y responde `503` si no está disponible.

## Archivos para Git

Incluye el código, los recursos de `src/frontend/public/`, las pruebas, la configuración, las migraciones y `package-lock.json`. El `.gitignore` excluye dependencias instaladas, builds, resultados de pruebas, bases de datos locales y archivos `.env` y `.dev.vars` con claves. La base SQLite se crea al iniciar la API; no se sube a Git. El repositorio tiene ramas `main` y `develop` y está enlazado a GitHub mediante `origin`.
