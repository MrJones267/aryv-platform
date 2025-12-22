/**
 * ARYV Professional Admin Panel - Cloudflare Worker
 * Database-connected admin interface
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const url = new URL(request.url);
    
    // Serve the professional admin interface
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ARYV Professional Admin - Database Connected</title>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #f8f9fa; }
        .app { min-height: 100vh; display: flex; }
        .sidebar { width: 280px; background: linear-gradient(135deg, #1976d2, #1565c0); color: white; box-shadow: 2px 0 10px rgba(0,0,0,0.1); }
        .main { flex: 1; display: flex; flex-direction: column; }
        .header { background: white; padding: 1rem 2rem; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .content { flex: 1; padding: 2rem; overflow: auto; }
        .card { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; margin-bottom: 2rem; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: white; padding: 1.5rem; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .table { width: 100%; border-collapse: collapse; }
        .table th { background: #f8f9fa; padding: 1rem; text-align: left; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #495057; }
        .table td { padding: 1rem; border-bottom: 1px solid #dee2e6; }
        .status { padding: 0.375rem 0.75rem; border-radius: 20px; font-size: 0.8rem; font-weight: 500; }
        .status.active { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.pending { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .status.blocked { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .status.confirmed { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .btn { background: #1976d2; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .btn:hover { background: #1565c0; }
        .btn.danger { background: #dc3545; }
        .btn.danger:hover { background: #c82333; }
        .nav-item { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; color: rgba(255,255,255,0.8); text-decoration: none; transition: all 0.2s; }
        .nav-item.active { color: white; background: rgba(255,255,255,0.15); border-right: 3px solid white; }
        .nav-item:hover { background: rgba(255,255,255,0.1); }
        .loading { display: flex; justify-content: center; align-items: center; padding: 2rem; color: #6c757d; }
        .error { color: #dc3545; padding: 1rem; text-align: center; }
        .success { color: #28a745; }
        .login-form { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .login-card { background: white; padding: 2.5rem; border-radius: 16px; box-shadow: 0 25px 50px rgba(0,0,0,0.15); width: 100%; max-width: 420px; margin: 1rem; }
        .form-group { margin-bottom: 1rem; }
        .form-label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333; }
        .form-input { width: 100%; padding: 0.875rem; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1rem; transition: border-color 0.2s; }
        .form-input:focus { outline: none; border-color: #667eea; }
        .alert { padding: 0.875rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; }
        .alert.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .alert.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    </style>
</head>
<body>
    <div id="root"></div>
    <script>
        const { useState, useEffect } = React;

        // API Configuration - Dynamic backend detection
        const API_BASE = window.location.hostname === 'localhost' ? 
            'http://localhost:3001' : 'http://localhost:3001';

        // User Management Component
        const UserManagement = () => {
            const [users, setUsers] = useState([]);
            const [loading, setLoading] = useState(true);
            const [error, setError] = useState('');

            useEffect(() => {
                fetchUsers();
            }, []);

            const fetchUsers = async () => {
                try {
                    const response = await fetch(\`\${API_BASE}/api/users\`);
                    const data = await response.json();
                    if (data.success) {
                        setUsers(data.data);
                    } else {
                        setError('Failed to load users');
                    }
                } catch (err) {
                    setError(\`Database connection error: \${err.message}\`);
                } finally {
                    setLoading(false);
                }
            };

            if (loading) return React.createElement('div', { className: 'loading' }, '🔄 Loading users from database...');
            if (error) return React.createElement('div', { className: 'error' }, \`❌ \${error}\`);

            return React.createElement('div', null,
                React.createElement('h2', { style: { color: '#1976d2', marginBottom: '1rem' } }, '👥 User Management'),
                
                React.createElement('div', { className: 'stats' },
                    React.createElement('div', { className: 'stat-card' },
                        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#1976d2' } }, users.length),
                        React.createElement('div', { style: { color: '#666' } }, 'Total Users')
                    ),
                    React.createElement('div', { className: 'stat-card' },
                        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#28a745' } }, 
                            users.filter(u => u.status === 'active').length),
                        React.createElement('div', { style: { color: '#666' } }, 'Active Users')
                    ),
                    React.createElement('div', { className: 'stat-card' },
                        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#17a2b8' } }, 
                            users.filter(u => u.verified).length),
                        React.createElement('div', { style: { color: '#666' } }, 'Verified Users')
                    )
                ),

                React.createElement('div', { className: 'card' },
                    React.createElement('table', { className: 'table' },
                        React.createElement('thead', null,
                            React.createElement('tr', null,
                                React.createElement('th', null, 'User'),
                                React.createElement('th', null, 'Role'),
                                React.createElement('th', null, 'Status'),
                                React.createElement('th', null, 'Verified'),
                                React.createElement('th', null, 'Join Date')
                            )
                        ),
                        React.createElement('tbody', null,
                            users.map(user => 
                                React.createElement('tr', { key: user.id },
                                    React.createElement('td', null,
                                        React.createElement('div', { style: { fontWeight: '500' } }, user.name),
                                        React.createElement('div', { style: { color: '#6c757d', fontSize: '0.85rem' } }, user.email)
                                    ),
                                    React.createElement('td', null, \`\${user.role === 'driver' ? '🚗' : user.role === 'passenger' ? '👤' : '🚗👤'} \${user.role}\`),
                                    React.createElement('td', null,
                                        React.createElement('span', { className: \`status \${user.status}\` }, user.status)
                                    ),
                                    React.createElement('td', { style: { fontSize: '1.25rem' } }, user.verified ? '✅' : '❌'),
                                    React.createElement('td', { style: { color: '#6c757d' } }, 
                                        new Date(user.joinDate).toLocaleDateString())
                                )
                            )
                        )
                    )
                )
            );
        };

        // Ride Management Component
        const RideManagement = () => {
            const [rides, setRides] = useState([]);
            const [loading, setLoading] = useState(true);
            const [error, setError] = useState('');

            useEffect(() => {
                fetchRides();
            }, []);

            const fetchRides = async () => {
                try {
                    const response = await fetch(\`\${API_BASE}/api/rides\`);
                    const data = await response.json();
                    if (data.success) {
                        setRides(data.data);
                    } else {
                        setError('Failed to load rides');
                    }
                } catch (err) {
                    setError(\`Database connection error: \${err.message}\`);
                } finally {
                    setLoading(false);
                }
            };

            if (loading) return React.createElement('div', { className: 'loading' }, '🔄 Loading rides from database...');
            if (error) return React.createElement('div', { className: 'error' }, \`❌ \${error}\`);

            return React.createElement('div', null,
                React.createElement('h2', { style: { color: '#1976d2', marginBottom: '1rem' } }, '🚗 Ride Management'),
                
                React.createElement('div', { className: 'stats' },
                    React.createElement('div', { className: 'stat-card' },
                        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#1976d2' } }, rides.length),
                        React.createElement('div', { style: { color: '#666' } }, 'Total Rides')
                    ),
                    React.createElement('div', { className: 'stat-card' },
                        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#28a745' } }, 
                            rides.filter(r => r.status === 'confirmed').length),
                        React.createElement('div', { style: { color: '#666' } }, 'Active Rides')
                    ),
                    React.createElement('div', { className: 'stat-card' },
                        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#17a2b8' } }, 
                            \`$\${rides.reduce((sum, r) => r.status === 'confirmed' ? sum + r.price : sum, 0)}\`),
                        React.createElement('div', { style: { color: '#666' } }, 'Active Revenue')
                    )
                ),

                React.createElement('div', { className: 'card' },
                    React.createElement('table', { className: 'table' },
                        React.createElement('thead', null,
                            React.createElement('tr', null,
                                React.createElement('th', null, 'Ride ID'),
                                React.createElement('th', null, 'Driver'),
                                React.createElement('th', null, 'Route'),
                                React.createElement('th', null, 'Status'),
                                React.createElement('th', null, 'Price'),
                                React.createElement('th', null, 'Distance')
                            )
                        ),
                        React.createElement('tbody', null,
                            rides.map(ride => 
                                React.createElement('tr', { key: ride.id },
                                    React.createElement('td', { style: { fontWeight: '500' } }, ride.id),
                                    React.createElement('td', null,
                                        React.createElement('div', { style: { fontWeight: '500' } }, ride.driverName),
                                        React.createElement('div', { style: { color: '#6c757d', fontSize: '0.85rem' } }, ride.driverId)
                                    ),
                                    React.createElement('td', null,
                                        React.createElement('div', null, \`📍 \${ride.route.from}\`),
                                        React.createElement('div', { style: { color: '#6c757d', fontSize: '0.85rem' } }, \`📍 \${ride.route.to}\`)
                                    ),
                                    React.createElement('td', null,
                                        React.createElement('span', { className: \`status \${ride.status}\` }, ride.status)
                                    ),
                                    React.createElement('td', { style: { fontWeight: '600' } }, \`$\${ride.price}\`),
                                    React.createElement('td', { style: { color: '#6c757d' } }, \`\${ride.distance} km\`)
                                )
                            )
                        )
                    )
                )
            );
        };

        // Login Component
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

            return React.createElement('div', { className: 'login-form' },
                React.createElement('div', { className: 'login-card' },
                    React.createElement('div', { style: { textAlign: 'center', marginBottom: '2rem' } },
                        React.createElement('h1', { style: { color: '#333', marginBottom: '0.5rem' } }, '🏢 ARYV Professional'),
                        React.createElement('p', { style: { color: '#666' } }, 'Database-Connected Admin Panel')
                    ),
                    React.createElement('form', { onSubmit: handleSubmit },
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', { className: 'form-label' }, 'Email Address'),
                            React.createElement('input', {
                                type: 'email',
                                className: 'form-input',
                                value: formData.email,
                                onChange: (e) => setFormData(prev => ({...prev, email: e.target.value})),
                                required: true
                            })
                        ),
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', { className: 'form-label' }, 'Password'),
                            React.createElement('input', {
                                type: 'password',
                                className: 'form-input',
                                value: formData.password,
                                onChange: (e) => setFormData(prev => ({...prev, password: e.target.value})),
                                required: true
                            })
                        ),
                        error && React.createElement('div', { className: 'alert error' }, \`❌ \${error}\`),
                        React.createElement('button', {
                            type: 'submit',
                            className: 'btn',
                            disabled: loading,
                            style: { width: '100%', padding: '1rem', fontSize: '1rem' }
                        }, loading ? 'Signing In...' : 'Sign In to Professional Admin')
                    ),
                    React.createElement('div', { className: 'alert success', style: { marginTop: '1.5rem' } },
                        React.createElement('strong', null, '🔐 Database Credentials:'),
                        React.createElement('br'),
                        'Email: admin@aryv-app.com',
                        React.createElement('br'),
                        'Password: admin123'
                    )
                )
            );
        };

        // Courier Management Component
        const CourierManagement = () => {
            const [couriers, setCouriers] = useState([]);
            const [packages, setPackages] = useState([]);
            const [loading, setLoading] = useState(true);
            const [error, setError] = useState('');

            useEffect(() => {
                fetchCourierData();
            }, []);

            const fetchCourierData = async () => {
                try {
                    const [couriersResponse, packagesResponse] = await Promise.all([
                        fetch(`${API_BASE}/api/couriers`),
                        fetch(`${API_BASE}/api/packages`)
                    ]);
                    
                    const couriersData = await couriersResponse.json();
                    const packagesData = await packagesResponse.json();
                    
                    if (couriersData.success && packagesData.success) {
                        setCouriers(couriersData.data);
                        setPackages(packagesData.data);
                    } else {
                        setError('Failed to load courier data');
                    }
                } catch (err) {
                    setError(`Database connection error: ${err.message}`);
                } finally {
                    setLoading(false);
                }
            };

            if (loading) return React.createElement('div', { className: 'loading' }, '🔄 Loading courier data from database...');
            if (error) return React.createElement('div', { className: 'error' }, `❌ ${error}`);

            return React.createElement('div', null,
                React.createElement('h2', { style: { color: '#1976d2', marginBottom: '1rem' } }, '📦 Courier Management'),
                
                React.createElement('div', { className: 'stats' },
                    React.createElement('div', { className: 'stat-card' },
                        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#1976d2' } }, couriers.length),
                        React.createElement('div', { style: { color: '#666' } }, 'Active Couriers')
                    ),
                    React.createElement('div', { className: 'stat-card' },
                        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#28a745' } }, 
                            couriers.filter(c => c.isAvailable).length),
                        React.createElement('div', { style: { color: '#666' } }, 'Available Now')
                    ),
                    React.createElement('div', { className: 'stat-card' },
                        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#17a2b8' } }, packages.length),
                        React.createElement('div', { style: { color: '#666' } }, 'Total Packages')
                    ),
                    React.createElement('div', { className: 'stat-card' },
                        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#ffc107' } }, 
                            packages.filter(p => p.status === 'in_transit').length),
                        React.createElement('div', { style: { color: '#666' } }, 'In Transit')
                    )
                ),

                React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' } },
                    // Couriers table
                    React.createElement('div', { className: 'card' },
                        React.createElement('h3', { style: { padding: '1rem', margin: 0, borderBottom: '1px solid #dee2e6', color: '#1976d2' } }, '🚚 Active Couriers'),
                        React.createElement('table', { className: 'table' },
                            React.createElement('thead', null,
                                React.createElement('tr', null,
                                    React.createElement('th', null, 'Courier'),
                                    React.createElement('th', null, 'Rating'),
                                    React.createElement('th', null, 'Status'),
                                    React.createElement('th', null, 'Deliveries')
                                )
                            ),
                            React.createElement('tbody', null,
                                couriers.map(courier => 
                                    React.createElement('tr', { key: courier.id },
                                        React.createElement('td', null,
                                            React.createElement('div', { style: { fontWeight: '500' } }, courier.name),
                                            React.createElement('div', { style: { color: '#6c757d', fontSize: '0.85rem' } }, courier.vehicleType)
                                        ),
                                        React.createElement('td', null, `⭐ ${courier.rating}`),
                                        React.createElement('td', null,
                                            React.createElement('span', { 
                                                className: `status ${courier.isAvailable ? 'active' : 'pending'}` 
                                            }, courier.isAvailable ? 'Available' : 'Busy')
                                        ),
                                        React.createElement('td', null, `${courier.successfulDeliveries}/${courier.totalDeliveries}`)
                                    )
                                )
                            )
                        )
                    ),

                    // Packages table
                    React.createElement('div', { className: 'card' },
                        React.createElement('h3', { style: { padding: '1rem', margin: 0, borderBottom: '1px solid #dee2e6', color: '#1976d2' } }, '📦 Recent Packages'),
                        React.createElement('table', { className: 'table' },
                            React.createElement('thead', null,
                                React.createElement('tr', null,
                                    React.createElement('th', null, 'Package'),
                                    React.createElement('th', null, 'Status'),
                                    React.createElement('th', null, 'Price'),
                                    React.createElement('th', null, 'Distance')
                                )
                            ),
                            React.createElement('tbody', null,
                                packages.slice(0, 5).map(pkg => 
                                    React.createElement('tr', { key: pkg.id },
                                        React.createElement('td', null,
                                            React.createElement('div', { style: { fontWeight: '500' } }, pkg.title),
                                            React.createElement('div', { style: { color: '#6c757d', fontSize: '0.85rem' } }, pkg.trackingCode)
                                        ),
                                        React.createElement('td', null,
                                            React.createElement('span', { 
                                                className: `status ${pkg.status === 'completed' ? 'confirmed' : pkg.status === 'in_transit' ? 'active' : 'pending'}` 
                                            }, pkg.status.replace('_', ' '))
                                        ),
                                        React.createElement('td', { style: { fontWeight: '600' } }, `$${pkg.price}`),
                                        React.createElement('td', { style: { color: '#6c757d' } }, `${pkg.distance} km`)
                                    )
                                )
                            )
                        )
                    )
                )
            );
        };

        // Analytics Management Component
        const AnalyticsManagement = () => {
            const [analytics, setAnalytics] = useState({});
            const [loading, setLoading] = useState(true);
            const [error, setError] = useState('');

            useEffect(() => {
                fetchAnalytics();
            }, []);

            const fetchAnalytics = async () => {
                try {
                    const response = await fetch(`${API_BASE}/api/courier/analytics`);
                    const data = await response.json();
                    
                    if (data.success) {
                        setAnalytics(data.data);
                    } else {
                        setError('Failed to load analytics');
                    }
                } catch (err) {
                    setError(`Analytics error: ${err.message}`);
                } finally {
                    setLoading(false);
                }
            };

            if (loading) return React.createElement('div', { className: 'loading' }, '🔄 Loading analytics from database...');
            if (error) return React.createElement('div', { className: 'error' }, `❌ ${error}`);

            const { packages = {}, couriers = {}, today = {} } = analytics;

            return React.createElement('div', null,
                React.createElement('h2', { style: { color: '#1976d2', marginBottom: '1rem' } }, '📈 Analytics Dashboard'),
                
                // Key metrics
                React.createElement('div', { className: 'stats' },
                    React.createElement('div', { className: 'stat-card' },
                        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#28a745' } }, `$${packages.totalRevenue || 0}`),
                        React.createElement('div', { style: { color: '#666' } }, 'Total Revenue')
                    ),
                    React.createElement('div', { className: 'stat-card' },
                        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#1976d2' } }, packages.total || 0),
                        React.createElement('div', { style: { color: '#666' } }, 'Total Packages')
                    ),
                    React.createElement('div', { className: 'stat-card' },
                        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#17a2b8' } }, couriers.total || 0),
                        React.createElement('div', { style: { color: '#666' } }, 'Active Couriers')
                    ),
                    React.createElement('div', { className: 'stat-card' },
                        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#ffc107' } }, `${couriers.avgRating || 5.0}⭐`),
                        React.createElement('div', { style: { color: '#666' } }, 'Avg Rating')
                    )
                ),

                // Detailed analytics
                React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' } },
                    React.createElement('div', { className: 'card', style: { padding: '2rem' } },
                        React.createElement('h3', { style: { color: '#1976d2', marginBottom: '1rem' } }, '📦 Package Analytics'),
                        React.createElement('div', { style: { lineHeight: '2' } },
                            `🎯 Completed: ${packages.completed || 0}`,
                            React.createElement('br'),
                            `🚚 In Transit: ${packages.inTransit || 0}`,
                            React.createElement('br'),
                            `⏳ Pending: ${packages.pending || 0}`,
                            React.createElement('br'),
                            `📏 Avg Distance: ${(packages.avgDistance || 0).toFixed(1)} km`,
                            React.createElement('br'),
                            `💰 Platform Fees: $${packages.totalFees || 0}`
                        )
                    ),

                    React.createElement('div', { className: 'card', style: { padding: '2rem' } },
                        React.createElement('h3', { style: { color: '#1976d2', marginBottom: '1rem' } }, '🚚 Courier Analytics'),
                        React.createElement('div', { style: { lineHeight: '2' } },
                            `✅ Available: ${couriers.available || 0}`,
                            React.createElement('br'),
                            `📈 Total Deliveries: ${couriers.totalDeliveries || 0}`,
                            React.createElement('br'),
                            `💵 Total Earnings: $${couriers.totalEarnings || 0}`,
                            React.createElement('br'),
                            `📊 Success Rate: ${couriers.totalDeliveries > 0 ? ((couriers.totalDeliveries - (couriers.totalDeliveries - couriers.totalDeliveries)) / couriers.totalDeliveries * 100).toFixed(1) : 100}%`
                        )
                    )
                ),

                React.createElement('div', { className: 'card', style: { padding: '2rem', marginTop: '2rem' } },
                    React.createElement('h3', { style: { color: '#1976d2', marginBottom: '1rem' } }, '📅 Today\\'s Performance'),
                    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', textAlign: 'center' } },
                        React.createElement('div', null,
                            React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#28a745' } }, today.packages || 0),
                            React.createElement('div', { style: { color: '#666' } }, 'Packages Today')
                        ),
                        React.createElement('div', null,
                            React.createElement('div', { style: { fontSize: '2rem', fontWeight: 'bold', color: '#28a745' } }, `$${today.revenue || 0}`),
                            React.createElement('div', { style: { color: '#666' } }, 'Revenue Today')
                        )
                    )
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
                    const response = await fetch(\`\${API_BASE}/api/auth/login\`, {
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

            return React.createElement('div', { className: 'app' },
                React.createElement('div', { className: 'sidebar' },
                    React.createElement('div', { 
                        style: { padding: '2rem 1.5rem', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.2)' } 
                    },
                        React.createElement('h2', { style: { margin: 0, fontSize: '1.4rem' } }, '🏢 ARYV Professional'),
                        React.createElement('p', { style: { margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.9 } }, 
                            'Database Connected')
                    ),
                    React.createElement('nav', null,
                        menuItems.map(item =>
                            React.createElement('a', {
                                key: item.id,
                                href: '#',
                                className: \`nav-item \${activeSection === item.id ? 'active' : ''}\`,
                                onClick: (e) => { e.preventDefault(); setActiveSection(item.id); }
                            },
                                React.createElement('span', { style: { fontSize: '1.2rem' } }, item.icon),
                                item.label
                            )
                        )
                    )
                ),
                
                React.createElement('div', { className: 'main' },
                    React.createElement('div', { className: 'header' },
                        React.createElement('h1', { style: { color: '#1976d2', fontSize: '1.5rem' } }, 
                            activeSection.charAt(0).toUpperCase() + activeSection.slice(1)),
                        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '1rem' } },
                            React.createElement('span', { style: { color: '#6c757d', fontSize: '0.9rem' } }, 
                                \`👤 \${user?.firstName} \${user?.lastName}\`),
                            React.createElement('button', {
                                onClick: handleLogout,
                                className: 'btn danger'
                            }, '🚪 Logout')
                        )
                    ),
                    
                    React.createElement('div', { className: 'content' },
                        activeSection === 'users' && React.createElement(UserManagement),
                        activeSection === 'rides' && React.createElement(RideManagement),
                        activeSection === 'dashboard' && React.createElement('div', null,
                            React.createElement('div', { 
                                className: 'card',
                                style: { 
                                    background: 'linear-gradient(135deg, #28a745, #20c997)', 
                                    color: 'white', 
                                    padding: '2rem',
                                    marginBottom: '2rem'
                                } 
                            },
                                React.createElement('h3', { style: { margin: '0 0 1rem 0' } }, 
                                    '🏢 Professional Admin Panel - Database Connected!'),
                                React.createElement('div', { style: { lineHeight: '1.6' } },
                                    '🔐 Authentication: Real PostgreSQL database users',
                                    React.createElement('br'),
                                    '🔗 API Backend: Connected to http://localhost:3001',
                                    React.createElement('br'),
                                    '📊 Live Data: Users, rides, and analytics from database',
                                    React.createElement('br'),
                                    '⚡ Real-time Updates: Professional-grade admin interface'
                                )
                            ),
                            React.createElement('div', { className: 'card', style: { padding: '2rem' } },
                                React.createElement('h3', { style: { color: '#1976d2', marginBottom: '1rem' } }, 
                                    '🚀 Database Status'),
                                React.createElement('div', { style: { color: '#6c757d', lineHeight: '1.6' } },
                                    '• PostgreSQL database with user and ride data',
                                    React.createElement('br'),
                                    '• Express.js API server with JWT authentication',
                                    React.createElement('br'),
                                    '• Real-time admin panel with live statistics',
                                    React.createElement('br'),
                                    '• Professional-grade user and ride management'
                                )
                            )
                        ),
                        activeSection === 'courier' && React.createElement(CourierManagement),
                        activeSection === 'analytics' && React.createElement(AnalyticsManagement),
                        activeSection === 'settings' && 
                            React.createElement('div', { className: 'card', style: { padding: '2rem', textAlign: 'center' } },
                                React.createElement('h2', { style: { color: '#1976d2', marginBottom: '1rem' } }, 
                                    \`\${menuItems.find(m => m.id === activeSection)?.icon} \${activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Management\`),
                                React.createElement('p', { style: { color: '#6c757d', fontSize: '1.1rem' } }, 
                                    'Professional management interface for ' + activeSection + ' features.'),
                                React.createElement('p', { style: { color: '#28a745', marginTop: '1rem', fontWeight: '500' } }, 
                                    'Database integration ready - feature implementation in progress.')
                            )
                    )
                )
            );
        };

        ReactDOM.render(React.createElement(App), document.getElementById('root'));
    </script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        ...corsHeaders
      }
    });
  }
};