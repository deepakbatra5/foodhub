const { sequelize, Restaurant, MenuItem } = require('./models');
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

async function initializeDatabase() {
  const syncOptions = {
    alter: process.env.DB_SYNC_ALTER === 'true',
    force: process.env.DB_SYNC_FORCE === 'true'
  };

  await sequelize.authenticate();
  await sequelize.sync(syncOptions);
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
