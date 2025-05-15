const DButils = require("./DButils");

async function markAsFavorite(user_id, recipe_id, is_DB = true) {
  await DButils.execQuery(`
    INSERT IGNORE INTO favorite_recipes (user_id, recipe_id, is_DB) 
    VALUES ('${user_id}', ${recipe_id}, ${is_DB})
  `);
}

async function getFavoriteRecipes(user_id) {
  const recipes = await DButils.execQuery(`
    SELECT recipe_id, is_DB 
    FROM favorite_recipes  
    WHERE user_id = '${user_id}'
  `);
  // Convert is_DB from 0/1 to boolean if needed (MySQL may return 0/1)
  return recipes.map(r => ({
    ...r,
    is_DB: !!r.is_DB
  }));
}


exports.markAsFavorite = markAsFavorite;
exports.getFavoriteRecipes = getFavoriteRecipes;
