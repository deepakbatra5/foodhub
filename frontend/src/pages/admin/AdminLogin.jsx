import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../api';
import { currentUser, saveAuth } from '../../auth';

function getErrorMessage(error, fallbackMessage) {
  const candidate = error?.response?.data?.error ?? error?.message;
  return typeof candidate === 'string' && candidate.trim() ? candidate : fallbackMessage;
}

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirect, setRedirect] = useState(false);
  const user = currentUser();

  if (redirect || user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter admin email and password');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/admin-login', { email, password });
      saveAuth(response.data);
      setRedirect(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Admin login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-badge">Private Admin Access</div>
        <h1>FoodHub Admin Panel</h1>
        <p>Only administrators can enter this area and manage users, orders, restaurants, and menu items.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="admin-login-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@foodhub.local"
              autoComplete="username"
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter admin password"
              autoComplete="current-password"
            />
          </label>

          <button type="submit" className="btn btn-primary admin-login-button" disabled={loading}>
            {loading ? 'Signing in...' : 'Open Admin Panel'}
          </button>
        </form>
      </div>
    </div>
  );
}
