# WSL2 Port Forwarding Script for Android Emulator
# Run this in Windows PowerShell as Administrator

Write-Host "Setting up WSL2 port forwarding for Android emulator..." -ForegroundColor Green

# Get WSL2 IP address
$wslIP = bash -c "hostname -I | awk '{print `$1}'"
Write-Host "WSL2 IP Address: $wslIP" -ForegroundColor Yellow

# Remove existing port forwarding rules
netsh interface portproxy delete v4tov4 listenport=3001 listenaddress=0.0.0.0

# Add new port forwarding rule
netsh interface portproxy add v4tov4 listenport=3001 listenaddress=0.0.0.0 connectport=3001 connectaddress=$wslIP

# Show current port forwarding rules
Write-Host "Current port forwarding rules:" -ForegroundColor Yellow
netsh interface portproxy show v4tov4

# Add Windows Firewall rule
New-NetFirewallRule -DisplayName "WSL2 Port 3001" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow

Write-Host "Port forwarding setup complete!" -ForegroundColor Green
Write-Host "Android emulator can now reach WSL2 server at 10.0.2.2:3001" -ForegroundColor Green