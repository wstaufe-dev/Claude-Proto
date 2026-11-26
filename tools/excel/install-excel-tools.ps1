# Claude-Proto: Install Excel Tools
#
# Opens the math workbook in a hidden Excel, imports tools\excel\ProtoTools.bas,
# runs InstallToolButtons (Tools tab), adds an empty Sim Results tab, and saves
# math\Proto_v2.xlsm. If Proto_v2.xlsm already exists, it refreshes the macros
# in it instead. Run it through "Install Excel Tools.bat".

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bas  = Join-Path $root 'tools\excel\ProtoTools.bas'
$xlsx = Join-Path $root 'math\Proto_v2.xlsx'
$xlsm = Join-Path $root 'math\Proto_v2.xlsm'

function Say($msg)  { Write-Host "  $msg" }
function Fail($msg) { Write-Host ""; Write-Host "  $msg" -ForegroundColor Red; exit 1 }

if (-not (Test-Path $bas)) { Fail "Can't find $bas" }
if (Test-Path $xlsm)     { $src = $xlsm; $updating = $true }
elseif (Test-Path $xlsx) { $src = $xlsx; $updating = $false }
else { Fail "Can't find math\Proto_v2.xlsx or math\Proto_v2.xlsm" }

# Excel must be closed: an open copy locks the file, and Excel reads the trust setting at startup.
while (Get-Process EXCEL -ErrorAction SilentlyContinue) {
  Write-Host ""
  Read-Host "  Excel is still running. Close all Excel windows (check Task Manager if none are visible), then press Enter"
}

# Find the installed Excel version (16.0 for Microsoft 365, 2016, 2019 and 2021).
$curVer = (Get-ItemProperty 'Registry::HKEY_CLASSES_ROOT\Excel.Application\CurVer' -ErrorAction SilentlyContinue).'(default)'
if (-not $curVer) { Fail "Excel doesn't seem to be installed on this computer." }
$ver    = ($curVer -replace '^Excel\.Application\.', '') + '.0'
$secKey = "HKCU:\Software\Microsoft\Office\$ver\Excel\Security"
$polKey = "HKCU:\Software\Policies\Microsoft\Office\$ver\Excel\Security"

# "Trust access to the VBA project object model" lets this script add macros.
$policy = (Get-ItemProperty $polKey -Name AccessVBOM -ErrorAction SilentlyContinue).AccessVBOM
if ($policy -eq 0) {
  Fail ("Your company policy blocks programs from adding macros to workbooks. " +
        "Add them by hand instead: see 'Adding the macros to the workbook' in README.md.")
}
$oldTrust = (Get-ItemProperty $secKey -Name AccessVBOM -ErrorAction SilentlyContinue).AccessVBOM
$changedTrust = $false
if ($oldTrust -ne 1 -and $policy -ne 1) {
  Write-Host ""
  Say "Excel's 'Trust access to the VBA project object model' setting is off."
  $answer = Read-Host "  Turn it on just while this runs, and back off afterwards? (Y/N)"
  if ($answer -notmatch '^[Yy]') { Fail "Stopped. Nothing was changed." }
  if (-not (Test-Path $secKey)) { New-Item $secKey -Force | Out-Null }
  Set-ItemProperty $secKey -Name AccessVBOM -Value 1 -Type DWord
  $changedTrust = $true
}

$excel = $null
$wb = $null
$ok = $false
try {
  Write-Host ""
  Say "Opening $(Split-Path $src -Leaf) in Excel (hidden)..."
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open($src)

  try { $comps = $wb.VBProject.VBComponents }
  catch {
    throw ("Excel refused access to the workbook's macros. In Excel: File > Options > Trust Center > " +
           "Trust Center Settings > Macro Settings, tick 'Trust access to the VBA project object model', then run this again.")
  }

  # Replace any earlier copy of the module, then import the current one.
  for ($i = $comps.Count; $i -ge 1; $i--) {
    $c = $comps.Item($i)
    if ($c.Name -eq 'ProtoTools') { $comps.Remove($c) }
  }
  Say "Importing macros from tools\excel\ProtoTools.bas..."
  $comps.Import($bas) | Out-Null

  Say "Creating the Tools tab and its buttons..."
  $excel.Run("'$($wb.Name)'!InstallToolButtons")

  $names = @()
  foreach ($s in $wb.Worksheets) { $names += $s.Name }
  if ($names -notcontains 'Sim Results') {
    Say "Creating the Sim Results tab..."
    $last = $wb.Worksheets.Item($wb.Worksheets.Count)
    $ws = $wb.Worksheets.Add([Type]::Missing, $last)
    $ws.Name = 'Sim Results'
    $ws.Range('A1').Value2 = 'Run "Run Simulation.bat", then click Import Sim Results on the Tools tab.'
  }
  $wb.Worksheets.Item('Tools').Activate()

  if ($updating) {
    $wb.Save()
  } else {
    $wb.SaveAs($xlsm, 52)   # 52 = Excel Macro-Enabled Workbook (.xlsm)
  }
  $ok = $true
}
catch {
  Write-Host ""
  Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
}
finally {
  if ($wb)    { $wb.Close($false) | Out-Null }
  if ($excel) {
    $excel.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
  if ($changedTrust) {
    if ($null -eq $oldTrust) { Remove-ItemProperty $secKey -Name AccessVBOM -ErrorAction SilentlyContinue }
    else { Set-ItemProperty $secKey -Name AccessVBOM -Value $oldTrust -Type DWord }
    Say "Turned the trust setting back off."
  }
}
if (-not $ok) { exit 1 }

Write-Host ""
Write-Host "  Saved math\Proto_v2.xlsm with the Tools and Sim Results tabs." -ForegroundColor Green

# Check that the exporter can read the new workbook (writes to a temp file; the project is not changed).
if ((Get-Command npm.cmd -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host ""
  Say "Checking the exporter can read it..."
  Push-Location $root
  & npm.cmd run -s export-config -- "$xlsm" "$env:TEMP\claude-proto-check.json"
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -eq 0) { Write-Host "  The exporter read it correctly." -ForegroundColor Green }
  else { Write-Host "  The exporter could not read it. See the messages above." -ForegroundColor Red }
} else {
  Say "(Skipped the exporter check: run Setup.bat first if you want it.)"
}

if (-not $updating) {
  Write-Host ""
  Say "Next: upload math\Proto_v2.xlsm to GitHub (repository page > Add file > Upload files, into the math folder)."
}
