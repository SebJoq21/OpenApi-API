param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('init', 'start', 'stop', 'status')]
  [string]$Action
)

$ErrorActionPreference = 'Stop'

$PgBin = if ($env:PG_BIN) { $env:PG_BIN } else { 'C:\Program Files\PostgreSQL\18\bin' }
$DataDir = if ($env:PGDATA_DIR) { $env:PGDATA_DIR } else { Join-Path $env:LOCALAPPDATA 'fogoneria-pgdata' }
$Port = 5433
$DbUser = 'fogoneria'

function Test-PgReady {
  & "$PgBin\pg_isready.exe" -h localhost -p $Port -U $DbUser *> $null
  return $LASTEXITCODE -eq 0
}

function Ensure-Databases {
  foreach ($db in @('fogoneria', 'fogoneria_test')) {
    $exists = & "$PgBin\psql.exe" -h localhost -p $Port -U $DbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'"
    if ($exists.Trim() -ne '1') {
      & "$PgBin\createdb.exe" -h localhost -p $Port -U $DbUser $db
    }
  }
}

switch ($Action) {
  'init' {
    if (-not (Test-Path $DataDir)) {
      New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
      & "$PgBin\initdb.exe" -D $DataDir -U $DbUser --auth=trust --encoding=UTF8 --locale=C
    }
    else {
      Write-Host "Directorio de datos ya existe: $DataDir"
    }

    if (-not (Test-PgReady)) {
      & "$PgBin\pg_ctl.exe" -D $DataDir -l (Join-Path $DataDir 'server.log') -o "-p $Port" start
      Start-Sleep -Seconds 2
    }

    Ensure-Databases
    Write-Host "PostgreSQL listo en localhost:$Port"
  }

  'start' {
    if (-not (Test-Path $DataDir)) {
      throw "No existe el directorio de datos. Ejecuta: npm run db:local:init"
    }

    if (-not (Test-PgReady)) {
      & "$PgBin\pg_ctl.exe" -D $DataDir -l (Join-Path $DataDir 'server.log') -o "-p $Port" start
      Start-Sleep -Seconds 2
    }
    else {
      Write-Host "PostgreSQL ya está corriendo en el puerto $Port"
    }

    Ensure-Databases
  }

  'stop' {
    if (Test-Path $DataDir) {
      & "$PgBin\pg_ctl.exe" -D $DataDir stop -m fast
    }
  }

  'status' {
    if (Test-PgReady) {
      Write-Host "PostgreSQL corriendo en localhost:$Port"
    }
    else {
      Write-Host "PostgreSQL no está corriendo en localhost:$Port"
      exit 1
    }
  }
}
