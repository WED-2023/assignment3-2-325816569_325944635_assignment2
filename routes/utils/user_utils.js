const DButils = require("./DButils");

async function markAsFavorite(user_id, recipe_id, source = "db") {
  await DButils.execQuery(`
    INSERT INTO favorite_recipes (user_id, recipe_id, source) 
    VALUES ('${user_id}', ${recipe_id}, '${source}')
  `);
}

async function getFavoriteRecipes(user_id){
    const recipes_id = await DButils.execQuery(`select recipe_id from favorite_recipes  where user_id='${user_id}'`);
    return recipes_id;
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
