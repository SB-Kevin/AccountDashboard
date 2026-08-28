#Requires -Version 5.1
<#
.SYNOPSIS
  Provisions a Prisma Postgres database and deploys this app to Vercel.

.DESCRIPTION
  Run this from the root of a local clone of the repo (where package.json lives).
  It will:
    1. Create a Prisma Postgres project + database via the Management API.
    2. Create (or reuse) a Vercel project and push DATABASE_URL / CRON_SECRET to it.
    3. Deploy to Vercel (production). The build step itself runs
       `prisma generate && prisma db push` against DATABASE_URL, so the schema
       is applied on Vercel's servers - this avoids relying on your local
       network being able to reach the database directly (many networks block
       outbound Postgres' port 5432 even though HTTPS/443 works fine).
    4. Push THREADS_REDIRECT_URI / NEXT_PUBLIC_APP_URL, which depend on the
       assigned Vercel URL, then redeploy once more so they take effect.

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
# PowerShell 7.3+ treats ANY stderr output from a native command (even a
# harmless npm deprecation warning) as a terminating error when combined with
# $ErrorActionPreference = "Stop". Turn that off and check $LASTEXITCODE
# ourselves instead, so only real (non-zero exit code) failures stop the script.
$PSNativeCommandUseErrorActionPreference = $false

function Write-Step($message) {
    Write-Host ""
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Invoke-Checked {
    param(
        [string]$Description,
        [scriptblock]$Command
    )
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed (exit code $LASTEXITCODE). See output above."
    }
}

function Invoke-PrismaApi {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body
    )
    $uri = "https://api.prisma.io/v1$Path"
    $headers = @{ Authorization = "Bearer $PrismaServiceToken" }
    try {
        if ($Body) {
            return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers `
                -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 10)
        }
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
    }
    catch {
        $responseBody = $null
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $responseBody = $_.ErrorDetails.Message
        }
        elseif ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
        }
        throw "Prisma API $Method $Path failed: $($_.Exception.Message)`n$responseBody"
    }
}

function Set-VercelEnvVar {
    param(
        [string]$Name,
        [string]$Value,
        [string]$Target = "production"
    )
    Invoke-Checked "Set Vercel env var $Name" {
        vercel env add $Name $Target --value $Value --force --yes `
            --project $ProjectName --token $VercelToken | Out-Null
    }
    Write-Host "  set $Name ($Target)"
}

if (-not (Test-Path "package.json") -or -not (Test-Path "prisma/schema.prisma")) {
    throw "Run this script from the root of the AccountDashboard repo clone (package.json / prisma/schema.prisma not found here)."
}

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Step "Installing the Vercel CLI globally"
    # `npx vercel ...` re-resolves the package on every call and can fail with
    # "could not determine executable to run" if that resolution cache gets
    # interrupted (e.g. by a previous run stopping mid-command). A one-time
    # global install avoids that fragile path entirely.
    Invoke-Checked "npm install -g vercel" { npm install -g vercel }
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

Write-Step "Writing DATABASE_URL to .env (for optional local dev)"
$envPath = ".env"
$envLines = if (Test-Path $envPath) { Get-Content $envPath } else { @() }
$envLines = $envLines | Where-Object { $_ -notmatch "^DATABASE_URL=" }
$envLines += "DATABASE_URL=`"$connectionString`""
$envLines | Set-Content $envPath
Write-Host "  .env updated"

Write-Step "Creating the Vercel project (schema is applied by the build step, not from here)"
& vercel project add $ProjectName --token $VercelToken 2>&1 | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
    Write-Host "  project add reported an error above - continuing, it may already exist from a previous run"
}

$cronSecret = [guid]::NewGuid().ToString("N")

Write-Step "Setting Vercel environment variables (pass 1)"
Set-VercelEnvVar -Name "DATABASE_URL" -Value $connectionString
Set-VercelEnvVar -Name "CRON_SECRET" -Value $cronSecret
Write-Host "  THREADS_APP_ID / THREADS_APP_SECRET left unset - add these later once you have a Meta App"

Write-Step "Deploying to Vercel (pass 1)"
$deployOutputRaw = & vercel deploy --prod --yes --project $ProjectName --token $VercelToken 2>&1
$deployOutputRaw | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
    throw "Vercel deploy failed (exit code $LASTEXITCODE). See output above - if it's a prisma db push error, your schema may have a real problem."
}
$deployUrl = ($deployOutputRaw | Select-String -Pattern "https://\S+\.vercel\.app" | Select-Object -Last 1).Matches[0].Value
if (-not $deployUrl) {
    throw "Could not determine the deployment URL from the Vercel output above."
}
Write-Host "  deployed to $deployUrl"

Write-Step "Setting URL-dependent environment variables (pass 2)"
Set-VercelEnvVar -Name "NEXT_PUBLIC_APP_URL" -Value $deployUrl
Set-VercelEnvVar -Name "THREADS_REDIRECT_URI" -Value "$deployUrl/api/auth/threads/callback"

Write-Step "Redeploying so the new environment variables take effect"
Invoke-Checked "Vercel redeploy" {
    vercel deploy --prod --yes --project $ProjectName --token $VercelToken
}

Write-Step "Done"
Write-Host "Dashboard: $deployUrl/dashboard" -ForegroundColor Green
Write-Host "Prisma Postgres console: https://console.prisma.io" -ForegroundColor Green
Write-Host ""
Write-Host "Once you have a Meta App, add THREADS_APP_ID and THREADS_APP_SECRET with:"
Write-Host "  vercel env add THREADS_APP_ID production --value `"<id>`" --force --yes --project $ProjectName --token <token>"
Write-Host "  vercel env add THREADS_APP_SECRET production --value `"<secret>`" --force --yes --project $ProjectName --token <token>"
Write-Host "then redeploy: vercel deploy --prod --yes --project $ProjectName --token <token>"
