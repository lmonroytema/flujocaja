// Config de Vite SOLO para el video demo: reutiliza la config del proyecto
// y apunta el proxy /api al backend demo (puerto 8010, SQLite local).
import base from "../../frontend/vite.config.ts";

export default {
  ...base,
  root: "C:/trabajos/Flujocaja/frontend",
  server: {
    port: 5180,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8010" },
  },
};
