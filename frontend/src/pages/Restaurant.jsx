import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { currentUser } from '../auth';

export default function Restaurant({ cart, setCart }) {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderStatus, setOrderStatus] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    let cancelled = false;

    async function loadRestaurant() {
      setLoading(true);

      try {
        const response = await api.get(`/api/restaurants/${id}`);
        if (!cancelled) {
          setRestaurant(response.data);
          setLoading(false);
        }
        return;
      } catch (error) {
        console.error('Primary restaurant fetch failed:', error.message);
      }

      try {
        const fallbackResponse = await api.get('/api/restaurants');
        const matchedRestaurant = fallbackResponse.data.find((item) => String(item.id) === String(id)) || null;

        if (!cancelled) {
          setRestaurant(matchedRestaurant);
          setLoading(false);
        }
      } catch (fallbackError) {
        console.error('Fallback restaurant fetch failed:', fallbackError.message);
        if (!cancelled) {
          setRestaurant(null);
          setLoading(false);
        }
      }
    }

    loadRestaurant();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const addToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(c => c.id !== itemId));
  };

  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(cart.map(c => c.id === itemId ? { ...c, quantity } : c));
    }
  };

  const placeOrder = async () => {
    if (!currentUser()) {
      setOrderStatus({ type: 'error', message: 'Please login to place an order' });
      return;
    }
    if (!cart.length) {
      setOrderStatus({ type: 'error', message: 'Your cart is empty' });
      return;
    }
    
    try {
      const items = cart.map(c => ({ menuItemId: c.id, quantity: c.quantity }));
      const response = await api.post('/api/orders', { items });
      setOrderStatus({ type: 'success', message: `Order placed successfully! Order ID: ${response.data.id}` });
      setCart([]);
    } catch (error) {
      setOrderStatus({ type: 'error', message: 'Failed to place order. Please try again.' });
    }
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  // Get unique categories
  const categories = restaurant?.MenuItems 
    ? ['All', ...new Set(restaurant.MenuItems.map(item => item.category || 'Other'))]
    : ['All'];
  
  // Filter items by category
  const filteredItems = restaurant?.MenuItems?.filter(
    item => activeCategory === 'All' || item.category === activeCategory
  ) || [];

  // Get item quantity in cart
  const getItemQuantity = (itemId) => {
    const item = cart.find(c => c.id === itemId);
    return item ? item.quantity : 0;
  };

  if (loading) {
    return (
      <div className="container">
        <div className="restaurant-detail">
          <div className="restaurant-info">
            <div className="skeleton" style={{ height: '2rem', width: '60%', marginBottom: '1rem' }}></div>
            <div className="skeleton" style={{ height: '1rem', width: '40%', marginBottom: '0.5rem' }}></div>
            <div className="skeleton" style={{ height: '1rem', width: '30%', marginBottom: '2rem' }}></div>
            <div className="menu-horizontal-list">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton" style={{ height: '150px', borderRadius: '16px' }}></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="container">
        <div className="empty-state">
          <span style={{ fontSize: '4rem' }}>🍽️</span>
          <p>Restaurant not found</p>
          <Link to="/" className="btn btn-primary">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Link to="/" className="back-link">
        <span className="back-arrow">←</span> Back to restaurants
      </Link>

      {/* Restaurant Hero Section */}
      <div className="restaurant-hero">
        <div className="restaurant-hero-image">
          <img 
            src={restaurant.image || `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600`} 
            alt={restaurant.name}
          />
          <div className="restaurant-hero-overlay"></div>
        </div>
        <div className="restaurant-hero-content">
          <h1 className="restaurant-hero-name">{restaurant.name}</h1>
          <p className="restaurant-hero-cuisine">{restaurant.cuisine}</p>
          <div className="restaurant-hero-meta">
            <span className="restaurant-hero-rating">
              <span className="star">★</span> {restaurant.rating}
            </span>
            <span className="restaurant-hero-divider">•</span>
            <span className="restaurant-hero-time">{restaurant.deliveryTime || '30-40'} mins</span>
            <span className="restaurant-hero-divider">•</span>
            <span className="restaurant-hero-location">📍 {restaurant.location}</span>
          </div>
          <div className="restaurant-offers">
            <span className="offer-tag">🏷️ 50% off up to ₹100</span>
            <span className="offer-tag">🚚 Free delivery on orders above ₹199</span>
          </div>
        </div>
      </div>

      <div className="restaurant-detail">
        <div className="restaurant-info">
          {/* Category Filter */}
          <div className="menu-category-filter">
            {categories.map(category => (
              <button
                key={category}
                className={`category-chip ${activeCategory === category ? 'active' : ''}`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <h3 className="menu-section-title">
            {activeCategory === 'All' ? 'Recommended' : activeCategory} ({filteredItems.length} items)
          </h3>

          {/* Horizontal Menu List */}
          <div className="menu-horizontal-list">
            {filteredItems.map((item, index) => {
              const quantity = getItemQuantity(item.id);
              return (
                <article 
                  key={item.id} 
                  className="menu-item-horizontal"
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  <div className="menu-item-image">
                    <img 
                      src={item.image || `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200`} 
                      alt={item.name}
                      loading="lazy"
                    />
                    {item.isVeg !== false && (
                      <span className="veg-badge">🟢</span>
                    )}
                    {item.isBestseller && (
                      <span className="bestseller-badge">★ Bestseller</span>
                    )}
                  </div>
                  <div className="menu-item-content">
                    <div className="menu-item-header">
                      <h4 className="menu-item-name">{item.name}</h4>
                      <span className="menu-item-price">₹{item.price}</span>
                    </div>
                    {item.description && (
                      <p className="menu-item-description">{item.description}</p>
                    )}
                    {item.category && (
                      <span className="menu-item-category">{item.category}</span>
                    )}
                    <div className="menu-item-actions">
                      {quantity > 0 ? (
                        <div className="quantity-control">
                          <button 
                            className="qty-btn minus"
                            onClick={() => updateQuantity(item.id, quantity - 1)}
                          >
                            −
                          </button>
                          <span className="qty-value">{quantity}</span>
                          <button 
                            className="qty-btn plus"
                            onClick={() => updateQuantity(item.id, quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button 
                          className="add-btn" 
                          onClick={() => addToCart(item)}
                        >
                          ADD
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="cart-container">
          <div className="cart-header">
            <h3>🛒 Cart {itemCount > 0 && <span className="cart-count">{itemCount}</span>}</h3>
            <span className="cart-restaurant">{restaurant.name}</span>
          </div>
          
          {orderStatus && (
            <div className={`alert ${orderStatus.type === 'success' ? 'alert-success' : 'alert-error'}`}>
              {orderStatus.message}
            </div>
          )}

          {cart.length > 0 ? (
            <>
              <div className="cart-items">
                {cart.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div className="cart-item-info">
                      <span className="cart-item-veg">🟢</span>
                      <div>
                        <div className="cart-item-name">{item.name}</div>
                        <div className="cart-item-price">₹{item.price * item.quantity}</div>
                      </div>
                    </div>
                    <div className="cart-item-controls">
                      <button 
                        className="qty-btn"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="qty-value">{item.quantity}</span>
                      <button 
                        className="qty-btn"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cart-bill-details">
                <h4>Bill Details</h4>
                <div className="bill-row">
                  <span>Item Total</span>
                  <span>₹{total}</span>
                </div>
                <div className="bill-row">
                  <span>Delivery Fee</span>
                  <span className="free-delivery">FREE</span>
                </div>
                <div className="bill-row">
                  <span>Platform fee</span>
                  <span>₹5</span>
                </div>
                <div className="bill-row">
                  <span>GST and Restaurant Charges</span>
                  <span>₹{Math.round(total * 0.05)}</span>
                </div>
                <hr className="bill-divider" />
                <div className="bill-row total">
                  <span>TO PAY</span>
                  <span>₹{total + 5 + Math.round(total * 0.05)}</span>
                </div>
              </div>

              <button 
                className="checkout-btn" 
                onClick={placeOrder}
              >
                <span>Place Order</span>
                <span>₹{total + 5 + Math.round(total * 0.05)}</span>
              </button>
            </>
          ) : (
            <div className="empty-cart">
              <img 
                src="https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto/2xempty_cart_yfxml0" 
                alt="Empty cart"
                style={{ width: '150px', opacity: 0.8 }}
              />
              <p className="empty-cart-title">Your cart is empty</p>
              <p className="empty-cart-subtitle">Add items from the menu to get started!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
