# Genera la carpeta SUBIR\public_html con solo lo nuevo para copiar/pegar en Hostinger.
#
# Uso (desde C:\trabajos\Flujocaja\deploy-rapido):
#   .\generar-paquete.ps1                      -> cambios desde el ultimo paquete generado
#   .\generar-paquete.ps1 -Desde "2026-10-01"  -> cambios desde una fecha concreta
#   .\generar-paquete.ps1 -SinBuild            -> no recompila el frontend (usa frontend\dist actual)
#   .\generar-paquete.ps1 -BackendCompleto     -> copia todo el backend (sin vendor) aunque no haya cambiado

param(
    [string]$Desde,
    [switch]$SinBuild,
    [switch]$BackendCompleto
)

$ErrorActionPreference = 'Stop'

$Aqui      = $PSScriptRoot
$Raiz      = Split-Path $Aqui -Parent
$Frontend  = Join-Path $Raiz 'frontend'
$Backend   = Join-Path $Raiz 'backend'
$Marca     = Join-Path $Aqui '.ultimo-paquete'
$Salida    = Join-Path $Aqui 'SUBIR'
$PublicOut = Join-Path $Salida 'public_html'
$BackOut   = Join-Path $PublicOut 'backend'
$Zip       = Join-Path $Aqui 'SUBIR_public_html.zip'

# Fecha de corte: parametro > marca del ultimo paquete > ultimo despliegue conocido (29/09/2026)
if ($Desde) {
    $Corte = [datetime]$Desde
} elseif (Test-Path $Marca) {
    $Corte = [datetime]::Parse((Get-Content $Marca -Raw).Trim(), [Globalization.CultureInfo]::InvariantCulture)
} else {
    $Corte = [datetime]'2026-09-29 12:00'
}
$Inicio = Get-Date
Write-Host "Incluyendo cambios del backend posteriores a: $($Corte.ToString('yyyy-MM-dd HH:mm'))" -ForegroundColor Cyan

# 1. Compilar frontend
if (-not $SinBuild) {
    Write-Host "Compilando frontend (npm run build)..." -ForegroundColor Cyan
    Push-Location $Frontend
    try {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw "Fallo npm run build" }
    } finally { Pop-Location }
}
$Dist = Join-Path $Frontend 'dist'
if (-not (Test-Path (Join-Path $Dist 'index.html'))) { throw "No existe frontend\dist\index.html" }

# 2. Limpiar salida anterior
if (Test-Path $Salida) { Remove-Item $Salida -Recurse -Force }
if (Test-Path $Zip)    { Remove-Item $Zip -Force }
New-Item -ItemType Directory -Force $PublicOut | Out-Null

# 3. Frontend completo (es pequeno y los nombres de assets cambian en cada build)
Copy-Item (Join-Path $Dist '*') $PublicOut -Recurse -Force
# Los source maps exponen el codigo fuente: no se publican
Get-ChildItem $PublicOut -Recurse -File -Filter *.map | Remove-Item -Force
Copy-Item (Join-Path $Aqui 'plantillas\.htaccess') (Join-Path $PublicOut '.htaccess') -Force

# 4. Backend: solo archivos modificados (nunca .env, vendor, storage, cache)
$Carpetas = 'app','bootstrap','config','database','resources','routes','public'
$Sueltos  = 'artisan','composer.json','composer.lock'
$Excluir  = '\\(bootstrap\\cache|public\\storage|public\\hot)(\\|$)'

$Candidatos = @()
foreach ($c in $Carpetas) {
    $p = Join-Path $Backend $c
    if (Test-Path $p) { $Candidatos += Get-ChildItem $p -Recurse -File -Force }
}
foreach ($s in $Sueltos) {
    $p = Join-Path $Backend $s
    if (Test-Path $p) { $Candidatos += Get-Item $p -Force }
}

$Copiados = @()
foreach ($f in $Candidatos) {
    $rel = $f.FullName.Substring($Backend.Length + 1)
    if ($rel -match $Excluir) { continue }
    if (-not $BackendCompleto -and $f.LastWriteTime -le $Corte) { continue }
    $dest = Join-Path $BackOut $rel
    New-Item -ItemType Directory -Force (Split-Path $dest -Parent) | Out-Null
    Copy-Item $f.FullName $dest -Force
    $Copiados += $rel
}

# Si cambiaron las dependencias, vendor completo
$IncluyeVendor = (Get-Item (Join-Path $Backend 'composer.lock')).LastWriteTime -gt $Corte
if ($IncluyeVendor) {
    Write-Host "composer.lock cambio: incluyendo vendor completo..." -ForegroundColor Yellow
    Copy-Item (Join-Path $Backend 'vendor') (Join-Path $BackOut 'vendor') -Recurse -Force
}

# 5. Migraciones nuevas (para saber si hay que correr migrate)
$Migraciones = $Copiados | Where-Object { $_ -like 'database\migrations\*' }

# 6. ZIP con rutas estilo Linux (para "Extraer" en el Administrador de archivos de Hostinger)
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$zipStream = [System.IO.Compression.ZipFile]::Open($Zip, 'Create')
try {
    Get-ChildItem $PublicOut -Recurse -File -Force | ForEach-Object {
        $entry = $_.FullName.Substring($PublicOut.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipStream, $_.FullName, $entry, 'Optimal') | Out-Null
    }
} finally { $zipStream.Dispose() }

# 7. Resumen
$lineas = @()
$lineas += "PAQUETE GENERADO: $($Inicio.ToString('yyyy-MM-dd HH:mm'))"
$lineas += "Cambios backend desde: $($Corte.ToString('yyyy-MM-dd HH:mm'))"
$lineas += ""
$lineas += "FRONTEND: completo (index.html, assets\, imagenes, .htaccess)"
$lineas += "VENDOR incluido: $(if ($IncluyeVendor) {'SI'} else {'NO'})"
$lineas += ""
$lineas += "BACKEND modificados ($($Copiados.Count)):"
$lineas += ($Copiados | ForEach-Object { "  backend\$_" })
$lineas += ""
if ($Migraciones) {
    $lineas += "!! HAY MIGRACIONES NUEVAS -> ejecutar: php artisan migrate --force"
    $lineas += ($Migraciones | ForEach-Object { "  $_" })
} else {
    $lineas += "Sin migraciones nuevas."
}
$lineas | Set-Content (Join-Path $Salida 'CONTENIDO.txt') -Encoding UTF8

$Inicio.ToString('yyyy-MM-dd HH:mm:ss', [Globalization.CultureInfo]::InvariantCulture) | Set-Content $Marca -Encoding ASCII

Write-Host ""
$lineas | ForEach-Object { Write-Host $_ }
Write-Host ""
Write-Host "Listo:" -ForegroundColor Green
Write-Host "  Carpeta: $PublicOut"
Write-Host "  ZIP:     $Zip"
