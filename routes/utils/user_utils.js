const DButils = require("./DButils");

async function markAsFavorite(user_id, recipe_id, source = "db") {
  await DButils.execQuery(`
    INSERT IGNORE INTO favorite_recipes (user_id, recipe_id, source) 
    VALUES ('${user_id}', ${recipe_id}, '${source}')
  `);
}

async function getFavoriteRecipes(user_id) {
  const recipes = await DButils.execQuery(`
    SELECT recipe_id, source 
    FROM favorite_recipes  
    WHERE user_id = '${user_id}'
  `);
  return recipes;
}

exports.markAsFavorite = markAsFavorite;
exports.getFavoriteRecipes = getFavoriteRecipes;
