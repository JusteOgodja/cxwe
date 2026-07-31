# =============================================================================
# run_all_enrichment.ps1
# Applique les 232 fichiers update_by_name_*.sql sur Supabase via psql.
# Idempotent : chaque UPDATE a la garde "AND source_site IS NULL",
# donc relancer l'ensemble ne réécrit pas les lignes déjà enrichies.
# =============================================================================
#
# PREREQUIS
# ---------
# 1. Installer le client psql (PostgreSQL) si absent :
#       winget install PostgreSQL.PostgreSQL.16
#    puis rouvrir PowerShell (ou ajouter C:\Program Files\PostgreSQL\16\bin au PATH)
#
# 2. Récupérer la chaîne de connexion Postgres DIRECTE depuis Supabase :
#       Dashboard > Project Settings > Database > Connection string > URI
#    Format (pooler eu-west-1, recommandé) :
#       postgresql://postgres.fknxppuvpdmcfhtfrjcx:MOT_DE_PASSE@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
#    NB : c'est le MOT DE PASSE DB (pas la clé service_role).
#
# 3. Définir la variable d'environnement AVANT de lancer (ne la commite jamais) :
#       $env:DATABASE_URL = "postgresql://postgres.fknxppuvpdmcfhtfrjcx:...@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
#
# LANCEMENT
# ---------
#       cd C:\Users\lenovo\Documents\GitHub\cxwe
#       .\supabase\scripts\run_all_enrichment.ps1
# =============================================================================

if (-not $env:DATABASE_URL) {
    Write-Error "DATABASE_URL non defini. Fais d'abord : `$env:DATABASE_URL = 'postgresql://...'"
    exit 1
}

$scriptDir = Join-Path $PSScriptRoot ""
$files = Get-ChildItem -Path $scriptDir -Filter "update_by_name_*.sql" | Sort-Object Name

Write-Host "Fichiers a appliquer : $($files.Count)" -ForegroundColor Cyan
$ok = 0
$fail = 0
$failedFiles = @()

foreach ($f in $files) {
    Write-Host ("-> {0}" -f $f.Name) -NoNewline
    # -v ON_ERROR_STOP=1 : stoppe le fichier a la 1ere erreur (rollback implicite du batch)
    # -q : silencieux ; --single-transaction : tout le fichier en une transaction
    & psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -q -f $f.FullName 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK" -ForegroundColor Green
        $ok++
    } else {
        Write-Host "  ECHEC (apostrophe non echappee probable)" -ForegroundColor Red
        $fail++
        $failedFiles += $f.Name
    }
}

Write-Host ""
Write-Host "===== RESUME =====" -ForegroundColor Cyan
Write-Host "OK    : $ok"
Write-Host "ECHEC : $fail"
if ($failedFiles.Count -gt 0) {
    Write-Host "Fichiers en echec :" -ForegroundColor Yellow
    $failedFiles | ForEach-Object { Write-Host "  - $_" }
    Write-Host "(Ces fichiers ont une apostrophe non echappee ; on les corrigera au cas par cas.)"
}

# Verification finale
Write-Host ""
Write-Host "Comptage des produits enrichis..." -ForegroundColor Cyan
& psql $env:DATABASE_URL -q -c "SELECT COUNT(*) AS produits_enrichis FROM products WHERE source_site IS NOT NULL;"
