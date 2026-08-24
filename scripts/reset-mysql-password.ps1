# MySQL 8.4 Root Password Reset Script
# Run as Administrator

$ErrorActionPreference = "Stop"
$mysqlBin = "C:\Program Files\MySQL\MySQL Server 8.4\bin"
$myIni = "C:\ProgramData\MySQL\MySQL Server 8.4\my.ini"
$initFile = "C:\ProgramData\MySQL\MySQL Server 8.4\reset-password.sql"

Write-Host "=== MySQL Root Password Reset ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create the init file with password reset SQL
$sql = @"
ALTER USER 'root'@'localhost' IDENTIFIED BY 'root123';
FLUSH PRIVILEGES;
"@
Set-Content -Path $initFile -Value $sql -Encoding UTF8
Write-Host "[1/4] Created password reset SQL file" -ForegroundColor Green

# Step 2: Stop the MySQL service
Write-Host "[2/4] Stopping MySQL84 service..." -ForegroundColor Yellow
Stop-Service MySQL84 -Force
Start-Sleep -Seconds 3
Write-Host "       MySQL84 service stopped" -ForegroundColor Green

# Step 3: Start mysqld with --init-file to reset the password
Write-Host "[3/4] Starting MySQL with init-file to reset password..." -ForegroundColor Yellow
$proc = Start-Process -FilePath "$mysqlBin\mysqld.exe" `
    -ArgumentList "--defaults-file=`"$myIni`"", "--init-file=`"$initFile`"" `
    -PassThru -NoNewWindow

# Wait for MySQL to start and process the init file
Start-Sleep -Seconds 8

# Kill the temporary mysqld process
Write-Host "       Stopping temporary mysqld process..." -ForegroundColor Yellow
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# Step 4: Start MySQL service normally
Write-Host "[4/4] Starting MySQL84 service normally..." -ForegroundColor Yellow
Start-Service MySQL84
Start-Sleep -Seconds 3

# Cleanup
Remove-Item $initFile -Force -ErrorAction SilentlyContinue

$svcStatus = (Get-Service MySQL84).Status
Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Cyan
Write-Host "MySQL84 service status: $svcStatus" -ForegroundColor Green
Write-Host "Root password has been reset to: root123" -ForegroundColor Green
Write-Host "Update your .env file with: MYSQL_PASSWORD=`"root123`"" -ForegroundColor Yellow
