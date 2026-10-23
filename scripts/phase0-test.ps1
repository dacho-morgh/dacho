param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Start', 'Migrate', 'Backend', 'Frontend', 'Backup', 'RestoreRehearsal', 'Stop', 'Status')]
  [string]$Action
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$compose = Join-Path $repo 'docker-compose.test.yml'
$files = Join-Path $repo '.phase0-test-files'
$backups = Join-Path $repo '.phase0-test-backups'
$expectedMarker = 'dacho-phase0-disposable-v1'
$db = 'dacho_phase0_test'
$restoreDb = 'dacho_phase0_restore'

function Compose([string[]]$Arguments) {
  & docker compose -f $compose -p dacho-phase0-test @Arguments
  if ($LASTEXITCODE -ne 0) { throw "docker compose failed: $($Arguments -join ' ')" }
}

function Set-IsolatedEnvironment {
  $env:PHASE0_ISOLATED_TEST = '1'
  $env:DATABASE_URL = 'postgres://phase0_test:phase0_test_only@127.0.0.1:55439/dacho_phase0_test'
  $env:PAYLOAD_MEDIA_DIR = $files
  $env:PAYLOAD_SECRET = 'phase0-test-only-payload-secret-do-not-reuse'
  $env:PAYLOAD_SECRET_FILE = ''
  # dotenv 16 coerces the string 'false' to true; an empty value disables override.
  $env:DOTENV_CONFIG_OVERRIDE = ''
  $env:NODE_ENV = 'test'
}

