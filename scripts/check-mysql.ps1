$svc = Get-WmiObject Win32_Service -Filter "Name='MySQL84'"
Write-Host "Service Path: $($svc.PathName)"
Write-Host "State: $($svc.State)"
Write-Host "StartMode: $($svc.StartMode)"
