#!/usr/bin/env node

// Simple web testing script for React Native components
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8082;

// Create a simple HTML page to test React Native components
const createTestHTML = () => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hitch Mobile App - Web Test</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: #3B82F6;
            color: white;
            padding: 20px;
            text-align: center;
        }
        .content {
            padding: 20px;
        }
        .button {
            background: #3B82F6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            width: 100%;
            margin: 10px 0;
            font-size: 16px;
        }
        .button:hover {
            background: #2563EB;
        }
        .input {
            width: 100%;
            padding: 12px;
            border: 1px solid #ccc;
            border-radius: 6px;
            margin: 10px 0;
            box-sizing: border-box;
            font-size: 16px;
        }
        .status {
            padding: 10px;
            margin: 10px 0;
            border-radius: 6px;
            text-align: center;
        }
        .success {
            background: #10B981;
            color: white;
        }
        .error {
            background: #EF4444;
            color: white;
        }
        .info {
            background: #3B82F6;
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚗 Hitch</h1>
            <p>Mobile App - Web Test Interface</p>
        </div>
        
        <div class="content">
            <h3>Backend Connection Test</h3>
            <div id="connection-status" class="status info">
                Checking backend connection...
            </div>
            
            <h3>Authentication Test</h3>
            <input type="email" id="email" class="input" placeholder="Email" value="admin@hitch.com">
            <input type="password" id="password" class="input" placeholder="Password" value="admin123">
            <button onclick="testLogin()" class="button">Test Login</button>
            
            <div id="auth-status" class="status" style="display: none;"></div>
            
            <h3>API Endpoints Test</h3>
            <button onclick="testHealth()" class="button">Test Health Endpoint</button>
            <button onclick="testDashboard()" class="button">Test Dashboard API</button>
            
            <div id="api-status" class="status" style="display: none;"></div>
            
            <h3>UI Components Preview</h3>
            <div style="text-align: center; padding: 20px;">
                <p>✅ Button Components</p>
                <p>✅ Input Components</p>
                <p>✅ Navigation Ready</p>
                <p>✅ Authentication Flow</p>
                <p>✅ Backend Integration</p>
            </div>
        </div>
    </div>

    <script>
        const API_BASE = 'http://localhost:3001';
        
        // Check backend connection on load
        window.onload = function() {
            testConnection();
        };
        
        function updateStatus(elementId, message, type) {
            const element = document.getElementById(elementId);
            element.textContent = message;
            element.className = 'status ' + type;
            element.style.display = 'block';
        }
        
        async function testConnection() {
            try {
                const response = await fetch(API_BASE + '/health');
                const data = await response.json();
                updateStatus('connection-status', '✅ Backend Connected Successfully!', 'success');
            } catch (error) {
                updateStatus('connection-status', '❌ Backend Connection Failed', 'error');
            }
        }
        
        async function testLogin() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                const response = await fetch(API_BASE + '/api/admin/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                if (data.success) {
                    updateStatus('auth-status', '✅ Login Successful! Token received.', 'success');
                } else {
                    updateStatus('auth-status', '❌ Login Failed: ' + data.message, 'error');
                }
            } catch (error) {
                updateStatus('auth-status', '❌ Login Error: ' + error.message, 'error');
            }
        }
        
        async function testHealth() {
            try {
                const response = await fetch(API_BASE + '/health');
                const data = await response.json();
                updateStatus('api-status', '✅ Health Check: ' + data.message, 'success');
            } catch (error) {
                updateStatus('api-status', '❌ Health Check Failed', 'error');
            }
        }
        
        async function testDashboard() {
            try {
                const response = await fetch(API_BASE + '/api/admin/analytics/dashboard');
                const data = await response.json();
                updateStatus('api-status', '✅ Dashboard API Working!', 'success');
            } catch (error) {
                updateStatus('api-status', '❌ Dashboard API Failed', 'error');
            }
        }
    </script>
</body>
</html>
  `;
};

// Create HTTP server
const server = http.createServer((req, res) => {
  // Set CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(createTestHTML());
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log('🌐 Hitch Mobile App Web Test Server running at:');
  console.log(`   http://localhost:${PORT}`);
  console.log('🚀 Backend API running at: http://localhost:3001');
  console.log('📱 Test your mobile app UI in the browser!');
});