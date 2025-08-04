# Development Stop Script for Noctool
# This script helps stop all development processes cleanly

Write-Host "🔄 Stopping Noctool development processes..." -ForegroundColor Yellow

# Stop Electron processes
$electronProcesses = Get-Process -Name "electron" -ErrorAction SilentlyContinue
if ($electronProcesses) {
    Write-Host "🔄 Stopping Electron processes..." -ForegroundColor Cyan
    $electronProcesses | Stop-Process -Force
    Write-Host "✅ Electron processes stopped" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No Electron processes found" -ForegroundColor Gray
}

# Stop Node.js processes (be more careful with this)
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq "node" }
if ($nodeProcesses) {
    Write-Host "🔄 Found Node.js processes. Checking if they're related to Noctool..." -ForegroundColor Cyan
    
    # Try to stop processes more gracefully first
    foreach ($process in $nodeProcesses) {
        try {
            $process.StandardInput.WriteLine("rs") 2>$null
            Start-Sleep -Milliseconds 500
        } catch {
            # Ignore errors
        }
    }
    
    # Force stop if still running
    $remainingProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq "node" }
    if ($remainingProcesses) {
        Write-Host "⚠️  Force stopping remaining Node.js processes..." -ForegroundColor Yellow
        $remainingProcesses | Stop-Process -Force
    }
}

# Stop any remaining processes on port 3000
$port3000Processes = netstat -ano | Select-String ":3000" | ForEach-Object { ($_ -split '\s+')[4] } | Sort-Object -Unique
if ($port3000Processes) {
    Write-Host "🔄 Stopping processes on port 3000..." -ForegroundColor Cyan
    foreach ($processId in $port3000Processes) {
        try {
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        } catch {
            # Ignore errors
        }
    }
}

Write-Host "✅ Development processes stopped" -ForegroundColor Green
Write-Host "💡 If processes are still hanging, you can use Ctrl+C or close the terminal window" -ForegroundColor Gray 