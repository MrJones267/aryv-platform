/**
 * @fileoverview API Documentation Routes
 * @author Oabona-Majoko
 * @created 2025-01-27
 */

const express = require('express');
const router = express.Router();
const { specs, swaggerUi, swaggerUiOptions } = require('../config/swagger');

/**
 * @swagger
 * /docs:
 *   get:
 *     summary: API Documentation
 *     description: Interactive API documentation using Swagger UI
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: API documentation page
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */

/**
 * @swagger
 * /docs/json:
 *   get:
 *     summary: API Specification
 *     description: OpenAPI specification in JSON format
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: OpenAPI specification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */

/**
 * @swagger
 * /docs/postman:
 *   get:
 *     summary: Postman Collection
 *     description: Download Postman collection for API testing
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: Postman collection
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */

// Serve Swagger UI
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(specs, swaggerUiOptions));

// Serve OpenAPI JSON specification
router.get('/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

// Generate and serve Postman collection
router.get('/postman', (req, res) => {
  try {
    const postmanCollection = generatePostmanCollection(specs);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="hitch-api.postman_collection.json"');
    res.send(postmanCollection);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate Postman collection',
      code: 'POSTMAN_GENERATION_ERROR'
    });
  }
});

// API Testing Interface
router.get('/test', (req, res) => {
  const testInterface = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ARYV API Test Interface</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .test-section { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .test-form { display: flex; flex-direction: column; gap: 10px; }
        .form-group { display: flex; gap: 10px; align-items: center; }
        input, select, textarea { padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; }
        button { background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #2563eb; }
        .response { background: #1f2937; color: #f9fafb; padding: 15px; border-radius: 4px; white-space: pre-wrap; font-family: monospace; max-height: 300px; overflow-y: auto; }
        .endpoint-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .endpoint-card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; }
        .method { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
        .method.get { background: #10b981; color: white; }
        .method.post { background: #3b82f6; color: white; }
        .method.put { background: #f59e0b; color: white; }
        .method.delete { background: #ef4444; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚗 ARYV API Test Interface</h1>
            <p>Interactive testing interface for the ARYV Platform API</p>
        </div>

        <div class="test-section">
            <h2>🔐 Authentication</h2>
            <div class="test-form">
                <div class="form-group">
                    <label>Email:</label>
                    <input type="email" id="auth-email" placeholder="user@example.com" />
                    <label>Password:</label>
                    <input type="password" id="auth-password" placeholder="password" />
                    <button onclick="testLogin()">Login</button>
                </div>
                <div class="form-group">
                    <label>Token:</label>
                    <input type="text" id="auth-token" placeholder="JWT token will appear here" style="flex: 1;" readonly />
                    <button onclick="clearToken()">Clear</button>
                </div>
            </div>
        </div>

        <div class="test-section">
            <h2>🧪 Quick API Test</h2>
            <div class="test-form">
                <div class="form-group">
                    <select id="test-method">
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                    <input type="text" id="test-endpoint" placeholder="/api/endpoint" style="flex: 1;" />
                    <button onclick="testEndpoint()">Test</button>
                </div>
                <div class="form-group">
                    <textarea id="test-body" placeholder="JSON request body (for POST/PUT)" rows="3" style="flex: 1;"></textarea>
                </div>
                <div id="test-response" class="response" style="display: none;"></div>
            </div>
        </div>

        <div class="test-section">
            <h2>📚 Available Endpoints</h2>
            <div class="endpoint-list">
                <div class="endpoint-card">
                    <h3>Authentication</h3>
                    <div><span class="method post">POST</span> /api/auth/register</div>
                    <div><span class="method post">POST</span> /api/auth/login</div>
                    <div><span class="method post">POST</span> /api/auth/logout</div>
                    <div><span class="method post">POST</span> /api/auth/refresh</div>
                </div>
                <div class="endpoint-card">
                    <h3>Users</h3>
                    <div><span class="method get">GET</span> /api/users/profile</div>
                    <div><span class="method put">PUT</span> /api/users/profile</div>
                    <div><span class="method post">POST</span> /api/users/upload-avatar</div>
                    <div><span class="method get">GET</span> /api/users/addresses</div>
                </div>
                <div class="endpoint-card">
                    <h3>Vehicles</h3>
                    <div><span class="method get">GET</span> /api/vehicles</div>
                    <div><span class="method post">POST</span> /api/vehicles</div>
                    <div><span class="method put">PUT</span> /api/vehicles/:id</div>
                    <div><span class="method delete">DELETE</span> /api/vehicles/:id</div>
                </div>
                <div class="endpoint-card">
                    <h3>Rides</h3>
                    <div><span class="method get">GET</span> /api/rides</div>
                    <div><span class="method post">POST</span> /api/rides</div>
                    <div><span class="method get">GET</span> /api/rides/:id</div>
                    <div><span class="method put">PUT</span> /api/rides/:id</div>
                </div>
                <div class="endpoint-card">
                    <h3>Packages</h3>
                    <div><span class="method get">GET</span> /api/packages</div>
                    <div><span class="method post">POST</span> /api/packages</div>
                    <div><span class="method get">GET</span> /api/packages/:id</div>
                    <div><span class="method put">PUT</span> /api/packages/:id/status</div>
                </div>
                <div class="endpoint-card">
                    <h3>Payments</h3>
                    <div><span class="method post">POST</span> /api/payments/create-intent</div>
                    <div><span class="method post">POST</span> /api/payments/confirm</div>
                    <div><span class="method get">GET</span> /api/payments/history</div>
                </div>
            </div>
        </div>

        <div class="test-section">
            <h2>📖 Documentation Links</h2>
            <p>
                <a href="/docs" target="_blank">📋 Interactive API Documentation (Swagger UI)</a><br>
                <a href="/docs/json" target="_blank">📄 OpenAPI JSON Specification</a><br>
                <a href="/docs/postman" target="_blank">📮 Download Postman Collection</a>
            </p>
        </div>
    </div>

    <script>
        let authToken = localStorage.getItem('hitch_test_token') || '';
        if (authToken) {
            document.getElementById('auth-token').value = authToken;
        }

        async function testLogin() {
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            
            if (!email || !password) {
                alert('Please enter email and password');
                return;
            }

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();
                
                if (data.success && data.data.tokens) {
                    authToken = data.data.tokens.accessToken;
                    document.getElementById('auth-token').value = authToken;
                    localStorage.setItem('hitch_test_token', authToken);
                    alert('Login successful!');
                } else {
                    alert('Login failed: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                alert('Login error: ' + error.message);
            }
        }

        function clearToken() {
            authToken = '';
            document.getElementById('auth-token').value = '';
            localStorage.removeItem('hitch_test_token');
        }

        async function testEndpoint() {
            const method = document.getElementById('test-method').value;
            const endpoint = document.getElementById('test-endpoint').value;
            const body = document.getElementById('test-body').value;
            const responseDiv = document.getElementById('test-response');

            if (!endpoint) {
                alert('Please enter an endpoint');
                return;
            }

            const headers = { 'Content-Type': 'application/json' };
            if (authToken) {
                headers['Authorization'] = 'Bearer ' + authToken;
            }

            const requestOptions = {
                method,
                headers
            };

            if ((method === 'POST' || method === 'PUT') && body) {
                try {
                    JSON.parse(body); // Validate JSON
                    requestOptions.body = body;
                } catch (error) {
                    alert('Invalid JSON in request body');
                    return;
                }
            }

            try {
                responseDiv.style.display = 'block';
                responseDiv.textContent = 'Loading...';

                const response = await fetch(endpoint, requestOptions);
                const data = await response.text();
                
                let formattedResponse;
                try {
                    formattedResponse = JSON.stringify(JSON.parse(data), null, 2);
                } catch {
                    formattedResponse = data;
                }

                responseDiv.textContent = \`Status: \${response.status} \${response.statusText}\n\n\${formattedResponse}\`;
            } catch (error) {
                responseDiv.textContent = 'Error: ' + error.message;
            }
        }

        // Auto-populate token input on page load
        document.addEventListener('DOMContentLoaded', () => {
            const token = localStorage.getItem('hitch_test_token');
            if (token) {
                document.getElementById('auth-token').value = token;
                authToken = token;
            }
        });
    </script>
</body>
</html>
  `;
  
  res.send(testInterface);
});

// Helper function to generate Postman collection
function generatePostmanCollection(openApiSpec) {
  const collection = {
    info: {
      name: 'ARYV Platform API',
      description: openApiSpec.info.description,
      version: openApiSpec.info.version,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    auth: {
      type: 'bearer',
      bearer: [
        {
          key: 'token',
          value: '{{access_token}}',
          type: 'string'
        }
      ]
    },
    variable: [
      {
        key: 'base_url',
        value: 'http://localhost:3001',
        type: 'string'
      },
      {
        key: 'access_token',
        value: '',
        type: 'string'
      }
    ],
    item: []
  };

  // Add authentication folder
  const authFolder = {
    name: 'Authentication',
    item: [
      {
        name: 'Login',
        request: {
          method: 'POST',
          header: [
            {
              key: 'Content-Type',
              value: 'application/json'
            }
          ],
          body: {
            mode: 'raw',
            raw: JSON.stringify({
              email: 'user@example.com',
              password: 'password'
            })
          },
          url: {
            raw: '{{base_url}}/api/auth/login',
            host: ['{{base_url}}'],
            path: ['api', 'auth', 'login']
          }
        },
        event: [
          {
            listen: 'test',
            script: {
              exec: [
                'if (pm.response.code === 200) {',
                '    const response = pm.response.json();',
                '    if (response.success && response.data.tokens) {',
                '        pm.collectionVariables.set("access_token", response.data.tokens.accessToken);',
                '    }',
                '}'
              ]
            }
          }
        ]
      },
      {
        name: 'Register',
        request: {
          method: 'POST',
          header: [
            {
              key: 'Content-Type',
              value: 'application/json'
            }
          ],
          body: {
            mode: 'raw',
            raw: JSON.stringify({
              email: 'newuser@example.com',
              password: 'password123',
              firstName: 'John',
              lastName: 'Doe',
              role: 'user'
            })
          },
          url: {
            raw: '{{base_url}}/api/auth/register',
            host: ['{{base_url}}'],
            path: ['api', 'auth', 'register']
          }
        }
      }
    ]
  };

  collection.item.push(authFolder);

  // Add other endpoint folders
  const endpoints = [
    { name: 'Users', path: 'users' },
    { name: 'Vehicles', path: 'vehicles' },
    { name: 'Rides', path: 'rides' },
    { name: 'Packages', path: 'packages' },
    { name: 'Payments', path: 'payments' },
    { name: 'Admin', path: 'admin' }
  ];

  endpoints.forEach(endpoint => {
    const folder = {
      name: endpoint.name,
      item: [
        {
          name: `Get ${endpoint.name}`,
          request: {
            method: 'GET',
            header: [],
            url: {
              raw: `{{base_url}}/api/${endpoint.path}`,
              host: ['{{base_url}}'],
              path: ['api', endpoint.path]
            }
          }
        }
      ]
    };
    collection.item.push(folder);
  });

  return collection;
}

module.exports = router;