function Assert-Ready {
  $markerFile = Join-Path $files 'phase0-test-marker.txt'
  if (!(Test-Path -LiteralPath $markerFile)) { throw 'Dedicated private-file marker missing. Run Start first.' }
  if ((Get-Content -LiteralPath $markerFile -Raw).Trim() -ne $expectedMarker) {
    throw 'Dedicated private-file marker mismatch.'
  }
  $marker = & docker compose -f $compose -p dacho-phase0-test exec -T postgres `
    psql -U phase0_test -d $db -Atqc 'SELECT marker FROM public.phase0_test_guard WHERE id = 1'
  if ($LASTEXITCODE -ne 0 -or $marker.Trim() -ne $expectedMarker) {
    throw 'Dedicated database marker missing or mismatched.'
  }
}

Set-Location -LiteralPath $repo
switch ($Action) {
  'Start' {
    New-Item -ItemType Directory -Force -Path $files | Out-Null
    Set-Content -LiteralPath (Join-Path $files 'phase0-test-marker.txt') -Value $expectedMarker -NoNewline
    Compose @('up', '-d', '--wait')
    Assert-Ready
    Write-Output 'Phase 0 isolated Postgres and file directory are ready.'
  }
  'Migrate' {
    Set-IsolatedEnvironment
    Assert-Ready
    & pnpm --filter @dacho/frontend payload migrate
    if ($LASTEXITCODE -ne 0) { throw 'CMS migration failed.' }
    & pnpm --filter @dacho/backend migrate
    if ($LASTEXITCODE -ne 0) { throw 'Dashboard migration failed.' }
  }
  'Backend' {
    Set-IsolatedEnvironment
    Assert-Ready
    & pnpm --filter @dacho/backend test:int
    if ($LASTEXITCODE -ne 0) { throw 'Backend integration suite failed.' }
  }
  'Frontend' {
    Set-IsolatedEnvironment
    Assert-Ready
    & pnpm --filter @dacho/frontend test:int
    if ($LASTEXITCODE -ne 0) { throw 'Frontend integration suite failed.' }
  }
  'Backup' {
    Assert-Ready
    New-Item -ItemType Directory -Force -Path $backups | Out-Null
    $syntheticFile = Join-Path $files 'backup-roundtrip.txt'
    Set-Content -LiteralPath $syntheticFile -Value 'phase0-synthetic-file-v1' -NoNewline
    $seedSql = "CREATE TABLE IF NOT EXISTS public.phase0_backup_roundtrip (id text PRIMARY KEY, value text NOT NULL); INSERT INTO public.phase0_backup_roundtrip (id, value) VALUES ('phase0-rehearsal', 'phase0-synthetic-row-v1') ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;"
    Compose @('exec', '-T', 'postgres', 'psql', '-U', 'phase0_test', '-d', $db, '-v', 'ON_ERROR_STOP=1', '-c', $seedSql)
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $dumpName = "phase0-$stamp.dump"
    Compose @('exec', '-T', 'postgres', 'pg_dump', '-U', 'phase0_test', '-d', $db, '-Fc', '-f', "/tmp/$dumpName")
    & docker compose -f $compose -p dacho-phase0-test cp "postgres:/tmp/$dumpName" (Join-Path $backups $dumpName)
    if ($LASTEXITCODE -ne 0) { throw 'Database dump copy failed.' }
    $fileArchive = Join-Path $backups "phase0-$stamp-files.zip"
    Compress-Archive -LiteralPath $files -DestinationPath $fileArchive
    Write-Output "Database: $(Join-Path $backups $dumpName)"
    Write-Output "Files: $fileArchive"
    Write-Output "Synthetic file SHA-256: $((Get-FileHash -LiteralPath $syntheticFile -Algorithm SHA256).Hash)"
  }
  'RestoreRehearsal' {
    Assert-Ready
    $dump = Get-ChildItem -LiteralPath $backups -Filter 'phase0-*.dump' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (!$dump) { throw 'No isolated backup found. Run Backup first.' }
    $archive = Join-Path $backups ($dump.BaseName + '-files.zip')
    if (!(Test-Path -LiteralPath $archive)) { throw 'Matching file archive missing.' }
    $safeName = $dump.Name
    & docker compose -f $compose -p dacho-phase0-test cp $dump.FullName "postgres:/tmp/$safeName"
    if ($LASTEXITCODE -ne 0) { throw 'Database dump transfer failed.' }
    # Only the fixed rehearsal database is touched; the working test DB stays intact.
    Compose @('exec', '-T', 'postgres', 'dropdb', '-U', 'phase0_test', '--if-exists', $restoreDb)
    Compose @('exec', '-T', 'postgres', 'createdb', '-U', 'phase0_test', $restoreDb)
    Compose @('exec', '-T', 'postgres', 'pg_restore', '-U', 'phase0_test', '-d', $restoreDb, '--no-owner', '--no-privileges', "/tmp/$safeName")
    $restoredMarker = & docker compose -f $compose -p dacho-phase0-test exec -T postgres `
      psql -U phase0_test -d $restoreDb -Atqc 'SELECT marker FROM public.phase0_test_guard WHERE id = 1'
    if ($LASTEXITCODE -ne 0 -or $restoredMarker.Trim() -ne $expectedMarker) { throw 'Restored database marker mismatch.' }
    $restoredRow = & docker compose -f $compose -p dacho-phase0-test exec -T postgres `
      psql -U phase0_test -d $restoreDb -Atqc "SELECT value FROM public.phase0_backup_roundtrip WHERE id = 'phase0-rehearsal'"
    if ($LASTEXITCODE -ne 0 -or $restoredRow.Trim() -ne 'phase0-synthetic-row-v1') {
      throw 'Synthetic database row did not survive restore.'
    }
    $rehearsalFiles = Join-Path $backups 'restored-files'
    if (Test-Path -LiteralPath $rehearsalFiles) {
      $resolved = (Resolve-Path -LiteralPath $rehearsalFiles).Path
      if (!$resolved.StartsWith($backups + [IO.Path]::DirectorySeparatorChar)) { throw 'Unsafe rehearsal file path.' }
      Remove-Item -LiteralPath $rehearsalFiles -Recurse -Force
    }
    Expand-Archive -LiteralPath $archive -DestinationPath $rehearsalFiles
    $restoredFileMarker = Get-ChildItem -LiteralPath $rehearsalFiles -Filter 'phase0-test-marker.txt' -Recurse -File | Select-Object -First 1
    if (!$restoredFileMarker -or (Get-Content -LiteralPath $restoredFileMarker.FullName -Raw).Trim() -ne $expectedMarker) {
      throw 'Restored file marker mismatch.'
    }
    $restoredSyntheticFile = Get-ChildItem -LiteralPath $rehearsalFiles -Filter 'backup-roundtrip.txt' -Recurse -File | Select-Object -First 1
    if (!$restoredSyntheticFile) { throw 'Synthetic file missing from restore.' }
    $sourceHash = (Get-FileHash -LiteralPath (Join-Path $files 'backup-roundtrip.txt') -Algorithm SHA256).Hash
    $restoredHash = (Get-FileHash -LiteralPath $restoredSyntheticFile.FullName -Algorithm SHA256).Hash
    if ($sourceHash -ne $restoredHash) { throw 'Synthetic file SHA-256 mismatch.' }
    Write-Output "Restore rehearsal passed: $restoreDb row=phase0-synthetic-row-v1 file-sha256=$restoredHash"
  }
  'Stop' { Compose @('stop') }
  'Status' { Compose @('ps') }
}
