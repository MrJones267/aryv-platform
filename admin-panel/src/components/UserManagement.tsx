import React, { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'driver' | 'passenger' | 'both';
  status: 'active' | 'pending' | 'blocked';
  verified: boolean;
  joinDate: string;
  lastActive: string;
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showAddUser, setShowAddUser] = useState(false);

  // Fetch users from API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/users');
        const data = await response.json();
        
        if (data.success) {
          setUsers(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
        // Fallback to mock data if API fails
        const mockUsers: User[] = [
          {
            id: '1',
            name: 'John Smith',
            email: 'john.smith@email.com',
            role: 'driver',
            status: 'active',
            verified: true,
            joinDate: '2025-01-15',
            lastActive: '2025-12-13'
          }
        ];
        setUsers(mockUsers);
      }
    };
    
    fetchUsers();
  }, []);

  // Filter users based on search and filters
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleUserAction = (userId: string, action: string) => {
    setUsers(prevUsers => 
      prevUsers.map(user => {
        if (user.id === userId) {
          switch (action) {
            case 'verify':
              return { ...user, verified: true };
            case 'unverify':
              return { ...user, verified: false };
            case 'activate':
              return { ...user, status: 'active' as const };
            case 'block':
              return { ...user, status: 'blocked' as const };
            case 'delete':
              return user; // In real app, would remove user
            default:
              return user;
          }
        }
        return user;
      })
    );
  };

  const handleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'pending': return '#ff9800';
      case 'blocked': return '#f44336';
      default: return '#666';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'driver': return '🚗';
      case 'passenger': return '👤';
      case 'both': return '🚗👤';
      default: return '👤';
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: '#1976d2', margin: 0 }}>👥 User Management</h2>
          <button
            onClick={() => setShowAddUser(true)}
            style={{
              background: '#1976d2',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            ➕ Add New User
          </button>
        </div>

        {/* Statistics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1976d2' }}>{users.length}</div>
            <div style={{ color: '#666', fontSize: '0.8rem' }}>Total Users</div>
          </div>
          <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4caf50' }}>
              {users.filter(u => u.status === 'active').length}
            </div>
            <div style={{ color: '#666', fontSize: '0.8rem' }}>Active</div>
          </div>
          <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff9800' }}>
              {users.filter(u => u.status === 'pending').length}
            </div>
            <div style={{ color: '#666', fontSize: '0.8rem' }}>Pending</div>
          </div>
          <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f44336' }}>
              {users.filter(u => u.status === 'blocked').length}
            </div>
            <div style={{ color: '#666', fontSize: '0.8rem' }}>Blocked</div>
          </div>
        </div>

        {/* Search and Filters */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              minWidth: '200px',
              fontSize: '0.9rem'
            }}
          />
          
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '0.9rem'
            }}
          >
            <option value="all">All Roles</option>
            <option value="driver">Drivers</option>
            <option value="passenger">Passengers</option>
            <option value="both">Both</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '0.9rem'
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="blocked">Blocked</option>
          </select>

          {selectedUsers.size > 0 && (
            <div style={{ marginLeft: 'auto', fontSize: '0.9rem', color: '#666' }}>
              {selectedUsers.size} user(s) selected
            </div>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div style={{
        background: 'white',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        overflow: 'hidden'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse'
        }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '1rem 0.5rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>
                <input
                  type="checkbox"
                  checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', color: '#666' }}>
                User
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', color: '#666' }}>
                Role
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', color: '#666' }}>
                Status
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', color: '#666' }}>
                Verified
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', color: '#666' }}>
                Join Date
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', color: '#666' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '1rem 0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(user.id)}
                    onChange={() => handleSelectUser(user.id)}
                  />
                </td>
                <td style={{ padding: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{user.name}</div>
                    <div style={{ color: '#666', fontSize: '0.8rem' }}>{user.email}</div>
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ fontSize: '0.9rem' }}>
                    {getRoleIcon(user.role)} {user.role}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    background: getStatusColor(user.status),
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: '500'
                  }}>
                    {user.status}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>
                    {user.verified ? '✅' : '❌'}
                  </span>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#666' }}>
                  {new Date(user.joinDate).toLocaleDateString()}
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleUserAction(user.id, user.verified ? 'unverify' : 'verify')}
                      style={{
                        background: user.verified ? '#ff9800' : '#4caf50',
                        color: 'white',
                        border: 'none',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                      title={user.verified ? 'Remove verification' : 'Verify user'}
                    >
                      {user.verified ? '📝' : '✅'}
                    </button>
                    
                    <button
                      onClick={() => handleUserAction(user.id, user.status === 'blocked' ? 'activate' : 'block')}
                      style={{
                        background: user.status === 'blocked' ? '#4caf50' : '#f44336',
                        color: 'white',
                        border: 'none',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                      title={user.status === 'blocked' ? 'Unblock user' : 'Block user'}
                    >
                      {user.status === 'blocked' ? '🔓' : '🔒'}
                    </button>
                    
                    <button
                      onClick={() => handleUserAction(user.id, 'delete')}
                      style={{
                        background: '#666',
                        color: 'white',
                        border: 'none',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                      title="View user details"
                    >
                      👁️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            color: '#666',
            fontSize: '0.9rem'
          }}>
            No users found matching your criteria.
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (
        <div style={{
          background: '#e3f2fd',
          border: '1px solid #1976d2',
          borderRadius: '8px',
          padding: '1rem',
          marginTop: '1rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.9rem', color: '#1976d2' }}>
            Bulk Actions ({selectedUsers.size} selected):
          </span>
          <button
            onClick={() => console.log('Bulk verify')}
            style={{
              background: '#4caf50',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            ✅ Verify All
          </button>
          <button
            onClick={() => console.log('Bulk block')}
            style={{
              background: '#f44336',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            🔒 Block All
          </button>
          <button
            onClick={() => console.log('Export selected')}
            style={{
              background: '#1976d2',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            📥 Export
          </button>
        </div>
      )}
    </div>
  );
};