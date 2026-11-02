param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Start', 'Migrate', 'Frontend', 'Backend', 'Env', 'Status', 'Stop')]
  [string]$Action
)

# Docker-free twin of phase0-test.ps1: the same isolated database, marker and
# environment, on a local PostgreSQL install. See docs/agents/local-test-db.md.
#   PHASE0_PG_BIN   folder with initdb/pg_ctl/psql (default: found on PATH)
#   PHASE0_PG_DATA  cluster folder (default: <repo>\.phase0-test-pgdata)
# The migration-rehearsal spec needs Docker and is not run here.

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$files = Join-Path $repo '.phase0-test-files'
$expectedMarker = 'dacho-phase0-disposable-v1'
$db = 'dacho_phase0_test'
$user = 'phase0_test'
$password = 'phase0_test_only'
$port = 55439

$bin = $env:PHASE0_PG_BIN
if (!$bin) {
  $pgCtl = Get-Command pg_ctl -ErrorAction SilentlyContinue
  if (!$pgCtl) { throw 'pg_ctl not found. Set PHASE0_PG_BIN to the PostgreSQL bin folder.' }
  $bin = Split-Path $pgCtl.Source
}
$data = $env:PHASE0_PG_DATA
if (!$data) { $data = Join-Path $repo '.phase0-test-pgdata' }

function Pg([string]$Tool) { Join-Path $bin "$Tool.exe" }

# The global pnpm shim can be broken (Node 24); corepack is always there.
function Pnpm([string[]]$Arguments) {
  if (Get-Command corepack -ErrorAction SilentlyContinue) { & corepack pnpm @Arguments } else { & pnpm @Arguments }
  if ($LASTEXITCODE -ne 0) { throw "pnpm failed: $($Arguments -join ' ')" }
}

function Set-IsolatedEnvironment {
  $env:PHASE0_ISOLATED_TEST = '1'
  $env:DATABASE_URL = "postgres://${user}:${password}@127.0.0.1:$port/$db"
  $env:PAYLOAD_MEDIA_DIR = $files
  $env:PRIVATE_DOCUMENTS_DIR = Join-Path $files 'private-documents'
  $env:PAYLOAD_SECRET = 'phase0-test-only-payload-secret-do-not-reuse'
  $env:PAYLOAD_SECRET_FILE = ''
  # dotenv 16 coerces the string 'false' to true; an empty value disables override.
  $env:DOTENV_CONFIG_OVERRIDE = ''
  $env:NODE_ENV = 'test'
}

function Test-Running {
  & (Pg 'pg_ctl') -D $data status *> $null
  return $LASTEXITCODE -eq 0
}

function Assert-Ready {
  $markerFile = Join-Path $files 'phase0-test-marker.txt'
  if (!(Test-Path -LiteralPath $markerFile)) { throw 'Private-file marker missing. Run Start first.' }
  if (!(Test-Running)) { throw "Test cluster is not running ($data). Run Start first." }
  $env:PGPASSWORD = $password
  $marker = & (Pg 'psql') -h 127.0.0.1 -p $port -U $user -d $db -Atqc 'SELECT marker FROM public.phase0_test_guard WHERE id = 1'
  if ($LASTEXITCODE -ne 0 -or "$marker".Trim() -ne $expectedMarker) { throw 'Database marker missing or mismatched.' }
}

Set-Location -LiteralPath $repo
switch ($Action) {
  'Start' {
    New-Item -ItemType Directory -Force -Path (Join-Path $files 'private-documents') | Out-Null
    Set-Content -LiteralPath (Join-Path $files 'phase0-test-marker.txt') -Value $expectedMarker -NoNewline
    $fresh = !(Test-Path -LiteralPath (Join-Path $data 'PG_VERSION'))
    if ($fresh) {
      $pwFile = New-TemporaryFile
      try {
        Set-Content -LiteralPath $pwFile -Value $password -NoNewline
        & (Pg 'initdb') -D $data -U $user --pwfile=$pwFile -A scram-sha-256 -E UTF8 --locale=C | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'initdb failed.' }
      } finally { Remove-Item -LiteralPath $pwFile -Force }
      Add-Content -LiteralPath (Join-Path $data 'postgresql.conf') "port = $port`nlisten_addresses = '127.0.0.1'"
    }
    if (!(Test-Running)) {
      # Detached: pg_ctl keeps its output pipe open, which hangs a non-interactive shell.
      Start-Process -FilePath (Pg 'pg_ctl') -ArgumentList @('-D', $data, '-l', (Join-Path $data 'server.log'), 'start') -WindowStyle Hidden
      for ($i = 0; $i -lt 30 -and !(Test-Running); $i++) { Start-Sleep -Milliseconds 500 }
      if (!(Test-Running)) { throw "Test cluster did not start; see $(Join-Path $data 'server.log')." }
      Start-Sleep -Seconds 1
    }
    $env:PGPASSWORD = $password
    $exists = & (Pg 'psql') -h 127.0.0.1 -p $port -U $user -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '$db'"
    if ("$exists".Trim() -ne '1') {
      & (Pg 'createdb') -h 127.0.0.1 -p $port -U $user $db
      & (Pg 'psql') -h 127.0.0.1 -p $port -U $user -d $db -q -v ON_ERROR_STOP=1 -f (Join-Path $repo 'scripts/phase0-test-db-init.sql')
      if ($LASTEXITCODE -ne 0) { throw 'Guard marker load failed.' }
      Write-Output 'New test database: run Migrate next.'
    }
    Assert-Ready
    Write-Output "Isolated Postgres is ready on 127.0.0.1:$port ($data)."
  }
  'Migrate' {
    Set-IsolatedEnvironment
    Assert-Ready
    Pnpm @('--filter', '@dacho/frontend', 'payload', 'migrate')
    Pnpm @('--filter', '@dacho/backend', 'migrate')
  }
  'Frontend' {
    Set-IsolatedEnvironment
    Assert-Ready
    Pnpm @('--filter', '@dacho/frontend', 'test:int')
  }
  'Backend' {
    Set-IsolatedEnvironment
    Assert-Ready
    Pnpm @('--filter', '@dacho/backend', 'test:int')
  }
  'Env' {
    # For a bash shell: eval "$(pwsh -File scripts/phase0-test-local.ps1 Env)" or copy the lines.
    Set-IsolatedEnvironment
    foreach ($name in 'PHASE0_ISOLATED_TEST', 'DATABASE_URL', 'PAYLOAD_MEDIA_DIR', 'PRIVATE_DOCUMENTS_DIR', 'PAYLOAD_SECRET', 'PAYLOAD_SECRET_FILE', 'DOTENV_CONFIG_OVERRIDE', 'NODE_ENV') {
      $value = (Get-Item "env:$name").Value -replace '\\', '/'
      Write-Output "export $name='$value'"
    }
  }
  'Status' {
    if (Test-Running) { Write-Output "Running on 127.0.0.1:$port ($data)." } else { Write-Output "Stopped ($data)." }
  }
  'Stop' { & (Pg 'pg_ctl') -D $data stop -m fast }
}
