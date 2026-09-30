# PersoBuilder · Fearless Sync

Aplicación web para consultar series Fearless de League of Legends, revisar partidas y
ver qué campeones ya se usaron. La API permite crear series, registrar y corregir
partidas, asignar ganadores y consultar un historial de eventos. Versión **1.0.0**.

La interfaz muestra dos páginas: **Inicio**, con búsqueda, estadísticas y los
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
`fearless-001`. Puedes consultar Inicio e Historial, cambiar ganadores y probar
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
