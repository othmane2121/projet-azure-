# ================================================================
# SUPPORTDESK - Script deploiement TOUT EN UN
# Une seule Web App qui sert tout :
#   / = page d'accueil
#   /user = portail utilisateur
#   /admin = portail admin
#   /api/* = API backend
# ================================================================

# === MODIFIER CES VALEURS =====================================
$SQL_PASSWORD = "VotreMotDePasseSQL123!"
$SMTP_USER    = "youremail679@gmail.com"
$SMTP_PASS    = "rqvcljkkiahxqetc"
$PROJECT_PATH = "C:\Users\hp\Desktop\projet\support-tickets"
# ==============================================================

$RESOURCE_GROUP = "rg-support-tickets"
$SQL_SERVER     = "support-tickets-sql"
$SQL_DB         = "SupportTicketsDB"
$SQL_USER       = "sqladmin"
$APP_NAME       = "support-tickets-api"
$PLAN_NAME      = "asp-support-tickets"
$APP_URL        = "https://$APP_NAME.azurewebsites.net"

function Write-Step($msg) {
    Write-Host ""
    Write-Host "======================================" -ForegroundColor Blue
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Blue
}
function Write-OK($msg)   { Write-Host "[OK] $msg"   -ForegroundColor Green  }
function Write-ERR($msg)  { Write-Host "[ERR] $msg"  -ForegroundColor Red    }
function Write-INFO($msg) { Write-Host "[INFO] $msg" -ForegroundColor Yellow }

# ================================================================
# ETAPE 1 - Preparer la structure du projet unifie
# ================================================================
Write-Step "ETAPE 1 - Preparation structure unifiee"

$BUILD_DIR = "$PROJECT_PATH\build"

# Creer le dossier de build
Remove-Item $BUILD_DIR -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path "$BUILD_DIR\public\user-portal" -Force | Out-Null
New-Item -ItemType Directory -Path "$BUILD_DIR\public\admin-portal" -Force | Out-Null

# Copier server.js et package.json dans build
Copy-Item "$PROJECT_PATH\backend\server.js"       "$BUILD_DIR\server.js"
Copy-Item "$PROJECT_PATH\backend\package.json"    "$BUILD_DIR\package.json"
Copy-Item "$PROJECT_PATH\backend\package-lock.json" "$BUILD_DIR\package-lock.json" -ErrorAction SilentlyContinue

# Copier les fichiers frontend
Copy-Item "$PROJECT_PATH\frontend\index.html"              "$BUILD_DIR\public\index.html"
Copy-Item "$PROJECT_PATH\frontend\user-portal\index.html"  "$BUILD_DIR\public\user-portal\index.html"
Copy-Item "$PROJECT_PATH\frontend\admin-portal\index.html" "$BUILD_DIR\public\admin-portal\index.html"

Write-OK "Structure creee dans $BUILD_DIR"
Write-INFO "Contenu du build :"
Get-ChildItem $BUILD_DIR -Recurse | Select-Object FullName

# ================================================================
# ETAPE 2 - Remplacer l'URL API dans les frontends
# ================================================================
Write-Step "ETAPE 2 - Mise a jour URL API dans les frontends"

$userFile  = "$BUILD_DIR\public\user-portal\index.html"
$adminFile = "$BUILD_DIR\public\admin-portal\index.html"

# Remplacer localhost par l'URL Azure dans les deux fichiers
(Get-Content $userFile)  -replace "http://localhost:3001/api", "/api" | Set-Content $userFile
(Get-Content $adminFile) -replace "http://localhost:3001/api", "/api" | Set-Content $adminFile
(Get-Content $userFile)  -replace "https://support-tickets-api.azurewebsites.net/api", "/api" | Set-Content $userFile
(Get-Content $adminFile) -replace "https://support-tickets-api.azurewebsites.net/api", "/api" | Set-Content $adminFile

Write-OK "URL API remplacee par /api dans les deux portails"

# ================================================================
# ETAPE 3 - Installer les dependances
# ================================================================
Write-Step "ETAPE 3 - Installation dependances Node.js"
Set-Location $BUILD_DIR
npm install --silent 2>&1 | Out-Null
Write-OK "node_modules installe"

# ================================================================
# ETAPE 4 - Creer le ZIP de deploiement
# ================================================================
Write-Step "ETAPE 4 - Creation ZIP"
Set-Location $PROJECT_PATH
Remove-Item "$PROJECT_PATH\full-deploy.zip" -Force -ErrorAction SilentlyContinue

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($BUILD_DIR, "$PROJECT_PATH\full-deploy.zip")

$size = (Get-Item "$PROJECT_PATH\full-deploy.zip").Length / 1MB
Write-OK "ZIP cree : $([math]::Round($size,1)) MB"

