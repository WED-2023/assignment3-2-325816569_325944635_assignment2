require("dotenv").config();
const MySql = require("./MySql");

exports.execQuery = async function (query) {
    let returnValue = []
    const connection = await MySql.connection();
    try {
    await connection.query("START TRANSACTION");
    returnValue = await connection.query(query);
  } catch (err) {
    await connection.query("ROLLBACK");
    console.log('ROLLBACK at querySignUp', err);
    throw err;
  } finally {
    await connection.release();
  }
  return returnValue
}

exports.initializeTables = async function () {
  try {
    await MySql.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        firstname VARCHAR(255),
        lastname VARCHAR(255),
        country VARCHAR(255),
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        profilePic VARCHAR(2083)
      );
    `);

    await MySql.query(`
      CREATE TABLE IF NOT EXISTS recipes (
        recipe_id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        image VARCHAR(2083),
        readyInMinutes INT,
        servings INT DEFAULT 1,
        vegan BOOLEAN DEFAULT FALSE,
        vegetarian BOOLEAN DEFAULT FALSE,
        glutenFree BOOLEAN DEFAULT FALSE,
        steps TEXT NOT NULL,
        created_by INT,
        FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    await MySql.query(`
      CREATE TABLE IF NOT EXISTS popularity (
        recipe_id INT NOT NULL,
        likes INT DEFAULT 0,
        is_DB BOOLEAN NOT NULL,
        PRIMARY KEY (recipe_id, is_DB)
      );
    `);

    await MySql.query(`
      CREATE TABLE IF NOT EXISTS ingredients (
        ingredient_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        amount VARCHAR(255) NOT NULL,
        UNIQUE KEY unique_ingredient (name, amount)
      );
    `);

    await MySql.query(`
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        recipe_id INT NOT NULL,
        ingredient_id INT NOT NULL,
        PRIMARY KEY (recipe_id, ingredient_id),
        FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE CASCADE,
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(ingredient_id) ON DELETE CASCADE
      );
    `);
    await MySql.query(`
      CREATE TABLE IF NOT EXISTS favorite_recipes (
        user_id INT NOT NULL,
        recipe_id INT NOT NULL,
        is_DB BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (user_id, recipe_id, is_DB),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    await MySql.query(`
      CREATE TABLE IF NOT EXISTS viewed_recipes (
        user_id INT NOT NULL,
        recipe_id INT NOT NULL,
        is_DB BOOLEAN NOT NULL DEFAULT TRUE,
        view_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, recipe_id, is_DB),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    await MySql.query(`
      CREATE TABLE IF NOT EXISTS family_recipes (
        recipe_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        family_member VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        image VARCHAR(2083),
        readyInMinutes INT,
        servings INT DEFAULT 1,
        vegan BOOLEAN DEFAULT FALSE,
        vegetarian BOOLEAN DEFAULT FALSE,
        glutenFree BOOLEAN DEFAULT FALSE,
        steps TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `);

    await MySql.query(`
      CREATE TABLE IF NOT EXISTS family_recipe_ingredients (
        recipe_id INT NOT NULL,
        ingredient_id INT NOT NULL,
        PRIMARY KEY (recipe_id, ingredient_id),
        FOREIGN KEY (recipe_id) REFERENCES family_recipes(recipe_id) ON DELETE CASCADE,
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(ingredient_id) ON DELETE CASCADE
      );
    `);

    console.log("All required tables have been initialized successfully.");
  } catch (error) {
    console.error("Error initializing tables:", error);
    throw error;
  }
};

