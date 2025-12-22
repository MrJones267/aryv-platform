/**
 * ARYV Professional Admin Panel - Cloudflare Worker
 * Serves the built React admin panel with database connectivity
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

    // Serve the main HTML with built React admin
    if (path === '/' || path === '/index.html') {
      return new Response(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ARYV Professional Admin - Database Connected</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; background: #f5f5f5; }
      *, ::after, ::before { box-sizing: border-box; }
      #root { min-height: 100vh; }
      .loading { display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 1.2rem; color: #666; }
    </style>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  </head>
  <body>
    <div id="root">
      <div class="loading">🔄 Loading Professional Admin Panel...</div>
    </div>
    <script>
      // ARYV Professional Admin Panel - Database Connected Version
      const { useState, useEffect } = React;
      
      // User Management Component with Database Integration
      const UserManagement = () => {
        const [users, setUsers] = useState([]);
        const [loading, setLoading] = useState(true);
        const [searchTerm, setSearchTerm] = useState('');
        const [filterRole, setFilterRole] = useState('all');
        const [filterStatus, setFilterStatus] = useState('all');

        useEffect(() => {
          const fetchUsers = async () => {
            try {
              const response = await fetch('http://localhost:3001/api/users');
              const data = await response.json();
              
              if (data.success) {
                setUsers(data.data);
              } else {
                console.error('Failed to fetch users:', data.message);
              }
            } catch (error) {
              console.error('Error fetching users:', error);
            } finally {
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
          return React.createElement('div', { 
            style: { padding: '2rem', textAlign: 'center', fontSize: '1.1rem', color: '#666' } 
          }, '🔄 Loading users from database...');
        }

        return React.createElement('div', null,
          React.createElement('h2', { 
            style: { color: '#1976d2', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' } 
          }, 
            React.createElement('span', null, '👥'), 
            'User Management - Database Connected'
          ),
          
          // Statistics Cards
          React.createElement('div', { 
            style: { 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '1rem', 
              marginBottom: '2rem' 
            } 
          },
            React.createElement('div', { 
              style: { 
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '8px', 
                textAlign: 'center', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
              } 
            },
              React.createElement('div', { 
                style: { fontSize: '2rem', fontWeight: 'bold', color: '#1976d2', marginBottom: '0.5rem' } 
              }, users.length),
              React.createElement('div', { style: { color: '#666', fontSize: '0.9rem' } }, 'Total Users')
            ),
            React.createElement('div', { 
              style: { 
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '8px', 
                textAlign: 'center', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
              } 
            },
              React.createElement('div', { 
                style: { fontSize: '2rem', fontWeight: 'bold', color: '#4caf50', marginBottom: '0.5rem' } 
              }, users.filter(u => u.status === 'active').length),
              React.createElement('div', { style: { color: '#666', fontSize: '0.9rem' } }, 'Active Users')
            ),
            React.createElement('div', { 
              style: { 
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '8px', 
                textAlign: 'center', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
              } 
            },
              React.createElement('div', { 
                style: { fontSize: '2rem', fontWeight: 'bold', color: '#2196f3', marginBottom: '0.5rem' } 
              }, users.filter(u => u.verified === true).length),
              React.createElement('div', { style: { color: '#666', fontSize: '0.9rem' } }, 'Verified')
            )
          ),
          
          // Search and Filters
          React.createElement('div', { 
            style: { 
              display: 'flex', 
              gap: '1rem', 
              marginBottom: '1.5rem', 
              flexWrap: 'wrap',
              alignItems: 'center'
            } 
          },
            React.createElement('input', {
              type: 'text',
              placeholder: 'Search users...',
              value: searchTerm,
              onChange: (e) => setSearchTerm(e.target.value),
              style: { 
                padding: '0.75rem', 
                border: '1px solid #ddd', 
                borderRadius: '6px', 
                minWidth: '250px',
                fontSize: '0.9rem'
              }
            }),
            React.createElement('select', {
              value: filterRole,
              onChange: (e) => setFilterRole(e.target.value),
              style: { 
                padding: '0.75rem', 
                border: '1px solid #ddd', 
                borderRadius: '6px',
                fontSize: '0.9rem'
              }
            },
              React.createElement('option', { value: 'all' }, 'All Roles'),
              React.createElement('option', { value: 'driver' }, 'Drivers'),
              React.createElement('option', { value: 'passenger' }, 'Passengers'),
              React.createElement('option', { value: 'both' }, 'Both')
            ),
            React.createElement('select', {
              value: filterStatus,
              onChange: (e) => setFilterStatus(e.target.value),
              style: { 
                padding: '0.75rem', 
                border: '1px solid #ddd', 
                borderRadius: '6px',
                fontSize: '0.9rem'
              }
            },
              React.createElement('option', { value: 'all' }, 'All Status'),
              React.createElement('option', { value: 'active' }, 'Active'),
              React.createElement('option', { value: 'blocked' }, 'Blocked')
            )
          ),

          // Users Table
          React.createElement('div', { 
            style: { 
              background: 'white', 
              borderRadius: '8px', 
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            } 
          },
            React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } },
              React.createElement('thead', null,
                React.createElement('tr', { style: { background: '#f8f9fa' } },
                  React.createElement('th', { 
                    style: { 
                      padding: '1rem', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#495057'
                    } 
                  }, 'User'),
                  React.createElement('th', { 
                    style: { 
                      padding: '1rem', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#495057'
                    } 
                  }, 'Role'),
                  React.createElement('th', { 
                    style: { 
                      padding: '1rem', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#495057'
                    } 
                  }, 'Status'),
                  React.createElement('th', { 
                    style: { 
                      padding: '1rem', 
                      textAlign: 'center', 
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#495057'
                    } 
                  }, 'Verified'),
                  React.createElement('th', { 
                    style: { 
                      padding: '1rem', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#495057'
                    } 
                  }, 'Join Date')
                )
              ),
              React.createElement('tbody', null,
                filteredUsers.map((user, index) =>
                  React.createElement('tr', { 
                    key: user.id || index, 
                    style: { 
                      borderBottom: '1px solid #dee2e6',
                      transition: 'background-color 0.2s'
                    },
                    onMouseEnter: (e) => e.target.style.backgroundColor = '#f8f9fa',
                    onMouseLeave: (e) => e.target.style.backgroundColor = 'transparent'
                  },
                    React.createElement('td', { style: { padding: '1rem' } },
                      React.createElement('div', null,
                        React.createElement('div', { 
                          style: { fontWeight: '500', fontSize: '0.95rem', color: '#212529' } 
                        }, user.name),
                        React.createElement('div', { 
                          style: { color: '#6c757d', fontSize: '0.85rem', marginTop: '0.25rem' } 
                        }, user.email)
                      )
                    ),
                    React.createElement('td', { style: { padding: '1rem', fontSize: '0.9rem' } },
                      React.createElement('span', { 
                        style: { 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.25rem' 
                        } 
                      },
                        user.role === 'driver' ? '🚗' : user.role === 'passenger' ? '👤' : '🚗👤',
                        user.role
                      )
                    ),
                    React.createElement('td', { style: { padding: '1rem' } },
                      React.createElement('span', {
                        style: {
                          background: user.status === 'active' ? '#d4edda' : user.status === 'blocked' ? '#f8d7da' : '#fff3cd',
                          color: user.status === 'active' ? '#155724' : user.status === 'blocked' ? '#721c24' : '#856404',
                          padding: '0.375rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: '500',
                          border: \`1px solid \${user.status === 'active' ? '#c3e6cb' : user.status === 'blocked' ? '#f5c6cb' : '#ffeaa7'}\`
                        }
                      }, user.status)
                    ),
                    React.createElement('td', { 
                      style: { padding: '1rem', textAlign: 'center', fontSize: '1.25rem' } 
                    }, user.verified ? '✅' : '❌'),
                    React.createElement('td', { 
                      style: { padding: '1rem', fontSize: '0.9rem', color: '#6c757d' } 
                    }, new Date(user.joinDate).toLocaleDateString())
                  )
                )
              )
            ),
            
            filteredUsers.length === 0 && React.createElement('div', {
              style: { 
                padding: '2rem', 
                textAlign: 'center', 
                color: '#6c757d',
                fontSize: '1rem'
              }
            }, users.length === 0 ? '📭 No users in database yet.' : '🔍 No users match your search criteria.')
          )
        );
      };

      // Ride Management Component with Database Integration
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
            } catch (error) {
              console.error('Error fetching rides:', error);
            } finally {
              setLoading(false);
            }
          };
          
          fetchRides();
        }, []);

        if (loading) {
          return React.createElement('div', { 
            style: { padding: '2rem', textAlign: 'center', fontSize: '1.1rem', color: '#666' } 
          }, '🔄 Loading rides from database...');
        }

        return React.createElement('div', null,
          React.createElement('h2', { 
            style: { color: '#1976d2', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' } 
          }, 
            React.createElement('span', null, '🚗'), 
            'Ride Management - Database Connected'
          ),
          
          React.createElement('div', { 
            style: { 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '1rem', 
              marginBottom: '2rem' 
            } 
          },
            React.createElement('div', { 
              style: { 
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '8px', 
                textAlign: 'center', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
              } 
            },
              React.createElement('div', { 
                style: { fontSize: '2rem', fontWeight: 'bold', color: '#1976d2', marginBottom: '0.5rem' } 
              }, rides.length),
              React.createElement('div', { style: { color: '#666', fontSize: '0.9rem' } }, 'Total Rides')
            ),
            React.createElement('div', { 
              style: { 
                background: 'white', 
                padding: '1.5rem', 
                borderRadius: '8px', 
                textAlign: 'center', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
              } 
            },
              React.createElement('div', { 
                style: { fontSize: '2rem', fontWeight: 'bold', color: '#4caf50', marginBottom: '0.5rem' } 
              }, rides.filter(r => r.status === 'confirmed').length),
              React.createElement('div', { style: { color: '#666', fontSize: '0.9rem' } }, 'Active Rides')
            )
          ),
          
          React.createElement('div', { 
            style: { 
              background: 'white', 
              borderRadius: '8px', 
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            } 
          },
            React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } },
              React.createElement('thead', null,
                React.createElement('tr', { style: { background: '#f8f9fa' } },
                  React.createElement('th', { 
                    style: { 
                      padding: '1rem', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#495057'
                    } 
                  }, 'Ride ID'),
                  React.createElement('th', { 
                    style: { 
                      padding: '1rem', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#495057'
                    } 
                  }, 'Driver'),
                  React.createElement('th', { 
                    style: { 
                      padding: '1rem', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#495057'
                    } 
                  }, 'Route'),
                  React.createElement('th', { 
                    style: { 
                      padding: '1rem', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#495057'
                    } 
                  }, 'Status'),
                  React.createElement('th', { 
                    style: { 
                      padding: '1rem', 
                      textAlign: 'right', 
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: '#495057'
                    } 
                  }, 'Price')
                )
              ),
              React.createElement('tbody', null,
                rides.map((ride, index) =>
                  React.createElement('tr', { 
                    key: ride.id || index, 
                    style: { borderBottom: '1px solid #dee2e6' } 
                  },
                    React.createElement('td', { 
                      style: { padding: '1rem', fontWeight: '500', fontSize: '0.9rem' } 
                    }, ride.id),
                    React.createElement('td', { style: { padding: '1rem' } },
                      React.createElement('div', { style: { fontSize: '0.95rem', fontWeight: '500' } }, ride.driverName),
                      React.createElement('div', { 
                        style: { fontSize: '0.8rem', color: '#6c757d', marginTop: '0.25rem' } 
                      }, ride.driverId)
                    ),
                    React.createElement('td', { style: { padding: '1rem' } },
                      React.createElement('div', { style: { fontSize: '0.9rem' } },
                        React.createElement('div', { style: { marginBottom: '0.25rem' } }, \`📍 \${ride.route?.from}\`),
                        React.createElement('div', { 
                          style: { color: '#6c757d', fontSize: '0.8rem', margin: '0.25rem 0' } 
                        }, \`↓ \${ride.distance} km\`),
                        React.createElement('div', null, \`📍 \${ride.route?.to}\`)
                      )
                    ),
                    React.createElement('td', { style: { padding: '1rem' } },
                      React.createElement('span', {
                        style: {
                          background: ride.status === 'pending' ? '#fff3cd' : 
                                     ride.status === 'confirmed' ? '#d4edda' : 
                                     ride.status === 'completed' ? '#d1ecf1' : '#f8d7da',
                          color: ride.status === 'pending' ? '#856404' : 
                                ride.status === 'confirmed' ? '#155724' : 
                                ride.status === 'completed' ? '#0c5460' : '#721c24',
                          padding: '0.375rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: '500',
                          border: \`1px solid \${ride.status === 'pending' ? '#ffeaa7' : 
                                                ride.status === 'confirmed' ? '#c3e6cb' : 
                                                ride.status === 'completed' ? '#bee5eb' : '#f5c6cb'}\`
                        }
                      }, ride.status)
                    ),
                    React.createElement('td', { 
                      style: { 
                        padding: '1rem', 
                        textAlign: 'right', 
                        fontWeight: '600', 
                        fontSize: '0.95rem' 
                      } 
                    }, \`$\${ride.price}\`)
                  )
                )
              )
            ),
            
            rides.length === 0 && React.createElement('div', {
              style: { 
                padding: '2rem', 
                textAlign: 'center', 
                color: '#6c757d',
                fontSize: '1rem'
              }
            }, '📭 No rides in database yet. Create some sample rides to see them here.')
          )
        );
      };

      // Main App Component
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
          setActiveSection('dashboard');
        };

        if (!isAuthenticated) {
          return React.createElement(LoginForm, { onLogin: handleLogin, loading });
        }

        const menuItems = [
          { id: 'dashboard', icon: '📊', label: 'Dashboard' },
          { id: 'users', icon: '👥', label: 'Users' },
          { id: 'rides', icon: '🚗', label: 'Rides' },
          { id: 'courier', icon: '📦', label: 'Courier' },
          { id: 'analytics', icon: '📈', label: 'Analytics' },
          { id: 'settings', icon: '⚙️', label: 'Settings' }
        ];

        return React.createElement('div', { 
          style: { 
            display: 'flex', 
            minHeight: '100vh', 
            fontFamily: 'system-ui, sans-serif' 
          } 
        },
          // Sidebar
          React.createElement('div', { 
            style: { 
              width: '280px', 
              background: 'linear-gradient(135deg, #1976d2, #1565c0)', 
              color: 'white',
              boxShadow: '2px 0 10px rgba(0,0,0,0.1)'
            } 
          },
            React.createElement('div', { 
              style: { 
                padding: '2rem 1.5rem', 
                textAlign: 'center', 
                borderBottom: '1px solid rgba(255,255,255,0.2)' 
              } 
            },
              React.createElement('h2', { 
                style: { margin: 0, fontSize: '1.4rem', fontWeight: '600' } 
              }, '🏢 ARYV Professional'),
              React.createElement('p', { 
                style: { 
                  margin: '0.5rem 0 0 0', 
                  fontSize: '0.85rem', 
                  opacity: 0.9 
                } 
              }, 'Database Connected Admin')
            ),
            React.createElement('nav', { style: { padding: '1rem 0' } },
              menuItems.map(item =>
                React.createElement('a', {
                  key: item.id,
                  href: '#',
                  onClick: (e) => { e.preventDefault(); setActiveSection(item.id); },
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem 1.5rem',
                    color: activeSection === item.id ? 'white' : 'rgba(255,255,255,0.8)',
                    textDecoration: 'none',
                    background: activeSection === item.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                    borderRight: activeSection === item.id ? '3px solid white' : '3px solid transparent',
                    fontSize: '0.95rem',
                    fontWeight: activeSection === item.id ? '600' : '400',
                    transition: 'all 0.2s ease'
                  },
                  onMouseEnter: (e) => {
                    if (activeSection !== item.id) {
                      e.target.style.background = 'rgba(255,255,255,0.1)';
                    }
                  },
                  onMouseLeave: (e) => {
                    if (activeSection !== item.id) {
                      e.target.style.background = 'transparent';
                    }
                  }
                },
                  React.createElement('span', { style: { fontSize: '1.2rem' } }, item.icon),
                  item.label
                )
              )
            )
          ),
          
          // Main Content Area
          React.createElement('div', { 
            style: { 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column' 
            } 
          },
            // Header
            React.createElement('header', { 
              style: { 
                background: 'white', 
                padding: '1rem 2rem', 
                borderBottom: '1px solid #e9ecef', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              } 
            },
              React.createElement('h1', { 
                style: { 
                  margin: 0, 
                  color: '#1976d2', 
                  fontSize: '1.5rem',
                  fontWeight: '600'
                } 
              }, activeSection.charAt(0).toUpperCase() + activeSection.slice(1)),
              React.createElement('div', { 
                style: { 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem' 
                } 
              },
                React.createElement('span', { 
                  style: { 
                    color: '#6c757d', 
                    fontSize: '0.9rem',
                    background: '#f8f9fa',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '20px',
                    border: '1px solid #dee2e6'
                  } 
                }, \`👤 \${user?.firstName} \${user?.lastName}\`),
                React.createElement('button', {
                  onClick: handleLogout,
                  style: { 
                    background: '#dc3545', 
                    color: 'white', 
                    border: 'none', 
                    padding: '0.5rem 1rem', 
                    borderRadius: '6px', 
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  },
                  onMouseEnter: (e) => e.target.style.background = '#c82333',
                  onMouseLeave: (e) => e.target.style.background = '#dc3545'
                }, '🚪 Logout')
              )
            ),
            
            // Page Content
            React.createElement('main', { 
              style: { 
                flex: 1, 
                padding: '2rem', 
                background: '#f8f9fa',
                overflow: 'auto'
              } 
            },
              activeSection === 'users' && React.createElement(UserManagement),
              activeSection === 'rides' && React.createElement(RideManagement),
              activeSection === 'dashboard' && React.createElement('div', { 
                style: { maxWidth: '800px' } 
              },
                React.createElement('div', { 
                  style: { 
                    background: 'linear-gradient(135deg, #28a745, #20c997)', 
                    color: 'white', 
                    padding: '2rem', 
                    borderRadius: '12px', 
                    marginBottom: '2rem',
                    boxShadow: '0 4px 16px rgba(40,167,69,0.3)'
                  } 
                },
                  React.createElement('h3', { 
                    style: { margin: '0 0 1rem 0', fontSize: '1.3rem', fontWeight: '600' } 
                  }, '🏢 Professional Admin Panel - Database Connected!'),
                  React.createElement('div', { style: { fontSize: '0.95rem', lineHeight: '1.6' } },
                    '🔐 Authentication: Real PostgreSQL database users',
                    React.createElement('br'),
                    '🔗 API Backend: Connected to http://localhost:3001',
                    React.createElement('br'),
                    '📊 Live Data: Users, rides, and analytics from database',
                    React.createElement('br'),
                    '⚡ Real-time Updates: Professional-grade admin interface'
                  )
                ),
                React.createElement('div', { 
                  style: { 
                    background: 'white', 
                    padding: '2rem', 
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  } 
                },
                  React.createElement('h3', { 
                    style: { color: '#1976d2', marginBottom: '1rem' } 
                  }, '🚀 Getting Started'),
                  React.createElement('p', { 
                    style: { color: '#6c757d', lineHeight: '1.6', marginBottom: '1rem' } 
                  }, 'Navigate through the menu to manage your ARYV platform:'),
                  React.createElement('ul', { 
                    style: { color: '#6c757d', lineHeight: '1.8', marginLeft: '1rem' } 
                  },
                    React.createElement('li', null, '👥 Users: Manage registered users, verify accounts, handle user status'),
                    React.createElement('li', null, '🚗 Rides: Monitor ride requests, track active rides, manage bookings'),
                    React.createElement('li', null, '📦 Courier: Handle package deliveries and courier services'),
                    React.createElement('li', null, '📈 Analytics: View platform metrics and performance data'),
                    React.createElement('li', null, '⚙️ Settings: Configure platform settings and preferences')
                  )
                )
              ),
              (activeSection === 'courier' || activeSection === 'analytics' || activeSection === 'settings') && 
                React.createElement('div', { 
                  style: { 
                    background: 'white', 
                    padding: '2rem', 
                    borderRadius: '12px',
                    textAlign: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  } 
                },
                  React.createElement('h2', { 
                    style: { color: '#1976d2', marginBottom: '1rem' } 
                  }, 
                    \`\${menuItems.find(m => m.id === activeSection)?.icon} \${activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Management\`
                  ),
                  React.createElement('p', { 
                    style: { color: '#6c757d', fontSize: '1.1rem' } 
                  }, 'Professional-grade management interface for ' + activeSection + ' features.'),
                  React.createElement('p', { 
                    style: { color: '#28a745', marginTop: '1rem', fontWeight: '500' } 
                  }, 'Database integration ready - feature implementation in progress.')
                )
            )
          )
        );
      };

      // Login Form Component
      const LoginForm = ({ onLogin, loading }) => {
        const [formData, setFormData] = useState({ 
          email: 'admin@aryv-app.com', 
          password: 'admin123' 
        });
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
              padding: '2.5rem',
              borderRadius: '16px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
              maxWidth: '420px',
              width: '100%',
              margin: '1rem'
            }
          },
            React.createElement('div', { style: { textAlign: 'center', marginBottom: '2rem' } },
              React.createElement('h1', { 
                style: { 
                  color: '#333', 
                  marginBottom: '0.5rem', 
                  fontSize: '1.8rem',
                  fontWeight: '600'
                } 
              }, '🏢 ARYV Professional'),
              React.createElement('p', { 
                style: { 
                  color: '#666', 
                  fontSize: '1rem',
                  margin: 0
                } 
              }, 'Database-Connected Admin Panel')
            ),
            React.createElement('form', { onSubmit: handleSubmit },
              React.createElement('div', { style: { marginBottom: '1rem' } },
                React.createElement('label', { 
                  style: { 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '500',
                    color: '#333'
                  } 
                }, 'Email Address'),
                React.createElement('input', {
                  type: 'email',
                  value: formData.email,
                  onChange: (e) => setFormData(prev => ({ ...prev, email: e.target.value })),
                  style: { 
                    width: '100%', 
                    padding: '0.875rem', 
                    border: '2px solid #e9ecef', 
                    borderRadius: '8px', 
                    fontSize: '1rem', 
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  },
                  onFocus: (e) => e.target.style.borderColor = '#667eea',
                  onBlur: (e) => e.target.style.borderColor = '#e9ecef',
                  required: true
                })
              ),
              React.createElement('div', { style: { marginBottom: '1.5rem' } },
                React.createElement('label', { 
                  style: { 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '500',
                    color: '#333'
                  } 
                }, 'Password'),
                React.createElement('input', {
                  type: 'password',
                  value: formData.password,
                  onChange: (e) => setFormData(prev => ({ ...prev, password: e.target.value })),
                  style: { 
                    width: '100%', 
                    padding: '0.875rem', 
                    border: '2px solid #e9ecef', 
                    borderRadius: '8px', 
                    fontSize: '1rem', 
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  },
                  onFocus: (e) => e.target.style.borderColor = '#667eea',
                  onBlur: (e) => e.target.style.borderColor = '#e9ecef',
                  required: true
                })
              ),
              error && React.createElement('div', {
                style: { 
                  background: '#f8d7da', 
                  color: '#721c24', 
                  padding: '0.875rem', 
                  borderRadius: '8px', 
                  marginBottom: '1rem', 
                  fontSize: '0.9rem',
                  border: '1px solid #f5c6cb'
                }
              }, \`❌ \${error}\`),
              React.createElement('button', {
                type: 'submit',
                disabled: loading,
                style: {
                  width: '100%',
                  background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white',
                  border: 'none',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }
              }, loading ? 'Signing In...' : 'Sign In to Professional Admin')
            ),
            React.createElement('div', {
              style: { 
                background: 'linear-gradient(135deg, #d4edda, #c3e6cb)', 
                color: '#155724', 
                padding: '1rem', 
                borderRadius: '8px', 
                marginTop: '1.5rem', 
                fontSize: '0.9rem',
                border: '1px solid #c3e6cb'
              }
            },
              React.createElement('strong', null, '🔐 Database Credentials:'),
              React.createElement('br'),
              'Email: admin@aryv-app.com',
              React.createElement('br'),
              'Password: admin123',
              React.createElement('br'),
              React.createElement('br'),
              React.createElement('em', null, 'Connected to PostgreSQL database on localhost:3001')
            )
          )
        );
      };

      // Initialize the app
      ReactDOM.render(React.createElement(App), document.getElementById('root'));
    </script>
  </body>
</html>`, {
        headers: {
          'Content-Type': 'text/html',
          ...corsHeaders
        }
      });
    }

    // 404 for other paths
    return new Response('Professional Admin Panel - Path not found', { 
      status: 404, 
      headers: corsHeaders 
    });
  }
};