# Actualización rápida en Hostinger

Dominio: https://flujo-caja.temalitoclean.com
BD: `u220252535_fc` (usuario `u220252535_fc`)

## 1. Generar el paquete (en tu PC)

Doble clic en **`GENERAR.bat`** (o `.\generar-paquete.ps1` en PowerShell).

Hace esto:
- Compila el frontend (`npm run build`).
- Crea `SUBIR\public_html\` con:
  - el frontend completo (`index.html`, `assets\`, imágenes, `.htaccess`)
  - **solo** los archivos del backend modificados desde el último paquete (en `public_html\backend\...`)
  - `vendor\` completo solo si cambió `composer.lock`
- Crea `SUBIR_public_html.zip` con lo mismo.
- Lista todo en `SUBIR\CONTENIDO.txt` y avisa si hay migraciones nuevas.

**Nunca** incluye `.env`, `storage\` ni `bootstrap\cache\`, así no pisa la configuración del servidor.

Opciones:
- `GENERAR.bat -Desde "2026-10-01"` → cambios desde una fecha concreta
- `GENERAR.bat -SinBuild` → no recompila el frontend
- `GENERAR.bat -BackendCompleto` → todo el backend (sin vendor)

## 2. Subir a Hostinger

**Opción A — ZIP (más rápido):**
1. hPanel → Administrador de archivos → `public_html`
2. (Opcional) borra `public_html/assets/` para no acumular builds viejos
3. Sube `SUBIR_public_html.zip` dentro de `public_html`
4. Clic derecho → **Extraer** → destino `public_html` (aceptar sobrescribir)
5. Borra el `.zip`

**Opción B — copiar/pegar:** arrastra el **contenido** de `SUBIR\public_html\` sobre `public_html` (FileZilla o el Administrador de archivos), sobrescribiendo.

## 3. Después de subir (SSH de Hostinger)

```bash
cd ~/domains/flujo-caja.temalitoclean.com/public_html/backend
php artisan migrate --force      # solo si CONTENIDO.txt dice que hay migraciones
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
```

## Primera vez / .env perdido

`plantillas\.env.produccion` es el `.env` de producción con los datos de la BD.
Cópialo a `public_html/backend/.env` **solo** si el servidor no lo tiene ya.
Revisa antes `DB_PASSWORD` y `MAIL_PASSWORD`.
