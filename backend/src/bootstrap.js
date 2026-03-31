const bcrypt = require('bcrypt');
const { sequelize, Restaurant, MenuItem, User } = require('./models');
const restaurantData = require('./data/restaurants.json');

let initializationPromise;

function shouldSeedSampleData() {
  return process.env.SEED_SAMPLE_DATA !== 'false';
}

async function seedRestaurantsIfEmpty() {
  if (!shouldSeedSampleData()) {
    return;
  }

  const restaurantCount = await Restaurant.count();

  if (restaurantCount > 0) {
    return;
  }

  console.log('Seeding restaurant catalog...');

  for (const restaurantInfo of restaurantData.restaurants) {
    const restaurant = await Restaurant.create({
      name: restaurantInfo.name,
      cuisine: restaurantInfo.cuisine,
      rating: restaurantInfo.rating,
      location: restaurantInfo.location,
      image: restaurantInfo.image,
      deliveryTime: restaurantInfo.deliveryTime
    });

    const menuItems = restaurantInfo.menu.map((item) => ({
      name: item.name,
      price: item.price,
      description: item.description,
      image: item.image,
      category: item.category,
      isVeg: item.isVeg !== undefined ? item.isVeg : true,
      isBestseller: item.isBestseller || false,
      RestaurantId: restaurant.id
    }));

    await MenuItem.bulkCreate(menuItems);
  }

  console.log(`Seeded ${restaurantData.restaurants.length} restaurants with menus.`);
}

function getAdminSeedConfig() {
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    return {
      name: process.env.ADMIN_NAME || 'FoodHub Admin',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    };
  }

  if (process.env.NODE_ENV !== 'production') {
    return {
      name: 'FoodHub Admin',
      email: 'admin@foodhub.local',
      password: 'Admin@12345'
    };
  }

  return null;
}

async function ensureAdminUser() {
  const adminSeedConfig = getAdminSeedConfig();

  if (!adminSeedConfig) {
    return;
  }

  const passwordHash = await bcrypt.hash(adminSeedConfig.password, 10);
  const existingUser = await User.findOne({ where: { email: adminSeedConfig.email } });

  if (!existingUser) {
    await User.create({
      name: adminSeedConfig.name,
      email: adminSeedConfig.email,
      passwordHash,
      role: 'admin'
    });
    console.log(`Created admin user: ${adminSeedConfig.email}`);
    return;
  }

  if (existingUser.role !== 'admin') {
    await existingUser.update({ role: 'admin', passwordHash, name: adminSeedConfig.name });
    console.log(`Promoted existing user to admin: ${adminSeedConfig.email}`);
  }
}

async function initializeDatabase() {
  const syncOptions = {
    alter: process.env.DB_SYNC_ALTER === 'true',
    force: process.env.DB_SYNC_FORCE === 'true'
  };

  await sequelize.authenticate();
  await sequelize.sync(syncOptions);
  await ensureAdminUser();
  await seedRestaurantsIfEmpty();
}

function ensureDatabaseReady() {
  if (!initializationPromise) {
    initializationPromise = initializeDatabase().catch((error) => {
      initializationPromise = undefined;
      throw error;
    });
  }

  return initializationPromise;
}

module.exports = {
  ensureDatabaseReady
};
