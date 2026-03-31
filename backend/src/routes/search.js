const express = require('express');
const { Op, QueryTypes } = require('sequelize');
const { Restaurant, MenuItem, sequelize } = require('../models');

const router = express.Router();

function getFastestDeliveryTime(deliveryTime) {
  const firstValue = String(deliveryTime || '')
    .split('-')[0]
    .trim();

  return Number.parseInt(firstValue, 10);
}

router.get('/', async (req, res) => {
  try {
    const { q, category, location, minRating, maxDeliveryTime } = req.query;
    const where = {};
    const menuWhere = {};

    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { cuisine: { [Op.iLike]: `%${q}%` } }
      ];
      menuWhere.name = { [Op.iLike]: `%${q}%` };
    }

    if (category) {
      menuWhere.category = category;
    }

    if (location) {
      where.location = { [Op.iLike]: `%${location}%` };
    }

    if (minRating) {
      where.rating = { [Op.gte]: Number.parseFloat(minRating) };
    }

    let restaurants = await Restaurant.findAll({
      where,
      include: [{ model: MenuItem, where: Object.keys(menuWhere).length ? menuWhere : undefined }],
      limit: 20
    });

    if (maxDeliveryTime) {
      const maxDeliveryMinutes = Number.parseInt(maxDeliveryTime, 10);
      restaurants = restaurants.filter((restaurant) => {
        const deliveryMinutes = getFastestDeliveryTime(restaurant.deliveryTime);
        return Number.isFinite(deliveryMinutes) && deliveryMinutes <= maxDeliveryMinutes;
      });
    }

    res.json({
      results: restaurants,
      count: restaurants.length,
      query: q || 'all',
      filters: { category, location, minRating, maxDeliveryTime }
    });
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/suggestions', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const searchTerm = `%${q}%`;

    const cuisines = await sequelize.query(
      'SELECT DISTINCT cuisine FROM "Restaurants" WHERE cuisine ILIKE :searchTerm LIMIT 5',
      {
        replacements: { searchTerm },
        type: QueryTypes.SELECT
      }
    );

    const items = await MenuItem.findAll({
      where: q ? { name: { [Op.iLike]: searchTerm } } : undefined,
      attributes: ['name', 'category'],
      group: ['name', 'category'],
      limit: 5,
      raw: true
    });

    res.json({
      suggestions: {
        cuisines: cuisines.map((cuisine) => cuisine.cuisine),
        dishes: items.map((item) => item.name),
        categories: [...new Set(items.map((item) => item.category))]
      }
    });
  } catch (error) {
    console.error('Suggestions failed:', error);
    res.status(500).json({ error: 'Suggestions failed' });
  }
});

module.exports = router;
