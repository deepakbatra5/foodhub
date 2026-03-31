const express = require('express');
const bcrypt = require('bcrypt');
const requireAdmin = require('../middleware/admin');
const { createAuthResponse } = require('./auth');
const { User, Restaurant, MenuItem, Order, OrderItem } = require('../models');

const router = express.Router();

function normalizeRestaurantPayload(body) {
  return {
    name: body.name?.trim(),
    cuisine: body.cuisine?.trim() || '',
    rating: body.rating === '' || body.rating === undefined ? 0 : Number(body.rating),
    location: body.location?.trim() || '',
    image: body.image?.trim() || '',
    deliveryTime: body.deliveryTime?.trim() || ''
  };
}

function normalizeMenuItemPayload(body, restaurantId) {
  return {
    name: body.name?.trim(),
    price: body.price === '' || body.price === undefined ? 0 : Number(body.price),
    description: body.description?.trim() || '',
    image: body.image?.trim() || '',
    category: body.category?.trim() || 'Other',
    isVeg: body.isVeg !== false,
    isBestseller: body.isBestseller === true,
    RestaurantId: restaurantId
  };
}

function getOrderInclude() {
  return [
    { model: User, attributes: ['id', 'name', 'email', 'role'] },
    {
      model: OrderItem,
      include: [
        {
          model: MenuItem,
          include: [Restaurant]
        }
      ]
    }
  ];
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || user.role !== 'admin' || !await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    return res.json(createAuthResponse(user));
  } catch (error) {
    return res.status(500).json({ error: 'Admin login failed' });
  }
}

router.post('/login', login);

router.use(requireAdmin);

router.get('/summary', async (req, res) => {
  try {
    const [userCount, orderCount, restaurantCount, menuItemCount, revenue] = await Promise.all([
      User.count(),
      Order.count(),
      Restaurant.count(),
      MenuItem.count(),
      Order.sum('total')
    ]);

    res.json({
      userCount,
      orderCount,
      restaurantCount,
      menuItemCount,
      revenue: revenue || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load admin summary' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'role', 'createdAt'],
      include: [{ model: Order, attributes: ['id', 'total', 'status', 'createdAt'] }],
      order: [['createdAt', 'DESC']]
    });

    res.json(users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      orderCount: user.Orders.length,
      totalSpent: user.Orders.reduce((sum, order) => sum + (order.total || 0), 0),
      latestOrderAt: user.Orders[0]?.createdAt || null
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to load users' });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: getOrderInclude(),
      order: [['createdAt', 'DESC']]
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

router.patch('/orders/:id', async (req, res) => {
  try {
    const allowedStatuses = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    const { status } = req.body;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status' });
    }

    const order = await Order.findByPk(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await order.update({ status });

    return res.json(await Order.findByPk(order.id, { include: getOrderInclude() }));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update order' });
  }
});

router.get('/restaurants', async (req, res) => {
  try {
    const restaurants = await Restaurant.findAll({
      include: [MenuItem],
      order: [['createdAt', 'DESC']]
    });

    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load restaurants' });
  }
});

router.post('/restaurants', async (req, res) => {
  try {
    const payload = normalizeRestaurantPayload(req.body);

    if (!payload.name) {
      return res.status(400).json({ error: 'Restaurant name is required' });
    }

    const restaurant = await Restaurant.create(payload);
    res.status(201).json(restaurant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create restaurant' });
  }
});

router.put('/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findByPk(req.params.id);

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const payload = normalizeRestaurantPayload(req.body);

    if (!payload.name) {
      return res.status(400).json({ error: 'Restaurant name is required' });
    }

    await restaurant.update(payload);
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update restaurant' });
  }
});

router.delete('/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findByPk(req.params.id);

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const menuItemIds = (await MenuItem.findAll({
      where: { RestaurantId: restaurant.id },
      attributes: ['id']
    })).map((menuItem) => menuItem.id);

    if (menuItemIds.length > 0) {
      const linkedOrderItems = await OrderItem.count({ where: { MenuItemId: menuItemIds } });

      if (linkedOrderItems > 0) {
        return res.status(400).json({ error: 'This restaurant has order history. Delete its menu usage first or keep it for records.' });
      }
    }

    await MenuItem.destroy({ where: { RestaurantId: restaurant.id } });
    await restaurant.destroy();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete restaurant' });
  }
});

router.post('/restaurants/:restaurantId/menu-items', async (req, res) => {
  try {
    const restaurant = await Restaurant.findByPk(req.params.restaurantId);

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const payload = normalizeMenuItemPayload(req.body, restaurant.id);

    if (!payload.name) {
      return res.status(400).json({ error: 'Menu item name is required' });
    }

    const menuItem = await MenuItem.create(payload);
    res.status(201).json(menuItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

router.put('/menu-items/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.id);

    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const payload = normalizeMenuItemPayload(req.body, menuItem.RestaurantId);

    if (!payload.name) {
      return res.status(400).json({ error: 'Menu item name is required' });
    }

    await menuItem.update(payload);
    res.json(menuItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

router.delete('/menu-items/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.id);

    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const linkedOrderItems = await OrderItem.count({ where: { MenuItemId: menuItem.id } });

    if (linkedOrderItems > 0) {
      return res.status(400).json({ error: 'This menu item is part of existing orders and cannot be deleted.' });
    }

    await menuItem.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

module.exports = { router, login };
