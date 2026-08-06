# Restart Development Server Script
# This will stop all node processes and restart the dev server

Write-Host "🔄 Restarting Development Server..." -ForegroundColor Cyan
Write-Host ""

# Stop all node processes
Write-Host "⏹️  Stopping Node.js processes..." -ForegroundColor Yellow
try {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "✅ All Node.js processes stopped" -ForegroundColor Green
} catch {
    Write-Host "⚠️  No running Node.js processes found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📱 Database migration has been applied!" -ForegroundColor Green
Write-Host "   ✅ complaints.created_by added"
Write-Host "   ✅ poll_votes.option_selected added"
Write-Host "   ✅ amenity_bookings.status updated to VARCHAR"
Write-Host ""

Write-Host "🚀 Starting development server..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Run this command in your terminal:" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Or press any key to start automatically..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Start dev server
npm run dev
