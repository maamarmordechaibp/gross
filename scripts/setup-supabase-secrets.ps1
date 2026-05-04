# =============================================================================
# setup-supabase-secrets.ps1 — One-time setup for the send-email Edge Function
# -----------------------------------------------------------------------------
# Usage (PowerShell, from project root):
#   1. Edit the two values below.
#   2. Run:  .\scripts\setup-supabase-secrets.ps1
# =============================================================================

# >>> EDIT THESE <<<
$ResendApiKey = 're_REPLACE_WITH_NEW_ROTATED_KEY'
$ResendFrom   = 'Gross Printing <orders@yourdomain.com>'
$ProjectRef   = 'zixcznlsmuincthlvtly'
# >>> END EDIT <<<

$ErrorActionPreference = 'Stop'
$cli = Join-Path $PSScriptRoot '..\.bin\supabase.exe'
if (-not (Test-Path $cli)) {
    Write-Error "Supabase CLI not found at $cli. Re-run the install step."
}

Write-Host "==> Logging in (browser will open; paste the code from the dashboard)"
& $cli login

Write-Host "==> Linking project $ProjectRef"
& $cli link --project-ref $ProjectRef

Write-Host "==> Setting secrets"
& $cli secrets set "RESEND_API_KEY=$ResendApiKey" --project-ref $ProjectRef
& $cli secrets set "RESEND_FROM=$ResendFrom"      --project-ref $ProjectRef

Write-Host "==> Deploying send-email function"
& $cli functions deploy send-email --project-ref $ProjectRef

Write-Host "`n[OK] Done. Test from the app by moving a job to 'completed'."
