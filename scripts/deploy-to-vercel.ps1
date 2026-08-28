#Requires -Version 5.1
<#
.SYNOPSIS
  Provisions a Prisma Postgres database and deploys this app to Vercel.

.DESCRIPTION
  Run this from the root of a local clone of the repo (where package.json lives).
  It will:
    1. Create a Prisma Postgres project + database via the Management API.
    2. Write the connection string to .env and run prisma migrate dev.
    3. Deploy to Vercel (production), which creates the Vercel project on first run.
    4. Push the required env vars, then redeploy once more so
       THREADS_REDIRECT_URI / NEXT_PUBLIC_APP_URL (which depend on the assigned
       Vercel URL) take effect.

  THREADS_APP_ID / THREADS_APP_SECRET are intentionally left unset - add them
  later (via `vercel env add` or the Vercel dashboard) once you have a Meta App.

.PARAMETER PrismaServiceToken
  Service token from https://console.prisma.io -> Workspace Settings -> Service Tokens.

.PARAMETER VercelToken
  Token from https://vercel.com/account/tokens.

.PARAMETER ProjectName
  Name for both the Prisma Postgres project and the Vercel project. Defaults to
  the current folder name.

.PARAMETER Region
  Prisma Postgres region id (e.g. "us-east-1", "eu-west-1"). Defaults to us-east-1.

.EXAMPLE
  .\scripts\deploy-to-vercel.ps1 -PrismaServiceToken "eyJ..." -VercelToken "vcp_..."
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$PrismaServiceToken,

    [Parameter(Mandatory = $true)]
    [string]$VercelToken,

    [string]$ProjectName = (Split-Path -Leaf (Get-Location)),

    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

function Write-Step($message) {
    Write-Host ""
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Invoke-PrismaApi {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body
    )
    $uri = "https://api.prisma.io/v1$Path"
    $headers = @{ Authorization = "Bearer $PrismaServiceToken" }
    if ($Body) {
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers `
            -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 10)
    }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
}

function Set-VercelEnvVar {
    param(
        [string]$Name,
        [string]$Value,
        [string]$Target = "production"
    )
    npx --yes vercel env add $Name $Target --value $Value --force --yes `
        --project $ProjectName --token $VercelToken | Out-Null
    Write-Host "  set $Name ($Target)"
}

if (-not (Test-Path "package.json") -or -not (Test-Path "prisma/schema.prisma")) {
    throw "Run this script from the root of the AccountDashboard repo clone (package.json / prisma/schema.prisma not found here)."
}

Write-Step "Creating Prisma Postgres project '$ProjectName' in $Region"
$project = (Invoke-PrismaApi -Method Post -Path "/projects" -Body @{
        name           = $ProjectName
        region         = $Region
        createDatabase = $true
    }).data

$databaseId = $project.database.id
$status = $project.database.status
while ($status -ne "ready") {
    Write-Host "  database status: $status, waiting..."
    Start-Sleep -Seconds 3
    $db = (Invoke-PrismaApi -Method Get -Path "/databases/$databaseId").data
    $status = $db.status
}
$connectionString = $project.database.connections[0].endpoints.direct.connectionString
Write-Host "  database ready"

Write-Step "Writing DATABASE_URL to .env"
$envPath = ".env"
$envLines = if (Test-Path $envPath) { Get-Content $envPath } else { @() }
$envLines = $envLines | Where-Object { $_ -notmatch "^DATABASE_URL=" }
$envLines += "DATABASE_URL=`"$connectionString`""
$envLines | Set-Content $envPath
Write-Host "  .env updated"

Write-Step "Installing dependencies"
npm install

Write-Step "Applying database schema (prisma migrate dev)"
npx prisma migrate dev --name init

$cronSecret = [guid]::NewGuid().ToString("N")

Write-Step "Deploying to Vercel (pass 1 - creates the project on first run)"
$deployOutputRaw = npx --yes vercel deploy --prod --yes --project $ProjectName --token $VercelToken 2>&1
$deployOutputRaw | ForEach-Object { Write-Host $_ }
$deployUrl = ($deployOutputRaw | Select-String -Pattern "https://\S+\.vercel\.app" | Select-Object -Last 1).Matches[0].Value
if (-not $deployUrl) {
    throw "Could not determine the deployment URL from the Vercel output above."
}
Write-Host "  deployed to $deployUrl"

Write-Step "Setting Vercel environment variables"
Set-VercelEnvVar -Name "DATABASE_URL" -Value $connectionString
Set-VercelEnvVar -Name "CRON_SECRET" -Value $cronSecret
Set-VercelEnvVar -Name "NEXT_PUBLIC_APP_URL" -Value $deployUrl
Set-VercelEnvVar -Name "THREADS_REDIRECT_URI" -Value "$deployUrl/api/auth/threads/callback"
Write-Host "  THREADS_APP_ID / THREADS_APP_SECRET left unset - add these later once you have a Meta App"

Write-Step "Redeploying so the new environment variables take effect"
npx --yes vercel deploy --prod --yes --project $ProjectName --token $VercelToken

Write-Step "Done"
Write-Host "Dashboard: $deployUrl/dashboard" -ForegroundColor Green
Write-Host "Prisma Postgres console: https://console.prisma.io" -ForegroundColor Green
Write-Host ""
Write-Host "Once you have a Meta App, add THREADS_APP_ID and THREADS_APP_SECRET with:"
Write-Host "  npx vercel env add THREADS_APP_ID production --value `"<id>`" --force --yes --project $ProjectName --token <token>"
Write-Host "  npx vercel env add THREADS_APP_SECRET production --value `"<secret>`" --force --yes --project $ProjectName --token <token>"
Write-Host "then redeploy: npx vercel deploy --prod --yes --project $ProjectName --token <token>"
