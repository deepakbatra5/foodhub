import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../../api';
import { currentUser, logout } from '../../auth';

const ORDER_STATUSES = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];

const EMPTY_RESTAURANT_FORM = {
  name: '',
  cuisine: '',
  rating: '4.2',
  location: '',
  image: '',
  deliveryTime: '30-40'
};

const EMPTY_MENU_FORM = {
  restaurantId: '',
  name: '',
  price: '',
  description: '',
  image: '',
  category: 'Main Course',
  isVeg: true,
  isBestseller: false
};

function getErrorMessage(error, fallbackMessage) {
  const candidate = error?.response?.data?.error ?? error?.message;
  return typeof candidate === 'string' && candidate.trim() ? candidate : fallbackMessage;
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toLocaleString()}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function adminRequest(method, path, data) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  try {
    return await api.request({
      method,
      url: `/api/admin${normalizedPath}`,
      data
    });
  } catch (error) {
    if (error?.response?.status !== 404) {
      throw error;
    }

    return api.request({
      method,
      url: `/admin${normalizedPath}`,
      data
    });
  }
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const user = currentUser();
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState({ userCount: 0, orderCount: 0, restaurantCount: 0, menuItemCount: 0, revenue: 0 });
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [restaurantForm, setRestaurantForm] = useState(EMPTY_RESTAURANT_FORM);
  const [menuForm, setMenuForm] = useState(EMPTY_MENU_FORM);
  const [editingRestaurantId, setEditingRestaurantId] = useState(null);
  const [editingMenuItemId, setEditingMenuItemId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const selectedRestaurant = useMemo(
    () => asArray(restaurants).find((restaurant) => String(restaurant.id) === String(selectedRestaurantId)) || null,
    [restaurants, selectedRestaurantId]
  );

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAdminData();
    }
  }, []);

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  async function loadAdminData() {
    setLoading(true);
    setError('');

    try {
      const [summaryResponse, usersResponse, ordersResponse, restaurantsResponse] = await Promise.all([
        adminRequest('get', '/summary'),
        adminRequest('get', '/users'),
        adminRequest('get', '/orders'),
        adminRequest('get', '/restaurants')
      ]);

      const usersData = asArray(usersResponse.data);
      const ordersData = asArray(ordersResponse.data);
      const restaurantsData = asArray(restaurantsResponse.data);

      setSummary(summaryResponse.data);
      setUsers(usersData);
      setOrders(ordersData);
      setRestaurants(restaurantsData);

      if (!selectedRestaurantId && restaurantsData.length > 0) {
        setSelectedRestaurantId(String(restaurantsData[0].id));
        setMenuForm((current) => ({
          ...current,
          restaurantId: String(restaurantsData[0].id)
        }));
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to load admin dashboard'));
    } finally {
      setLoading(false);
    }
  }

  function resetRestaurantForm() {
    setRestaurantForm(EMPTY_RESTAURANT_FORM);
    setEditingRestaurantId(null);
  }

  function resetMenuForm(restaurantId = selectedRestaurantId) {
    setMenuForm({
      ...EMPTY_MENU_FORM,
      restaurantId: restaurantId ? String(restaurantId) : ''
    });
    setEditingMenuItemId(null);
  }

  async function refreshRestaurantsAndSummary(nextRestaurantId = selectedRestaurantId) {
    const [summaryResponse, restaurantsResponse] = await Promise.all([
      adminRequest('get', '/summary'),
      adminRequest('get', '/restaurants')
    ]);

    const restaurantsData = asArray(restaurantsResponse.data);

    setSummary(summaryResponse.data);
    setRestaurants(restaurantsData);

    const hasSelectedRestaurant = restaurantsData.some(
      (restaurant) => String(restaurant.id) === String(nextRestaurantId)
    );
    const fallbackRestaurantId = restaurantsData[0]?.id;
    const effectiveRestaurantId = hasSelectedRestaurant ? nextRestaurantId : fallbackRestaurantId || '';

    setSelectedRestaurantId(effectiveRestaurantId ? String(effectiveRestaurantId) : '');
    resetMenuForm(effectiveRestaurantId ? String(effectiveRestaurantId) : '');
  }

  async function handleRestaurantSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      if (editingRestaurantId) {
        await adminRequest('put', `/restaurants/${editingRestaurantId}`, restaurantForm);
        setSuccessMessage('Restaurant updated successfully');
      } else {
        const response = await adminRequest('post', '/restaurants', restaurantForm);
        setSuccessMessage('Restaurant added successfully');
        setSelectedRestaurantId(String(response.data.id));
      }

      await refreshRestaurantsAndSummary(editingRestaurantId || selectedRestaurantId);
      resetRestaurantForm();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to save restaurant'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRestaurant(restaurantId) {
    if (!window.confirm('Delete this restaurant and all of its menu items?')) {
      return;
    }

    try {
      await adminRequest('delete', `/restaurants/${restaurantId}`);
      setSuccessMessage('Restaurant deleted');
      await refreshRestaurantsAndSummary(selectedRestaurantId === String(restaurantId) ? '' : selectedRestaurantId);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to delete restaurant'));
    }
  }

  async function handleMenuSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      if (editingMenuItemId) {
        await adminRequest('put', `/menu-items/${editingMenuItemId}`, menuForm);
        setSuccessMessage('Menu item updated successfully');
      } else {
        await adminRequest('post', `/restaurants/${menuForm.restaurantId}/menu-items`, menuForm);
        setSuccessMessage('Menu item added successfully');
      }

      await refreshRestaurantsAndSummary(menuForm.restaurantId);
      resetMenuForm(menuForm.restaurantId);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to save menu item'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMenuItem(menuItemId) {
    if (!window.confirm('Delete this menu item?')) {
      return;
    }

    try {
      await adminRequest('delete', `/menu-items/${menuItemId}`);
      setSuccessMessage('Menu item deleted');
      await refreshRestaurantsAndSummary(selectedRestaurantId);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to delete menu item'));
    }
  }

  async function handleOrderStatusChange(orderId, status) {
    try {
      await adminRequest('patch', `/orders/${orderId}`, { status });
      const ordersResponse = await adminRequest('get', '/orders');
      setOrders(ordersResponse.data);
      setSuccessMessage('Order status updated');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to update order status'));
    }
  }

  function startRestaurantEdit(restaurant) {
    setActiveTab('restaurants');
    setEditingRestaurantId(restaurant.id);
    setRestaurantForm({
      name: restaurant.name || '',
      cuisine: restaurant.cuisine || '',
      rating: String(restaurant.rating || ''),
      location: restaurant.location || '',
      image: restaurant.image || '',
      deliveryTime: restaurant.deliveryTime || ''
    });
  }

  function startMenuEdit(menuItem) {
    setEditingMenuItemId(menuItem.id);
    setMenuForm({
      restaurantId: String(menuItem.RestaurantId),
      name: menuItem.name || '',
      price: String(menuItem.price || ''),
      description: menuItem.description || '',
      image: menuItem.image || '',
      category: menuItem.category || 'Other',
      isVeg: menuItem.isVeg !== false,
      isBestseller: menuItem.isBestseller === true
    });
  }

  function handleAdminLogout() {
    logout();
    navigate('/admin/login');
  }

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <div>
          <div className="admin-brand">FoodHub Admin</div>
          <div className="admin-user-chip">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <div className="admin-nav">
            {[
              ['overview', 'Overview'],
              ['users', 'Users'],
              ['orders', 'Orders'],
              ['restaurants', 'Restaurants']
            ].map(([key, label]) => (
              <button
                key={key}
                className={`admin-nav-button ${activeTab === key ? 'active' : ''}`}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button className="admin-logout-button" onClick={handleAdminLogout}>
          Logout
        </button>
      </aside>

      <section className="admin-content">
        <div className="admin-toolbar">
          <div>
            <h1>Private admin control panel</h1>
            <p>This area is isolated from the customer-facing app and only available to admin users.</p>
          </div>
          <button className="admin-refresh-button" onClick={loadAdminData}>
            Refresh data
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {successMessage && <div className="alert alert-success">{successMessage}</div>}

        {loading ? (
          <div className="admin-empty-card">Loading admin dashboard...</div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="admin-overview">
                <div className="admin-stat-grid">
                  <div className="admin-stat-card">
                    <span>Total users</span>
                    <strong>{summary.userCount}</strong>
                  </div>
                  <div className="admin-stat-card">
                    <span>Total orders</span>
                    <strong>{summary.orderCount}</strong>
                  </div>
                  <div className="admin-stat-card">
                    <span>Restaurants</span>
                    <strong>{summary.restaurantCount}</strong>
                  </div>
                  <div className="admin-stat-card">
                    <span>Revenue</span>
                    <strong>{formatCurrency(summary.revenue)}</strong>
                  </div>
                </div>

                <div className="admin-two-column">
                  <div className="admin-panel-card">
                    <h2>Recent users</h2>
                    <div className="admin-list">
                      {users.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="admin-list-row">
                          <div>
                            <strong>{entry.name || 'Unnamed user'}</strong>
                            <span>{entry.email}</span>
                          </div>
                          <div className="admin-list-meta">
                            <span>{entry.role}</span>
                            <span>{entry.orderCount} orders</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="admin-panel-card">
                    <h2>Recent orders</h2>
                    <div className="admin-list">
                      {orders.slice(0, 5).map((order) => (
                        <div key={order.id} className="admin-list-row">
                          <div>
                            <strong>Order #{order.id}</strong>
                            <span>{order.User?.name || 'Customer'} · {formatDate(order.createdAt)}</span>
                          </div>
                          <div className="admin-list-meta">
                            <span>{order.status}</span>
                            <span>{formatCurrency(order.total)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="admin-panel-card">
                <h2>User history</h2>
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Orders</th>
                        <th>Total spent</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.name || '-'}</td>
                          <td>{entry.email}</td>
                          <td>{entry.role}</td>
                          <td>{entry.orderCount}</td>
                          <td>{formatCurrency(entry.totalSpent)}</td>
                          <td>{formatDate(entry.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="admin-panel-card">
                <h2>All customer orders</h2>
                <div className="admin-order-grid">
                  {orders.map((order) => (
                    <article key={order.id} className="admin-order-card">
                      <div className="admin-order-header">
                        <div>
                          <strong>Order #{order.id}</strong>
                          <span>{order.User?.name || 'Customer'} · {order.User?.email || 'No email'}</span>
                        </div>
                        <div className="admin-order-status">
                          <select value={order.status} onChange={(event) => handleOrderStatusChange(order.id, event.target.value)}>
                            {ORDER_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <span>{formatCurrency(order.total)}</span>
                        </div>
                      </div>
                      <div className="admin-order-items">
                        {order.OrderItems?.map((item) => (
                          <div key={item.id} className="admin-order-item">
                            <span>{item.quantity} x {item.MenuItem?.name || 'Item'}</span>
                            <span>{item.MenuItem?.Restaurant?.name || 'Restaurant'}</span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'restaurants' && (
              <div className="admin-three-column">
                <div className="admin-panel-card">
                  <div className="admin-section-header">
                    <h2>Restaurants</h2>
                    <button className="admin-text-button" onClick={resetRestaurantForm}>
                      New
                    </button>
                  </div>
                  <div className="admin-list">
                    {restaurants.map((restaurant) => (
                      <div key={restaurant.id} className="admin-list-row clickable" onClick={() => setSelectedRestaurantId(String(restaurant.id))}>
                        <div>
                          <strong>{restaurant.name}</strong>
                          <span>{restaurant.cuisine || 'Cuisine not set'} · {restaurant.location || 'Location not set'}</span>
                        </div>
                        <div className="admin-row-actions">
                          <button onClick={(event) => { event.stopPropagation(); startRestaurantEdit(restaurant); }}>
                            Edit
                          </button>
                          <button className="danger" onClick={(event) => { event.stopPropagation(); handleDeleteRestaurant(restaurant.id); }}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="admin-panel-card">
                  <div className="admin-section-header">
                    <h2>{editingRestaurantId ? 'Edit restaurant' : 'Add restaurant'}</h2>
                    {editingRestaurantId && <button className="admin-text-button" onClick={resetRestaurantForm}>Cancel</button>}
                  </div>
                  <form className="admin-form" onSubmit={handleRestaurantSubmit}>
                    <input placeholder="Restaurant name" value={restaurantForm.name} onChange={(event) => setRestaurantForm({ ...restaurantForm, name: event.target.value })} />
                    <input placeholder="Cuisine" value={restaurantForm.cuisine} onChange={(event) => setRestaurantForm({ ...restaurantForm, cuisine: event.target.value })} />
                    <input placeholder="Rating" value={restaurantForm.rating} onChange={(event) => setRestaurantForm({ ...restaurantForm, rating: event.target.value })} />
                    <input placeholder="Location" value={restaurantForm.location} onChange={(event) => setRestaurantForm({ ...restaurantForm, location: event.target.value })} />
                    <input placeholder="Image URL" value={restaurantForm.image} onChange={(event) => setRestaurantForm({ ...restaurantForm, image: event.target.value })} />
                    <input placeholder="Delivery time" value={restaurantForm.deliveryTime} onChange={(event) => setRestaurantForm({ ...restaurantForm, deliveryTime: event.target.value })} />
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? 'Saving...' : editingRestaurantId ? 'Update restaurant' : 'Add restaurant'}
                    </button>
                  </form>
                </div>

                <div className="admin-panel-card">
                  <div className="admin-section-header">
                    <h2>Menu manager</h2>
                    {editingMenuItemId && <button className="admin-text-button" onClick={() => resetMenuForm(menuForm.restaurantId)}>Cancel</button>}
                  </div>

                  <form className="admin-form" onSubmit={handleMenuSubmit}>
                    <select value={menuForm.restaurantId} onChange={(event) => { setMenuForm({ ...menuForm, restaurantId: event.target.value }); setSelectedRestaurantId(event.target.value); }}>
                      <option value="">Select restaurant</option>
                      {restaurants.map((restaurant) => (
                        <option key={restaurant.id} value={restaurant.id}>
                          {restaurant.name}
                        </option>
                      ))}
                    </select>
                    <input placeholder="Menu item name" value={menuForm.name} onChange={(event) => setMenuForm({ ...menuForm, name: event.target.value })} />
                    <input placeholder="Price" value={menuForm.price} onChange={(event) => setMenuForm({ ...menuForm, price: event.target.value })} />
                    <input placeholder="Category" value={menuForm.category} onChange={(event) => setMenuForm({ ...menuForm, category: event.target.value })} />
                    <input placeholder="Image URL" value={menuForm.image} onChange={(event) => setMenuForm({ ...menuForm, image: event.target.value })} />
                    <textarea placeholder="Description" value={menuForm.description} onChange={(event) => setMenuForm({ ...menuForm, description: event.target.value })} rows="3" />
                    <label className="admin-checkbox">
                      <input type="checkbox" checked={menuForm.isVeg} onChange={(event) => setMenuForm({ ...menuForm, isVeg: event.target.checked })} />
                      Vegetarian
                    </label>
                    <label className="admin-checkbox">
                      <input type="checkbox" checked={menuForm.isBestseller} onChange={(event) => setMenuForm({ ...menuForm, isBestseller: event.target.checked })} />
                      Bestseller
                    </label>
                    <button type="submit" className="btn btn-primary" disabled={saving || !menuForm.restaurantId}>
                      {saving ? 'Saving...' : editingMenuItemId ? 'Update item' : 'Add item'}
                    </button>
                  </form>

                  <div className="admin-menu-list">
                    <h3>{selectedRestaurant ? `${selectedRestaurant.name} menu` : 'Select a restaurant'}</h3>
                    {selectedRestaurant?.MenuItems?.map((item) => (
                      <div key={item.id} className="admin-list-row">
                        <div>
                          <strong>{item.name}</strong>
                          <span>{formatCurrency(item.price)} · {item.category || 'Other'}</span>
                        </div>
                        <div className="admin-row-actions">
                          <button onClick={() => startMenuEdit(item)}>Edit</button>
                          <button className="danger" onClick={() => handleDeleteMenuItem(item.id)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
