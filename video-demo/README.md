# video-demo: video de capacitación por perfiles

## Entregables
- `FlujoCaja_Demo_Perfiles.mp4` es el video final. Dura 9:12 y tiene **narración en español** (voz neuronal peruana `es-PE-CamilaNeural`) y subtítulos incrustados.
- `FlujoCaja_Demo_Perfiles.srt` contiene los mismos subtítulos en un archivo aparte, por si se quieren editar o traducir.
- `guion.md` es el guion por sección y perfil, con la matriz de qué ve cada rol.
- `datos-prueba/` tiene los Excel ficticios (`Proyectos_DEMO.xlsx` y `Hitos_Pago_DEMO.xlsx`). Usan el mismo formato que los exportes de Project Hub.

## Cómo se regenera (solo local, nunca producción)
El demo no toca la base de datos MySQL local ni la de producción. Usa SQLite en `runtime/demo.sqlite`.

```bash
cd /c/trabajos/Flujocaja/video-demo
touch runtime/demo.sqlite
export DB_CONNECTION=sqlite DB_DATABASE="C:/trabajos/Flujocaja/video-demo/runtime/demo.sqlite" MAIL_MAILER=log
(cd ../backend && php artisan migrate --force)
php scripts/preparar_demo.php
python -I scripts/generar_excel_prueba.py datos-prueba
```

En tres terminales, con las mismas variables de entorno en la del backend:

```bash
cd /c/trabajos/Flujocaja/backend/public && php -S 127.0.0.1:8010 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
cd /c/trabajos/Flujocaja/video-demo/scripts && php -S 127.0.0.1:8020 mock-gestion-compras.php
cd /c/trabajos/Flujocaja/frontend && npx vite --config ../video-demo/scripts/vite.demo.config.mjs
```

En cada terminal:
- El backend demo queda en el puerto 8010.
- La API de Compras simulada queda en el puerto 8020.
- El frontend queda en http://localhost:5180 y redirige `/api` al puerto 8010.

Antes de la primera grabación hay que importar los dos Excel una vez. Se puede hacer como Finanzas en la pantalla Importaciones, para que el dashboard tenga datos.

Después se graba y se ensambla:

```bash
python -I scripts/grabar_demo.py .
python -I scripts/ensamblar_video.py .
```

`grabar_demo.py` acepta segmentos sueltos, por ejemplo `python -I scripts/grabar_demo.py . finanzas`.

Notas sobre la narración:
- `grabar_demo.py` genera una locución por subtítulo con `edge-tts`. Este servicio en línea de Microsoft recibe solo el texto de los subtítulos.
- Las locuciones se guardan en caché en `runtime/audio/`.
- La grabación espera a que termine cada locución antes de mostrar el siguiente subtítulo.
- Cada subtítulo marca su número en una franja de 6 px al pie del video. `ensamblar_video.py` lee esa franja fotograma a fotograma, coloca cada locución en el instante exacto y luego la recorta.

Requisitos de Python: `playwright` con Chromium instalado, `openpyxl`, `pillow`, `numpy`, `edge-tts` e `imageio-ffmpeg`. Este último trae su propio ffmpeg.
