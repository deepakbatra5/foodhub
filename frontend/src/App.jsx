import React, { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Restaurant from './pages/Restaurant';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminLogin from './pages/admin/AdminLogin';
import AdminPanel from './pages/admin/AdminPanel';
import Header from './components/Header';
import Chatbot from './components/Chatbot';

export default function App() {
  const [cart, setCart] = useState([]);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className={`app ${isAdminRoute ? 'admin-app' : ''}`}>
      {!isAdminRoute && <Header cartCount={cartCount} />}
      <main className={isAdminRoute ? 'admin-main-shell' : ''}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/r/:id" element={<Restaurant cart={cart} setCart={setCart} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </main>
      {!isAdminRoute && <Chatbot />}
    </div>
  );
}
