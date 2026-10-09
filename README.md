# PersoBuilder · Fearless Sync

Aplicación web para consultar series Fearless de League of Legends, revisar partidas y
ver qué campeones ya se usaron. La API permite crear series, registrar y corregir
partidas, asignar ganadores y consultar un historial de eventos. Versión **1.0.4**.

PersoBuilder puede usar siempre `/api/fearless`: GET consulta la serie activa y
POST registra una partida. Cuando quedan menos de diez campeones, el servidor
archiva la serie conservando su historial y abre automáticamente una nueva.

La interfaz muestra una portada y dos páginas de consulta: **Campeones**, con búsqueda, estadísticas y los
campeones disponibles; e **Historial**, con las partidas de la serie. Cuando una
serie tiene partidas, ofrece acciones para borrar sus partidas o eliminarla por
completo. Ambas requieren una clave de administrador y confirmación en pantalla.

## Desarrollo local

Requiere Node.js 24. En la raíz del proyecto:

```powershell
npm.cmd ci
npm.cmd run dev
```

Vite sirve la web en `http://localhost:5173` con la serie de ejemplo
`fearless-001`. Puedes consultar Campeones e Historial, cambiar ganadores y probar
los borrados con cualquier clave no vacía. Los cambios quedan en el navegador;
«Restaurar ejemplo» repone los datos iniciales. No hace falta iniciar la API.

Para usar la API local real y SQLite, consulta la [guía de desarrollo](docs/README.md).

## Compilación y Sites

`npm.cmd run build` comprueba TypeScript y genera la web en `dist/` y el Worker de
`/api/*` en `dist/server/index.js`. El Worker usa el repositorio D1 y la migración
del proyecto para alojarse en ChatGPT Sites. La clave de administrador se añade
como secreto del sitio, nunca en el repositorio.

El logo, el fondo y los 173 retratos de campeones se sirven como archivos estáticos
desde `src/frontend/public/`; no requieren almacenamiento de imágenes en D1 ni R2.

## Documentación

- [Desarrollo local y estructura](docs/README.md)
- [Contrato de la API](docs/api.md)
- [Preparación y publicación en Sites](docs/sites.md)

La página de inicio mantiene el diseño de bienvenida de Windows de PersoBuilder y usa un paisaje generado con una torre a la izquierda y un cristal a la derecha, oscurecido detrás del texto para mejorar la lectura. El paisaje original puede compararse en `/?fondo=anterior` y la variante del valle en `/?fondo=valle`; el archivo y el prompt se documentan en [Fondo de portada](docs/home-background-v3.md). «Descargar app» abre las [releases de PersoBuilder](https://github.com/Ivimanhm/PersoBuilder/releases) en otra pestaña y «Comenzar ahora» lleva a los campeones en `/#/campeones`. «Cómo funciona» y «Ver cómo funciona» abren un modal con los cuatro pasos de una serie Fearless, adaptado a escritorio y móvil; se cierra con Escape, sus botones de cierre o pulsando fuera. El historial sigue disponible directamente en `/#/historial`.
