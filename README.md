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
npm.cmd run dev:api
```

En otra terminal:

```powershell
npm.cmd run dev
```

Vite sirve la web en `http://localhost:5173` y dirige `/api` a la API local en
`http://127.0.0.1:8787`. Esta API guarda los datos en SQLite. Para operaciones de
escritura y borrado hay que configurar las claves del proceso del servidor; consulta
la [guía de desarrollo](docs/README.md). La web no crea datos de muestra.

## Compilación y Sites

`npm.cmd run build` comprueba TypeScript y genera la web en `dist/`. El proyecto
incluye una función para `/api/*`, un repositorio D1 y una migración de esquema
para preparar el alojamiento en ChatGPT Sites. La compatibilidad final y los datos
de producción deben revisarse al importar el proyecto en Sites. La clave de
administrador se añade como secreto del sitio, nunca en el repositorio.

El logo, el fondo y los 170 retratos de campeones se sirven como archivos estáticos
desde `src/frontend/public/`; no requieren almacenamiento de imágenes en D1 ni R2.

## Documentación

- [Desarrollo local y estructura](docs/README.md)
- [Contrato de la API](docs/api.md)
- [Preparación y publicación en Sites](docs/sites.md)
