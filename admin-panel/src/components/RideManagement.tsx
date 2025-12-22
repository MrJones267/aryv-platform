import React, { useState, useEffect } from 'react';

interface Ride {
  id: string;
  driverId: string;
  driverName: string;
  route: {
    from: string;
    to: string;
  };
  departureTime: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  passengers: {
    booked: number;
    capacity: number;
  };
  price: number;
  distance: number;
  created: string;
}

export const RideManagement: React.FC = () => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedRides, setSelectedRides] = useState<Set<string>>(new Set());

  // Fetch rides from API
  useEffect(() => {
    const fetchRides = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/rides');
        const data = await response.json();
        
        if (data.success) {
          setRides(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch rides:', error);
        // Fallback to mock data if API fails
        const mockRides: Ride[] = [
          {
            id: 'R001',
            driverId: 'D001',
            driverName: 'John Smith',
            route: { from: 'Downtown', to: 'Airport' },
            departureTime: '2025-12-14T08:00:00',
            status: 'scheduled',
            passengers: { booked: 3, capacity: 4 },
            price: 45,
            distance: 25.5,
            created: '2025-12-13T10:30:00'
          }
        ];
        setRides(mockRides);
      }
    };
    
    fetchRides();
  }, []);

  // Filter rides
  const filteredRides = rides.filter(ride => {
    const matchesSearch = 
      ride.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ride.route.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ride.route.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ride.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || ride.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const handleRideAction = (rideId: string, action: string) => {
    setRides(prevRides => 
      prevRides.map(ride => {
        if (ride.id === rideId) {
          switch (action) {
            case 'cancel':
              return { ...ride, status: 'cancelled' as const };
            case 'activate':
              return { ...ride, status: 'active' as const };
            case 'complete':
              return { ...ride, status: 'completed' as const };
            default:
              return ride;
          }
        }
        return ride;
      })
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return '#2196f3';
      case 'active': return '#4caf50';
      case 'completed': return '#9e9e9e';
      case 'cancelled': return '#f44336';
      default: return '#666';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return '📅';
      case 'active': return '🚗';
      case 'completed': return '✅';
      case 'cancelled': return '❌';
      default: return '❓';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateRevenue = (rides: Ride[]) => {
    return rides
      .filter(ride => ride.status === 'completed')
      .reduce((sum, ride) => sum + (ride.price * ride.passengers.booked), 0);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: '#1976d2', margin: 0 }}>🚗 Ride Management</h2>
          <button
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
            📊 Generate Report
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
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1976d2' }}>{rides.length}</div>
            <div style={{ color: '#666', fontSize: '0.8rem' }}>Total Rides</div>
          </div>
          <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4caf50' }}>
              {rides.filter(r => r.status === 'active').length}
            </div>
            <div style={{ color: '#666', fontSize: '0.8rem' }}>Active Now</div>
          </div>
          <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2196f3' }}>
              {rides.filter(r => r.status === 'scheduled').length}
            </div>
            <div style={{ color: '#666', fontSize: '0.8rem' }}>Scheduled</div>
          </div>
          <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4caf50' }}>
              ${calculateRevenue(rides)}
            </div>
            <div style={{ color: '#666', fontSize: '0.8rem' }}>Revenue</div>
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
            placeholder="Search rides, drivers, routes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              minWidth: '250px',
              fontSize: '0.9rem'
            }}
          />
          
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
            <option value="scheduled">Scheduled</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #1976d2',
              borderRadius: '4px',
              background: 'white',
              color: '#1976d2',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            🌍 Map View
          </button>
        </div>
      </div>

      {/* Rides Table */}
      <div style={{
        background: 'white',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', color: '#666' }}>
                Ride ID
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', color: '#666' }}>
                Driver
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', color: '#666' }}>
                Route
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', color: '#666' }}>
                Departure
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', color: '#666' }}>
                Passengers
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', color: '#666' }}>
                Status
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', color: '#666' }}>
                Price
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.9rem', color: '#666' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRides.map((ride) => (
              <tr key={ride.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: '500' }}>
                  {ride.id}
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{ride.driverName}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>ID: {ride.driverId}</div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.9rem' }}>
                    <span style={{ color: '#4caf50' }}>📍 {ride.route.from}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#666', margin: '0.25rem 0' }}>
                    ↓ {ride.distance} km
                  </div>
                  <div style={{ fontSize: '0.9rem' }}>
                    <span style={{ color: '#f44336' }}>📍 {ride.route.to}</span>
                  </div>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                  {formatDateTime(ride.departureTime)}
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <div style={{ 
                    background: ride.passengers.booked === ride.passengers.capacity ? '#ffebee' : '#e8f5e8',
                    color: ride.passengers.booked === ride.passengers.capacity ? '#c62828' : '#2e7d32',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: '500'
                  }}>
                    {ride.passengers.booked}/{ride.passengers.capacity}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.25rem' }}>
                    {ride.passengers.capacity - ride.passengers.booked} seats left
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    background: getStatusColor(ride.status),
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    {getStatusIcon(ride.status)} {ride.status}
                  </span>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: '500' }}>
                  ${ride.price}
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {ride.status === 'scheduled' && (
                      <>
                        <button
                          onClick={() => handleRideAction(ride.id, 'activate')}
                          style={{
                            background: '#4caf50',
                            color: 'white',
                            border: 'none',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                          title="Start ride"
                        >
                          ▶️
                        </button>
                        <button
                          onClick={() => handleRideAction(ride.id, 'cancel')}
                          style={{
                            background: '#f44336',
                            color: 'white',
                            border: 'none',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                          title="Cancel ride"
                        >
                          ❌
                        </button>
                      </>
                    )}
                    
                    {ride.status === 'active' && (
                      <button
                        onClick={() => handleRideAction(ride.id, 'complete')}
                        style={{
                          background: '#2196f3',
                          color: 'white',
                          border: 'none',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                        title="Complete ride"
                      >
                        🏁
                      </button>
                    )}
                    
                    <button
                      style={{
                        background: '#666',
                        color: 'white',
                        border: 'none',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                      title="View details"
                    >
                      👁️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredRides.length === 0 && (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            color: '#666',
            fontSize: '0.9rem'
          }}>
            No rides found matching your criteria.
          </div>
        )}
      </div>

      {/* Live Status Panel */}
      <div style={{
        background: 'linear-gradient(135deg, #1976d2, #42a5f5)',
        color: 'white',
        borderRadius: '8px',
        padding: '1.5rem',
        marginTop: '2rem'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>🔴 Live Ride Monitoring</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              {rides.filter(r => r.status === 'active').length}
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Rides Currently Active</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              {rides.reduce((sum, r) => r.status === 'active' ? sum + r.passengers.booked : sum, 0)}
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Passengers on the Road</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              {rides.filter(r => r.status === 'scheduled' && new Date(r.departureTime) <= new Date(Date.now() + 30*60*1000)).length}
            </div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Departing in 30min</div>
          </div>
        </div>
      </div>
    </div>
  );
};