# ================================================================
# ETAPE 5 - Connexion Azure
# ================================================================
Write-Step "ETAPE 5 - Connexion Azure"
az account show --output table 2>$null
if ($LASTEXITCODE -ne 0) { az login }
Write-OK "Connecte a Azure"

# ================================================================
# ETAPE 6 - Verifier que l'App Service existe
# ================================================================
Write-Step "ETAPE 6 - Verification App Service"
$appExists = az webapp show --name $APP_NAME --resource-group $RESOURCE_GROUP --query "name" --output tsv 2>$null
if ($appExists -ne $APP_NAME) {
    Write-ERR "App Service $APP_NAME introuvable"
    Write-INFO "Creez d'abord l'App Service avec deploy_final.ps1"
    exit 1
}
Write-OK "App Service $APP_NAME trouve"

# ================================================================
# ETAPE 7 - Configurer les variables d'environnement
# ================================================================
Write-Step "ETAPE 7 - Variables environnement"

$JWT = node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $APP_NAME --settings DB_SERVER="$SQL_SERVER.database.windows.net" 2>&1 | Out-Null
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $APP_NAME --settings DB_NAME="$SQL_DB" 2>&1 | Out-Null
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $APP_NAME --settings DB_USER="$SQL_USER" 2>&1 | Out-Null
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $APP_NAME --settings DB_PASSWORD="$SQL_PASSWORD" 2>&1 | Out-Null
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $APP_NAME --settings JWT_SECRET="$JWT" 2>&1 | Out-Null
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $APP_NAME --settings SMTP_HOST="smtp.gmail.com" 2>&1 | Out-Null
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $APP_NAME --settings SMTP_USER="$SMTP_USER" 2>&1 | Out-Null
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $APP_NAME --settings SMTP_PASS="$SMTP_PASS" 2>&1 | Out-Null
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $APP_NAME --settings NODE_ENV="production" 2>&1 | Out-Null
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $APP_NAME --settings PORT="3001" 2>&1 | Out-Null
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $APP_NAME --settings APP_URL="$APP_URL" 2>&1 | Out-Null
az webapp config appsettings set --resource-group $RESOURCE_GROUP --name $APP_NAME --settings SCM_DO_BUILD_DURING_DEPLOYMENT="true" 2>&1 | Out-Null

Write-OK "Variables configurees"

# ================================================================
# ETAPE 8 - Configurer le demarrage
# ================================================================
Write-Step "ETAPE 8 - Commande demarrage"
az webapp config set --resource-group $RESOURCE_GROUP --name $APP_NAME --startup-file "node server.js" 2>&1 | Out-Null
Write-OK "Startup : node server.js"

# ================================================================
# ETAPE 9 - Deployer via az webapp up
# ================================================================
Write-Step "ETAPE 9 - Deploiement"
Set-Location $BUILD_DIR

Write-INFO "Deploiement en cours (2-3 minutes)..."
az webapp up `
    --name $APP_NAME `
    --resource-group $RESOURCE_GROUP `
    --os-type linux `
    --sku S2 `
    --runtime "NODE:22-lts"

if ($LASTEXITCODE -eq 0) {
    Write-OK "Deploiement reussi"
} else {
    Write-ERR "Erreur deploiement - verification des logs..."
    az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME
    exit 1
}

# ================================================================
# ETAPE 10 - Test
# ================================================================
Write-Step "ETAPE 10 - Tests"
Write-INFO "Attente demarrage (45 secondes)..."
Start-Sleep -Seconds 45

$maxTry = 6
$ok = $false
for ($i = 1; $i -le $maxTry; $i++) {
    Write-INFO "Test $i/$maxTry..."
    try {
        $r = Invoke-WebRequest -Uri "$APP_URL/health" -UseBasicParsing -TimeoutSec 15
        if ($r.StatusCode -eq 200) {
            Write-OK "API repond : $($r.Content)"
            $ok = $true
            break
        }
    } catch {
        if ($i -lt $maxTry) { Start-Sleep -Seconds 20 }
    }
}

if (-not $ok) { Write-ERR "API ne repond pas encore - attendez 2 min et testez manuellement" }

# ================================================================
# RESUME
# ================================================================
Set-Location $PROJECT_PATH
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   DEPLOIEMENT TERMINE !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Page d'accueil :" -ForegroundColor White
Write-Host "  $APP_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Portail Utilisateur :" -ForegroundColor White
Write-Host "  $APP_URL/user" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Portail Admin :" -ForegroundColor White
Write-Host "  $APP_URL/admin" -ForegroundColor Cyan
Write-Host ""
Write-Host "  API Backend :" -ForegroundColor White
Write-Host "  $APP_URL/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Connexion agents demo :" -ForegroundColor White
Write-Host "  Email : sophie.martin@support.com" -ForegroundColor Yellow
Write-Host "  Pass  : Support2024!" -ForegroundColor Yellow
Write-Host ""