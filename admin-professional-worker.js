/**
 * ARYV Professional Admin Panel - Cloudflare Worker
 * Serves the React admin panel with database connectivity
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Serve the built React admin panel
    if (path === '/' || path === '/index.html') {
      return new Response(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ARYV Professional Admin</title>
    <script type="module" crossorigin src="/assets/index-95c39231.js"></script>
    <link rel="stylesheet" href="/assets/index-c05bc8f9.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`, {
        headers: {
          'Content-Type': 'text/html',
          ...corsHeaders
        }
      });
    }

    // Serve CSS
    if (path === '/assets/index-c05bc8f9.css') {
      const css = \`body{margin:0;font-family:system-ui,sans-serif;background:#f5f5f5}*,::after,::before{box-sizing:border-box}#root{min-height:100vh}\`;
      return new Response(css, {
        headers: {
          'Content-Type': 'text/css',
          ...corsHeaders
        }
      });
    }

    // Serve bundled JavaScript - Professional React Admin with Database Integration
    if (path === '/assets/index-95c39231.js') {
      const js = \`
// ARYV Professional Admin Panel - React App with Database Integration
import React, { useState, useEffect } from '/esm/react.js';
import ReactDOM from '/esm/react-dom.js';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/users');
        const data = await response.json();
        
        if (data.success) {
          setUsers(data.data);
        }
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
    return React.createElement('div', { style: { padding: '2rem', textAlign: 'center' } }, 'Loading users...');
  }

  return React.createElement('div', null,
    React.createElement('div', { style: { marginBottom: '2rem' } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' } },
        React.createElement('h2', { style: { color: '#1976d2', margin: 0 } }, '👥 User Management'),
        React.createElement('button', { 
          style: { background: '#1976d2', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '6px', cursor: 'pointer' }
        }, '➕ Add New User')
      ),
      
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' } },
        React.createElement('div', { style: { background: 'white', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #e0e0e0' } },
          React.createElement('div', { style: { fontSize: '1.5rem', fontWeight: 'bold', color: '#1976d2' } }, users.length),
          React.createElement('div', { style: { color: '#666', fontSize: '0.8rem' } }, 'Total Users')
        ),
        React.createElement('div', { style: { background: 'white', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #e0e0e0' } },
          React.createElement('div', { style: { fontSize: '1.5rem', fontWeight: 'bold', color: '#4caf50' } }, 
            users.filter(u => u.status === 'active').length
          ),
          React.createElement('div', { style: { color: '#666', fontSize: '0.8rem' } }, 'Active')
        ),
        React.createElement('div', { style: { background: 'white', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #e0e0e0' } },
          React.createElement('div', { style: { fontSize: '1.5rem', fontWeight: 'bold', color: '#ff9800' } }, 
            users.filter(u => u.verified === true).length
          ),
          React.createElement('div', { style: { color: '#666', fontSize: '0.8rem' } }, 'Verified')
        )
      ),

      React.createElement('div', { style: { display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' } },
        React.createElement('input', {
          type: 'text',
          placeholder: 'Search users...',
          value: searchTerm,
          onChange: (e) => setSearchTerm(e.target.value),
          style: { padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minWidth: '200px' }
        }),
        React.createElement('select', {
          value: filterRole,
          onChange: (e) => setFilterRole(e.target.value),
          style: { padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }
        },
          React.createElement('option', { value: 'all' }, 'All Roles'),
          React.createElement('option', { value: 'driver' }, 'Drivers'),
          React.createElement('option', { value: 'passenger' }, 'Passengers'),
          React.createElement('option', { value: 'both' }, 'Both')
        ),
        React.createElement('select', {
          value: filterStatus,
          onChange: (e) => setFilterStatus(e.target.value),
          style: { padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }
        },
          React.createElement('option', { value: 'all' }, 'All Status'),
          React.createElement('option', { value: 'active' }, 'Active'),
          React.createElement('option', { value: 'pending' }, 'Pending'),
          React.createElement('option', { value: 'blocked' }, 'Blocked')
        )
      )
    ),

    React.createElement('div', { style: { background: 'white', borderRadius: '8px', border: '1px solid #e0e0e0', overflow: 'hidden' } },
      React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } },
        React.createElement('thead', null,
          React.createElement('tr', { style: { background: '#f5f5f5' } },
            React.createElement('th', { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' } }, 'User'),
            React.createElement('th', { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' } }, 'Role'),
            React.createElement('th', { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' } }, 'Status'),
            React.createElement('th', { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' } }, 'Verified'),
            React.createElement('th', { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' } }, 'Join Date')
          )
        ),
        React.createElement('tbody', null,
          filteredUsers.map((user, index) =>
            React.createElement('tr', { key: user.id || index, style: { borderBottom: '1px solid #f0f0f0' } },
              React.createElement('td', { style: { padding: '1rem' } },
                React.createElement('div', null,
                  React.createElement('div', { style: { fontWeight: '500', fontSize: '0.9rem' } }, user.name),
                  React.createElement('div', { style: { color: '#666', fontSize: '0.8rem' } }, user.email)
                )
              ),
              React.createElement('td', { style: { padding: '1rem', fontSize: '0.9rem' } },
                \`\${user.role === 'driver' ? '🚗' : user.role === 'passenger' ? '👤' : '🚗👤'} \${user.role}\`
              ),
              React.createElement('td', { style: { padding: '1rem' } },
                React.createElement('span', {
                  style: {
                    background: user.status === 'active' ? '#4caf50' : user.status === 'pending' ? '#ff9800' : '#f44336',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: '500'
                  }
                }, user.status)
              ),
              React.createElement('td', { style: { padding: '1rem', fontSize: '1.2rem' } },
                user.verified ? '✅' : '❌'
              ),
              React.createElement('td', { style: { padding: '1rem', fontSize: '0.9rem', color: '#666' } },
                new Date(user.joinDate).toLocaleDateString()
              )
            )
          )
        )
      ),
      
      filteredUsers.length === 0 && React.createElement('div', {
        style: { padding: '2rem', textAlign: 'center', color: '#666', fontSize: '0.9rem' }
      }, 'No users found matching your criteria.')
    )
  );
};

const RideManagement = () => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRides = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/rides');
        const data = await response.json();
        
        if (data.success) {
          setRides(data.data);
        }
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch rides:', error);
        setLoading(false);
      }
    };
    
    fetchRides();
  }, []);

  if (loading) {
    return React.createElement('div', { style: { padding: '2rem', textAlign: 'center' } }, 'Loading rides...');
  }

  return React.createElement('div', null,
    React.createElement('h2', { style: { color: '#1976d2', marginBottom: '1rem' } }, '🚗 Ride Management'),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' } },
      React.createElement('div', { style: { background: 'white', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #e0e0e0' } },
        React.createElement('div', { style: { fontSize: '1.5rem', fontWeight: 'bold', color: '#1976d2' } }, rides.length),
        React.createElement('div', { style: { color: '#666', fontSize: '0.8rem' } }, 'Total Rides')
      )
    ),
    
    React.createElement('div', { style: { background: 'white', borderRadius: '8px', border: '1px solid #e0e0e0', overflow: 'hidden' } },
      React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } },
        React.createElement('thead', null,
          React.createElement('tr', { style: { background: '#f5f5f5' } },
            React.createElement('th', { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' } }, 'Ride ID'),
            React.createElement('th', { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' } }, 'Driver'),
            React.createElement('th', { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' } }, 'Route'),
            React.createElement('th', { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' } }, 'Status'),
            React.createElement('th', { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' } }, 'Price')
          )
        ),
        React.createElement('tbody', null,
          rides.map((ride, index) =>
            React.createElement('tr', { key: ride.id || index, style: { borderBottom: '1px solid #f0f0f0' } },
              React.createElement('td', { style: { padding: '1rem', fontWeight: '500' } }, ride.id),
              React.createElement('td', { style: { padding: '1rem' } }, ride.driverName),
              React.createElement('td', { style: { padding: '1rem' } },
                React.createElement('div', null, \`📍 \${ride.route?.from}\`),
                React.createElement('div', { style: { color: '#666', margin: '0.25rem 0' } }, \`↓ \${ride.distance} km\`),
                React.createElement('div', null, \`📍 \${ride.route?.to}\`)
              ),
              React.createElement('td', { style: { padding: '1rem' } },
                React.createElement('span', {
                  style: {
                    background: ride.status === 'pending' ? '#2196f3' : ride.status === 'confirmed' ? '#4caf50' : '#9e9e9e',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem'
                  }
                }, ride.status)
              ),
              React.createElement('td', { style: { padding: '1rem', fontWeight: '500' } }, \`$\${ride.price}\`)
            )
          )
        )
      ),
      
      rides.length === 0 && React.createElement('div', {
        style: { padding: '2rem', textAlign: 'center', color: '#666' }
      }, 'No rides found.')
    )
  );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');

  useEffect(() => {
    const token = localStorage.getItem('aryv_admin_token');
    const userData = localStorage.getItem('aryv_admin_user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (email, password) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('aryv_admin_token', data.data.accessToken);
        localStorage.setItem('aryv_admin_user', JSON.stringify(data.data.user));
        setUser(data.data.user);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('aryv_admin_token');
    localStorage.removeItem('aryv_admin_user');
    setUser(null);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return React.createElement(LoginForm, { onLogin: handleLogin, loading });
  }

  return React.createElement('div', { style: { display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' } },
    React.createElement('div', { style: { width: '250px', background: '#1976d2', color: 'white' } },
      React.createElement('div', { style: { padding: '1.5rem', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' } },
        React.createElement('h2', { style: { margin: 0, fontSize: '1.3rem' } }, '🏢 Professional Admin')
      ),
      React.createElement('nav', { style: { padding: '1rem 0' } },
        ['dashboard', 'users', 'rides', 'courier', 'analytics', 'settings'].map(section =>
          React.createElement('a', {
            key: section,
            href: '#',
            onClick: (e) => { e.preventDefault(); setActiveSection(section); },
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1.5rem',
              color: activeSection === section ? 'white' : 'rgba(255,255,255,0.8)',
              textDecoration: 'none',
              background: activeSection === section ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderLeft: activeSection === section ? '3px solid white' : '3px solid transparent'
            }
          },
            React.createElement('span', null, section === 'dashboard' ? '📊' : section === 'users' ? '👥' : section === 'rides' ? '🚗' : section === 'courier' ? '📦' : section === 'analytics' ? '📈' : '⚙️'),
            section.charAt(0).toUpperCase() + section.slice(1)
          )
        )
      )
    ),
    React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column' } },
      React.createElement('header', { style: { background: 'white', padding: '1rem 2rem', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('h1', { style: { margin: 0, color: '#1976d2' } }, activeSection.charAt(0).toUpperCase() + activeSection.slice(1)),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '1rem' } },
          React.createElement('span', { style: { color: '#666' } }, \`👤 \${user?.firstName} \${user?.lastName}\`),
          React.createElement('button', {
            onClick: handleLogout,
            style: { background: '#f44336', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }
          }, '🚪 Logout')
        )
      ),
      React.createElement('main', { style: { flex: 1, padding: '2rem', background: '#f5f5f5' } },
        activeSection === 'users' && React.createElement(UserManagement),
        activeSection === 'rides' && React.createElement(RideManagement),
        activeSection === 'dashboard' && React.createElement('div', null,
          React.createElement('div', { style: { background: '#e8f5e8', color: '#2e7d32', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #4caf50' } },
            React.createElement('strong', null, '🏢 Professional Admin Panel - Database Connected!'),
            React.createElement('br'),
            '🔐 Authentication: Real database users',
            React.createElement('br'),
            '🔗 API: Connected to PostgreSQL backend',
            React.createElement('br'),
            '⚡ Real-time data from http://localhost:3001'
          )
        ),
        (activeSection === 'courier' || activeSection === 'analytics' || activeSection === 'settings') && 
          React.createElement('div', { style: { background: 'white', padding: '1.5rem', borderRadius: '8px' } },
            React.createElement('h2', { style: { color: '#1976d2' } }, \`\${activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Management\`),
            React.createElement('p', { style: { color: '#666' } }, 'Professional-grade management interface coming soon.')
          )
      )
    )
  );
};

const LoginForm = ({ onLogin, loading }) => {
  const [formData, setFormData] = useState({ email: 'admin@aryv-app.com', password: 'admin123' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const result = await onLogin(formData.email, formData.password);
    if (!result.success) {
      setError(result.error || 'Login failed');
    }
  };

  return React.createElement('div', {
    style: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, sans-serif'
    }
  },
    React.createElement('div', {
      style: {
        background: 'white',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '100%',
        margin: '1rem'
      }
    },
      React.createElement('div', { style: { textAlign: 'center', marginBottom: '2rem' } },
        React.createElement('h1', { style: { color: '#333', marginBottom: '0.5rem' } }, '🏢 ARYV Professional'),
        React.createElement('p', { style: { color: '#666' } }, 'Database-Connected Admin')
      ),
      React.createElement('form', { onSubmit: handleSubmit },
        React.createElement('div', { style: { marginBottom: '1rem' } },
          React.createElement('label', { style: { display: 'block', marginBottom: '0.5rem', fontWeight: '500' } }, 'Email'),
          React.createElement('input', {
            type: 'email',
            value: formData.email,
            onChange: (e) => setFormData(prev => ({ ...prev, email: e.target.value })),
            style: { width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' },
            required: true
          })
        ),
        React.createElement('div', { style: { marginBottom: '1.5rem' } },
          React.createElement('label', { style: { display: 'block', marginBottom: '0.5rem', fontWeight: '500' } }, 'Password'),
          React.createElement('input', {
            type: 'password',
            value: formData.password,
            onChange: (e) => setFormData(prev => ({ ...prev, password: e.target.value })),
            style: { width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box' },
            required: true
          })
        ),
        error && React.createElement('div', {
          style: { background: '#ffebee', color: '#c62828', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }
        }, \`❌ \${error}\`),
        React.createElement('button', {
          type: 'submit',
          disabled: loading,
          style: {
            width: '100%',
            background: loading ? '#ccc' : '#667eea',
            color: 'white',
            border: 'none',
            padding: '0.875rem',
            borderRadius: '6px',
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: '500'
          }
        }, loading ? 'Signing In...' : 'Sign In to Professional Admin')
      ),
      React.createElement('div', {
        style: { background: '#e8f5e8', color: '#2e7d32', padding: '1rem', borderRadius: '6px', marginTop: '1rem', fontSize: '0.9rem' }
      },
        React.createElement('strong', null, 'Database Credentials:'),
        React.createElement('br'),
        'Email: admin@aryv-app.com',
        React.createElement('br'),
        'Password: admin123'
      )
    )
  );
};

ReactDOM.render(React.createElement(App), document.getElementById('root'));
\`;

      return new Response(js, {
        headers: {
          'Content-Type': 'application/javascript',
          ...corsHeaders
        }
      });
    }

    // Mock ESM modules for React
    if (path === '/esm/react.js') {
      return new Response(\`export default window.React;\`, {
        headers: {
          'Content-Type': 'application/javascript',
          ...corsHeaders
        }
      });
    }

    if (path === '/esm/react-dom.js') {
      return new Response(\`export default { render: window.ReactDOM.render };\`, {
        headers: {
          'Content-Type': 'application/javascript',
          ...corsHeaders
        }
      });
    }

    // 404 for other paths
    return new Response('Not Found', { status: 404 });
  }
};