import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BusFront,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Plus,
  Route as RouteIcon,
  ShieldCheck,
  Users,
  X,
  ArrowUpRight,
  RefreshCw,
  KeyRound,
  LocateFixed,
  Send,
} from 'lucide-react';
import { api } from './api';
import MapPanel from './components/MapPanel';

const emptyForms = {
  route: { name: '', start_point: '', end_point: '', stops: '' },
  bus: { bus_number: '', plate_number: '', capacity: 40, route_id: '' },
  user: { email: '', full_name: '', password: '', role: 'driver', assigned_bus_id: '' },
};

function timeAgo(value) {
  if (!value) return 'No signal';
  const date = new Date(value);
  if (isNaN(date.getTime())) return 'No signal';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function initials(name = '') {
  return (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('schoolbus-session') || 'null');
    } catch {
      return null;
    }
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState('overview');
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState('');
  const [modalError, setModalError] = useState('');
  const [forms, setForms] = useState(emptyForms);
  const [mobileNav, setMobileNav] = useState(false);
  const [gps, setGps] = useState({ latitude: '', longitude: '', speed_kph: 0 });

  const role = session?.user?.role;

  const signOut = useCallback(() => {
    sessionStorage.removeItem('schoolbus-session');
    setSession(null);
    setBuses([]);
    setRoutes([]);
    setUsers([]);
    setActive('overview');
    setError('');
    setNotice('');
  }, []);

  const loadData = useCallback(
    async (quiet = false) => {
      if (!session?.access_token) return;
      if (!quiet) setLoading(true);
      try {
        const busData = await api('/tracking/buses', { token: session.access_token });
        setBuses(busData);
        if (role === 'admin') {
          const [r, u] = await Promise.all([
            api('/admin/routes', { token: session.access_token }),
            api('/admin/users', { token: session.access_token }),
          ]);
          setRoutes(r);
          setUsers(u);
        }
        setError('');
      } catch (e) {
        if (e.status === 401 || (e.message && e.message.toLowerCase().includes('credential'))) {
          signOut();
          setLoginError('Your session has expired. Please sign in again.');
          return;
        }
        setError(e.message);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [session, role, signOut]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => loadData(true), 15000);
    return () => clearInterval(timer);
  }, [session, loadData]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setModal('');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const stats = useMemo(
    () => ({
      buses: buses.length,
      active: buses.filter(
        (b) => b.location && Date.now() - new Date(b.location.updated_at).getTime() < 120000
      ).length,
      routes: new Set(buses.map((b) => b.route_id).filter(Boolean)).size,
      drivers: users.filter((u) => u.role === 'driver').length,
    }),
    [buses, users]
  );

  async function signIn(e) {
    e.preventDefault();
    setBusy(true);
    setLoginError('');
    try {
      const result = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      sessionStorage.setItem('schoolbus-session', JSON.stringify(result));
      setSession(result);
      setActive('overview');
      setPassword('');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function openModal(kind) {
    setForms(emptyForms);
    setModalError('');
    setModal(kind);
    setNotice('');
  }

  async function submitModal(e) {
    e.preventDefault();
    setModalError('');
    try {
      let path = '';
      let body = {};
      if (modal === 'route') {
        path = '/admin/routes';
        body = {
          ...forms.route,
          stops: forms.route.stops
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        };
      }
      if (modal === 'bus') {
        path = '/admin/buses';
        body = {
          ...forms.bus,
          capacity: Number(forms.bus.capacity) || 40,
          route_id: forms.bus.route_id ? Number(forms.bus.route_id) : null,
        };
      }
      if (modal === 'user') {
        path = '/admin/users';
        body = {
          ...forms.user,
          assigned_bus_id: forms.user.assigned_bus_id
            ? Number(forms.user.assigned_bus_id)
            : null,
        };
      }
      await api(path, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify(body),
      });
      setModal('');
      setModalError('');
      setNotice('Changes saved successfully.');
      await loadData();
    } catch (err) {
      setModalError(err.message);
    }
  }

  async function sendLocation(e) {
    e.preventDefault();
    const lat = Number(gps.latitude);
    const lon = Number(gps.longitude);
    if (!gps.latitude || isNaN(lat) || lat < -90 || lat > 90) {
      setError('Please provide a valid latitude between -90 and 90.');
      return;
    }
    if (!gps.longitude || isNaN(lon) || lon < -180 || lon > 180) {
      setError('Please provide a valid longitude between -180 and 180.');
      return;
    }
    try {
      const payload = {
        latitude: lat,
        longitude: lon,
        speed_kph: Math.max(0, Math.min(250, Number(gps.speed_kph || 0))),
      };
      await api('/driver/location', {
        method: 'PUT',
        token: session.access_token,
        body: JSON.stringify(payload),
      });
      setNotice('Location updated successfully.');
      await loadData(true);
    } catch (err) {
      setError(err.message);
    }
  }

  function useBrowserLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGps((g) => ({
          ...g,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        })),
      () => setError('Could not read location. Allow location access and try again.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  if (!session)
    return (
      <Login
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        onSubmit={signIn}
        busy={busy}
        error={loginError}
      />
    );

  const navItems =
    role === 'admin'
      ? [
          ['overview', 'Overview', LayoutDashboard],
          ['fleet', 'Fleet & routes', BusFront],
          ['people', 'People', Users],
        ]
      : role === 'driver'
      ? [
          ['overview', 'My bus', BusFront],
          ['location', 'Update location', LocateFixed],
        ]
      : [['overview', 'Bus tracker', MapPinned]];

  const title = navItems.find((n) => n[0] === active)?.[1] || 'Overview';
  const firstName = session.user.full_name ? session.user.full_name.split(' ')[0] : 'User';

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <BusFront size={23} />
          </div>
          <div>
            <strong>northstar</strong>
            <span>SCHOOL TRANSPORT</span>
          </div>
          <button className="mobile-close icon-button" onClick={() => setMobileNav(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="school-switch">
          <div className="school-avatar">N</div>
          <div>
            <strong>Northstar Academy</strong>
            <span>Transport workspace</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navItems.map(([key, label, Icon]) => (
            <button
              key={key}
              className={`nav-item ${active === key ? 'nav-active' : ''}`}
              onClick={() => {
                setActive(key);
                setMobileNav(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {key === 'overview' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">
              <CircleHelp size={18} />
            </div>
            <strong>Need a hand?</strong>
            <p>Get help with your transport workspace.</p>
            <a href="mailto:transport-support@example.com">
              Contact support <ArrowUpRight size={13} />
            </a>
          </div>
          <div className="profile">
            <div className="profile-avatar">{initials(session.user.full_name)}</div>
            <div className="profile-copy">
              <strong>{session.user.full_name}</strong>
              <span>
                {role === 'admin'
                  ? 'School administrator'
                  : role === 'driver'
                  ? 'Bus driver'
                  : 'Parent account'}
              </span>
            </div>
            <button className="icon-button" title="Sign out" onClick={signOut}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {mobileNav && <button className="scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-button" onClick={() => setMobileNav(true)}>
              <Menu size={20} />
            </button>
            <div className="breadcrumbs">
              Workspace <span>/</span> <strong>{title}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <span className="today-label">
              <span className="status-dot" /> Transport operations
            </span>
            <button className="icon-button" onClick={() => loadData()} title="Refresh data">
              <RefreshCw size={17} />
            </button>
            <div className="top-avatar">{initials(session.user.full_name)}</div>
          </div>
        </header>

        <div className="page-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow">MONDAY — TRANSPORT CONTROL</div>
              <h1>
                {role === 'parent'
                  ? 'Your school bus'
                  : role === 'driver'
                  ? 'Your route today'
                  : `${getGreeting()}, ${firstName}`}
              </h1>
              <p>
                {role === 'parent'
                  ? 'Follow your assigned school bus and check the route details.'
                  : role === 'driver'
                  ? 'Keep your bus location up to date so families and school staff stay informed.'
                  : 'A clear view of your fleet, routes and daily school journeys.'}
              </p>
            </div>
            <div className="heading-actions">
              <span className="secure-chip">
                <ShieldCheck size={15} /> Secure workspace
              </span>
              {role === 'admin' && (
                <button className="primary-button" onClick={() => openModal('bus')}>
                  <Plus size={17} /> Add a bus
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
              <button onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert alert-success">
              <Check size={16} />
              {notice}
              <button onClick={() => setNotice('')}>
                <X size={16} />
              </button>
            </div>
          )}

          {active === 'location' && role === 'driver' && (
            <section className="content-card location-form-card">
              <div className="section-heading">
                <div className="section-icon">
                  <LocateFixed size={19} />
                </div>
                <div>
                  <h2>Update bus location</h2>
                  <p>Share current coordinates for your assigned bus.</p>
                </div>
              </div>
              <form className="form-grid" onSubmit={sendLocation}>
                <label>
                  Latitude
                  <input
                    required
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    value={gps.latitude}
                    onChange={(e) => setGps({ ...gps, latitude: e.target.value })}
                    placeholder="13.0827"
                  />
                </label>
                <label>
                  Longitude
                  <input
                    required
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    value={gps.longitude}
                    onChange={(e) => setGps({ ...gps, longitude: e.target.value })}
                    placeholder="80.2707"
                  />
                </label>
                <label>
                  Speed (km/h)
                  <input
                    type="number"
                    min="0"
                    max="250"
                    value={gps.speed_kph}
                    onChange={(e) => setGps({ ...gps, speed_kph: e.target.value })}
                  />
                </label>
                <div className="form-actions">
                  <button type="button" className="secondary-button" onClick={useBrowserLocation}>
                    <LocateFixed size={16} /> Use device GPS
                  </button>
                  <button className="primary-button">
                    <Send size={16} /> Submit location
                  </button>
                </div>
              </form>
              <p className="muted-note">
                Only submit location while operating your assigned route and in accordance with school policy.
              </p>
            </section>
          )}

          {active === 'overview' && (
            <>
              <div className="stats-grid">
                {(role === 'admin'
                  ? [
                      ['Total buses', stats.buses, BusFront, 'Across your school fleet', 'blue'],
                      ['Live signals', stats.active, Activity, 'Updated in the last 2 min', 'green'],
                      ['Routes assigned', routes.length, RouteIcon, 'Configured school routes', 'violet'],
                      ['Drivers', stats.drivers, Users, 'Registered driver accounts', 'amber'],
                    ]
                  : [
                      [
                        'Assigned bus',
                        buses.length,
                        buses.length ? BusFront : MapPinned,
                        buses[0]?.bus_number || 'No bus assigned',
                        'blue',
                      ],
                      [
                        'Live signal',
                        stats.active,
                        Activity,
                        stats.active ? 'Location is recent' : 'Waiting for update',
                        'green',
                      ],
                      [
                        'Route stops',
                        buses[0]?.route?.stops?.length || 0,
                        RouteIcon,
                        'Stops on your route',
                        'violet',
                      ],
                      [
                        'Last update',
                        buses[0]?.location ? timeAgo(buses[0].location.updated_at) : '—',
                        Clock3,
                        'Latest location report',
                        'amber',
                      ],
                    ]
                ).map(([label, value, Icon, caption, color]) => (
                  <div className="stat-card" key={label}>
                    <div className="stat-top">
                      <span>{label}</span>
                      <div className={`stat-icon ${color}`}>
                        <Icon size={18} />
                      </div>
                    </div>
                    <div className="stat-value">{value}</div>
                    <div className="stat-caption">
                      <span className={`caption-dot ${color}`} />
                      {caption}
                    </div>
                  </div>
                ))}
              </div>

              <div className="dashboard-grid">
                <div className="dashboard-main">
                  <MapPanel buses={buses} />
                  <section className="content-card route-card">
                    <div className="section-heading section-heading-spread">
                      <div>
                        <div className="eyebrow">YOUR TRANSPORT NETWORK</div>
                        <h2>{role === 'parent' ? 'Your route details' : 'Fleet & route summary'}</h2>
                        <p>
                          {role === 'parent'
                            ? 'Only the bus assigned to your family is shown.'
                            : 'Quick view of the buses and their assigned routes.'}
                        </p>
                      </div>
                      {role === 'admin' && (
                        <button className="text-button" onClick={() => setActive('fleet')}>
                          Manage fleet <ArrowUpRight size={15} />
                        </button>
                      )}
                    </div>
                    {buses.length === 0 ? (
                      <EmptyState
                        title="No buses to show yet"
                        description={
                          role === 'admin'
                            ? 'Create a bus and assign a route to get started.'
                            : 'Ask your school administrator to assign a bus to your account.'
                        }
                      />
                    ) : (
                      <div className="bus-list">
                        {buses.map((bus) => (
                          <div className="bus-row" key={bus.id}>
                            <div className="bus-symbol">
                              <BusFront size={21} />
                            </div>
                            <div className="bus-info">
                              <strong>{bus.bus_number}</strong>
                              <span>
                                {bus.route?.name || 'Route not assigned'} · {bus.plate_number}
                              </span>
                            </div>
                            <div className="bus-meta">
                              <span
                                className={`pill ${
                                  bus.location &&
                                  Date.now() - new Date(bus.location.updated_at).getTime() < 120000
                                    ? 'pill-live'
                                    : 'pill-muted'
                                }`}
                              >
                                <i />
                                {bus.location &&
                                Date.now() - new Date(bus.location.updated_at).getTime() < 120000
                                  ? 'Live'
                                  : 'No signal'}
                              </span>
                              <small>
                                {bus.location ? timeAgo(bus.location.updated_at) : 'Awaiting GPS'}
                              </small>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <div className="dashboard-side">
                  <section className="content-card activity-card">
                    <div className="side-heading">
                      <div>
                        <h2>Service status</h2>
                        <p>Current tracking health</p>
                      </div>
                      <span className="icon-soft">
                        <Activity size={17} />
                      </span>
                    </div>
                    <div className="service-status">
                      <div className="service-check">
                        <Check size={17} />
                      </div>
                      <div>
                        <strong>Tracking service</strong>
                        <span>API connected</span>
                      </div>
                      <span className="service-online">Operational</span>
                    </div>
                    <div className="service-status">
                      <div className="service-check">
                        <Check size={17} />
                      </div>
                      <div>
                        <strong>Account access</strong>
                        <span>Role-based permissions</span>
                      </div>
                      <span className="service-online">Protected</span>
                    </div>
                    <div className="service-footer">
                      <Clock3 size={14} /> Auto-refresh every 15 seconds
                    </div>
                  </section>

                  <section className="content-card route-preview">
                    <div className="side-heading">
                      <div>
                        <h2>{role === 'parent' ? 'Route at a glance' : 'Quick actions'}</h2>
                        <p>{role === 'parent' ? 'Your assigned journey' : 'Common transport tasks'}</p>
                      </div>
                      <span className="icon-soft">
                        <Compass size={17} />
                      </span>
                    </div>
                    {role === 'admin' ? (
                      <div className="quick-actions">
                        <button onClick={() => openModal('route')}>
                          <span className="quick-icon lavender">
                            <RouteIcon size={17} />
                          </span>
                          <span>
                            <strong>Create a route</strong>
                            <small>Add stops and destinations</small>
                          </span>
                          <Plus size={16} />
                        </button>
                        <button onClick={() => openModal('user')}>
                          <span className="quick-icon mint">
                            <Users size={17} />
                          </span>
                          <span>
                            <strong>Add a driver or parent</strong>
                            <small>Set up a role-based account</small>
                          </span>
                          <Plus size={16} />
                        </button>
                        <button onClick={() => setActive('fleet')}>
                          <span className="quick-icon peach">
                            <BusFront size={17} />
                          </span>
                          <span>
                            <strong>View all buses</strong>
                            <small>Review fleet assignments</small>
                          </span>
                          <ArrowUpRight size={16} />
                        </button>
                      </div>
                    ) : buses[0]?.route ? (
                      <>
                        <div className="route-endpoint">
                          <span className="endpoint-dot start" />
                          <div>
                            <small>STARTING POINT</small>
                            <strong>{buses[0].route.start_point}</strong>
                          </div>
                        </div>
                        <div className="route-stops-line">
                          {(buses[0].route.stops || []).map((stop, i) => (
                            <div key={i}>
                              <span />
                              {stop}
                            </div>
                          ))}
                        </div>
                        <div className="route-endpoint">
                          <span className="endpoint-dot end" />
                          <div>
                            <small>DESTINATION</small>
                            <strong>{buses[0].route.end_point}</strong>
                          </div>
                        </div>
                      </>
                    ) : (
                      <EmptyState
                        title="Route not assigned"
                        description="Route information will appear after your bus is assigned."
                      />
                    )}
                  </section>
                </div>
              </div>
            </>
          )}

          {active === 'fleet' && role === 'admin' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              <section className="content-card management-card">
                <div className="section-heading section-heading-spread">
                  <div>
                    <h2>Manage fleet</h2>
                    <p>Configured school buses and their route assignments.</p>
                  </div>
                  <button className="primary-button" onClick={() => openModal('bus')}>
                    <Plus size={16} /> Add bus
                  </button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>BUS</th>
                        <th>REGISTRATION</th>
                        <th>ROUTE</th>
                        <th>CAPACITY</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buses.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                            No buses added yet. Click &quot;Add bus&quot; to configure your first bus.
                          </td>
                        </tr>
                      ) : (
                        buses.map((b) => (
                          <tr key={b.id}>
                            <td>
                              <strong>{b.bus_number}</strong>
                            </td>
                            <td>{b.plate_number}</td>
                            <td>{b.route?.name || routes.find((r) => r.id === b.route_id)?.name || 'Unassigned'}</td>
                            <td>{b.capacity} seats</td>
                            <td>
                              <span className={`pill ${b.location ? 'pill-live' : 'pill-muted'}`}>
                                <i />
                                {b.location ? 'Signal received' : 'No signal'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="inline-actions">
                  <button className="secondary-button" onClick={() => openModal('route')}>
                    <Plus size={15} /> Add route
                  </button>
                  <button className="secondary-button" onClick={() => openModal('user')}>
                    <Plus size={15} /> Add driver / parent
                  </button>
                </div>
              </section>

              <section className="content-card management-card">
                <div className="section-heading section-heading-spread">
                  <div>
                    <h2>Configured routes</h2>
                    <p>All school routes with origin, destination, and intermediate stops.</p>
                  </div>
                  <button className="primary-button" onClick={() => openModal('route')}>
                    <Plus size={16} /> Add route
                  </button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ROUTE NAME</th>
                        <th>START POINT</th>
                        <th>DESTINATION</th>
                        <th>STOPS</th>
                        <th>BUSES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routes.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                            No routes created yet. Click &quot;Add route&quot; to add a route.
                          </td>
                        </tr>
                      ) : (
                        routes.map((r) => {
                          const assignedBuses = buses.filter((b) => b.route_id === r.id);
                          return (
                            <tr key={r.id}>
                              <td>
                                <strong>{r.name}</strong>
                              </td>
                              <td>{r.start_point}</td>
                              <td>{r.end_point}</td>
                              <td>
                                {r.stops && r.stops.length > 0 ? (
                                  <span style={{ fontSize: '12px' }}>{r.stops.join(', ')}</span>
                                ) : (
                                  <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Direct route</span>
                                )}
                              </td>
                              <td>
                                {assignedBuses.length > 0 ? (
                                  assignedBuses.map((b) => b.bus_number).join(', ')
                                ) : (
                                  <span style={{ color: 'var(--muted)' }}>None</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {active === 'people' && role === 'admin' && (
            <section className="content-card management-card">
              <div className="section-heading section-heading-spread">
                <div>
                  <h2>People & access</h2>
                  <p>Driver and parent accounts, with assigned buses.</p>
                </div>
                <button className="primary-button" onClick={() => openModal('user')}>
                  <Plus size={16} /> Add account
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>PERSON</th>
                      <th>EMAIL</th>
                      <th>ROLE</th>
                      <th>ASSIGNED BUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                          No accounts created yet. Click &quot;Add account&quot; to register a driver or parent.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <strong>{u.full_name}</strong>
                          </td>
                          <td>{u.email}</td>
                          <td>
                            <span className="role-label">{u.role}</span>
                          </td>
                          <td>
                            {buses.find((b) => b.id === u.assigned_bus_id)?.bus_number || 'Unassigned'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <footer className="page-footer">
            <span>© 2026 Northstar Transport</span>
            <span>
              <ShieldCheck size={14} /> Student safety comes first
            </span>
            <span>
              {loading ? 'Refreshing data…' : 'Data refreshes automatically'}{' '}
              <button onClick={() => loadData()}>
                <RefreshCw size={13} />
              </button>
            </span>
          </footer>
        </div>
      </main>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal('')}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">TRANSPORT SETUP</span>
                <h2>
                  {modal === 'route'
                    ? 'Create a route'
                    : modal === 'bus'
                    ? 'Add a bus'
                    : 'Create an account'}
                </h2>
              </div>
              <button className="icon-button" onClick={() => setModal('')}>
                <X size={18} />
              </button>
            </div>
            {modalError && (
              <div className="alert alert-error" style={{ margin: '14px 0 0' }}>
                <span>{modalError}</span>
                <button type="button" onClick={() => setModalError('')}>
                  <X size={16} />
                </button>
              </div>
            )}
            <form onSubmit={submitModal} className="modal-form">
              {modal === 'route' && (
                <>
                  <label>
                    Route name
                    <input
                      required
                      minLength="2"
                      value={forms.route.name}
                      onChange={(e) =>
                        setForms({ ...forms, route: { ...forms.route, name: e.target.value } })
                      }
                      placeholder="e.g. North Avenue"
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Start point
                      <input
                        required
                        value={forms.route.start_point}
                        onChange={(e) =>
                          setForms({
                            ...forms,
                            route: { ...forms.route, start_point: e.target.value },
                          })
                        }
                        placeholder="Bus depot"
                      />
                    </label>
                    <label>
                      Destination
                      <input
                        required
                        value={forms.route.end_point}
                        onChange={(e) =>
                          setForms({
                            ...forms,
                            route: { ...forms.route, end_point: e.target.value },
                          })
                        }
                        placeholder="School campus"
                      />
                    </label>
                  </div>
                  <label>
                    Stops <span className="label-optional">comma-separated</span>
                    <input
                      value={forms.route.stops}
                      onChange={(e) =>
                        setForms({ ...forms, route: { ...forms.route, stops: e.target.value } })
                      }
                      placeholder="Park Street, Library, Main Road"
                    />
                  </label>
                </>
              )}
              {modal === 'bus' && (
                <>
                  <div className="form-grid">
                    <label>
                      Bus number
                      <input
                        required
                        value={forms.bus.bus_number}
                        onChange={(e) =>
                          setForms({ ...forms, bus: { ...forms.bus, bus_number: e.target.value } })
                        }
                        placeholder="BUS-01"
                      />
                    </label>
                    <label>
                      Registration number
                      <input
                        required
                        value={forms.bus.plate_number}
                        onChange={(e) =>
                          setForms({
                            ...forms,
                            bus: { ...forms.bus, plate_number: e.target.value },
                          })
                        }
                        placeholder="TN01AB1234"
                      />
                    </label>
                  </div>
                  <div className="form-grid">
                    <label>
                      Seat capacity
                      <input
                        required
                        type="number"
                        min="1"
                        max="100"
                        value={forms.bus.capacity}
                        onChange={(e) =>
                          setForms({ ...forms, bus: { ...forms.bus, capacity: e.target.value } })
                        }
                      />
                    </label>
                    <label>
                      Assigned route
                      <select
                        value={forms.bus.route_id}
                        onChange={(e) =>
                          setForms({ ...forms, bus: { ...forms.bus, route_id: e.target.value } })
                        }
                      >
                        <option value="">No route yet</option>
                        {routes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              )}
              {modal === 'user' && (
                <>
                  <label>
                    Full name
                    <input
                      required
                      minLength="2"
                      value={forms.user.full_name}
                      onChange={(e) =>
                        setForms({ ...forms, user: { ...forms.user, full_name: e.target.value } })
                      }
                      placeholder="Full name"
                    />
                  </label>
                  <label>
                    Email address
                    <input
                      required
                      type="email"
                      value={forms.user.email}
                      onChange={(e) =>
                        setForms({ ...forms, user: { ...forms.user, email: e.target.value } })
                      }
                      placeholder="name@example.com"
                    />
                  </label>
                  <label>
                    Temporary password{' '}
                    <span className="label-optional">minimum 12 characters</span>
                    <input
                      required
                      minLength="12"
                      type="password"
                      value={forms.user.password}
                      onChange={(e) =>
                        setForms({ ...forms, user: { ...forms.user, password: e.target.value } })
                      }
                      placeholder="Create a strong password"
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Account role
                      <select
                        value={forms.user.role}
                        onChange={(e) =>
                          setForms({ ...forms, user: { ...forms.user, role: e.target.value } })
                        }
                      >
                        <option value="driver">Bus / driver</option>
                        <option value="parent">Parent</option>
                      </select>
                    </label>
                    <label>
                      Assigned bus
                      <select
                        value={forms.user.assigned_bus_id}
                        onChange={(e) =>
                          setForms({
                            ...forms,
                            user: { ...forms.user, assigned_bus_id: e.target.value },
                          })
                        }
                      >
                        <option value="">Not assigned</option>
                        {buses.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bus_number}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              )}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setModal('')}>
                  Cancel
                </button>
                <button className="primary-button">
                  <Check size={16} /> Save changes
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <div>
        <BusFront size={21} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function Login({ email, setEmail, password, setPassword, onSubmit, busy, error }) {
  return (
    <div className="login-screen">
      <div className="login-decoration decoration-a" />
      <div className="login-decoration decoration-b" />
      <section className="login-panel">
        <div className="login-brand">
          <div className="brand-mark">
            <BusFront size={23} />
          </div>
          <div>
            <strong>northstar</strong>
            <span>SCHOOL TRANSPORT</span>
          </div>
        </div>
        <div className="login-intro">
          <span className="eyebrow">TRANSPORT, IN SYNC</span>
          <h1>
            Every journey.
            <br />
            <em>In good hands.</em>
          </h1>
          <p>
            A calmer, clearer view of your school transport network — from the first pickup to the
            school gate.
          </p>
        </div>
        <div className="login-highlights">
          <div>
            <span>
              <MapPinned size={17} />
            </span>
            <div>
              <strong>Live bus visibility</strong>
              <small>See the right bus at the right time.</small>
            </div>
          </div>
          <div>
            <span>
              <ShieldCheck size={17} />
            </span>
            <div>
              <strong>Private by design</strong>
              <small>Each account sees only what it should.</small>
            </div>
          </div>
        </div>
        <div className="login-copyright">
          © 2026 Northstar Academy <span>·</span> School transport portal
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <div className="welcome-icon">
            <KeyRound size={21} />
          </div>
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Sign in to your portal</h2>
          <p className="login-subtitle">Use the account provided by your school administrator.</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={onSubmit} className="login-form">
            <label>
              Email address
              <div className="input-with-icon">
                <Users size={17} />
                <input
                  required
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                />
              </div>
            </label>
            <label>
              Password
              <div className="input-with-icon">
                <KeyRound size={17} />
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
            </label>
            <button className="primary-button login-submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in securely'} <ArrowUpRight size={17} />
            </button>
          </form>
          <div className="login-security">
            <ShieldCheck size={15} /> Protected access for school staff, drivers and families
          </div>
          <div className="login-bottom">Need access? Contact your school administrator.</div>
        </div>
      </section>
    </div>
  );
}
