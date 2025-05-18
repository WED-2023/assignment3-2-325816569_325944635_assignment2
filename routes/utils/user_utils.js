const { Time } = require("mssql");
const DButils = require("./DButils");
const recipe_utils = require("./recipes_utils");

/**
 * Middleware to authenticate user by session
 */
async function authenticateUser(req, res, next) {
  if (req.session && req.session.user_id) {
    try {
      const users = await DButils.execQuery("SELECT user_id FROM users");
      if (users.find((x) => x.user_id === req.session.user_id)) {
        req.user_id = req.session.user_id;
        return next();
      }
    } catch (err) {
      return next(err);
    }
  }
  res.sendStatus(401);
}

/**
 * Mark a recipe as favorite for a user
 */
async function markAsFavorite(user_id, recipe_id, is_DB = true) {
  if (typeof is_DB !== "boolean") {
    throw { status: 400, message: "Invalid value. It must be boolean true for DB or false for 'spoonacular'." };
  }
  await DButils.execQuery(`
    INSERT IGNORE INTO favorite_recipes (user_id, recipe_id, is_DB) 
    VALUES ('${user_id}', ${recipe_id}, ${is_DB})
  `);
}

/**
 * Get favorite recipes for a user
 */
async function getFavoriteRecipes(user_id) {
  const recipes = await DButils.execQuery(`
    SELECT recipe_id, is_DB 
    FROM favorite_recipes  
    WHERE user_id = '${user_id}'
  `);
  return recipes.map(r => ({
    ...r,
    is_DB: !!r.is_DB
  }));
}

/**
 * Get favorite recipes preview for a user
 */
async function getFavoriteRecipesPreview(user_id) {
  const favoriteRecipes = await getFavoriteRecipes(user_id);

  const dbRecipeIds = favoriteRecipes
    .filter(r => r.is_DB === true)
    .map(r => r.recipe_id);

  const spoonacularRecipeIds = favoriteRecipes
    .filter(r => r.is_DB === false)
    .map(r => r.recipe_id);

  const dbRecipes = dbRecipeIds.length > 0
    ? await Promise.all(dbRecipeIds.map(id => recipe_utils.getRecipePreview(id)))
    : [];

  const spoonacularRecipes = spoonacularRecipeIds.length > 0 
    ? await Promise.all(spoonacularRecipeIds.map(id => recipe_utils.getAPIRecipePreview(id)))
    : [];

  return [...dbRecipes, ...spoonacularRecipes];
}

/**
 * Get recipes created by the user (preview)
 */
async function getMyRecipesPreview(user_id) {
  const myRecipesResult = await DButils.execQuery(`SELECT recipe_id FROM recipes WHERE created_by = ${user_id}`);
  const recipeIds = myRecipesResult.map(r => r.recipe_id);
  return recipeIds.length > 0 ? await Promise.all(recipeIds.map(id => recipe_utils.getRecipePreview(id))) : [];
}

/**
 * Get last 3 viewed recipes (preview)
 */
async function getViewedRecipesPreview(user_id) {
  const viewedRecipesResult = await DButils.execQuery(`
    SELECT recipe_id, is_DB
    FROM viewed_recipes
    WHERE user_id = ${user_id}
    ORDER BY view_date DESC
    LIMIT 3
  `);
  const dbRecipeIds = viewedRecipesResult
    .filter(recipe => recipe.is_DB)
    .map(recipe => recipe.recipe_id);

  const apiRecipeIds = viewedRecipesResult
    .filter(recipe => !recipe.is_DB)
    .map(recipe => recipe.recipe_id);

  const dbRecipes = dbRecipeIds.length > 0
    ? await Promise.all(dbRecipeIds.map(id => recipe_utils.getRecipePreview(id)))
    : [];

  const apiRecipes = apiRecipeIds.length > 0
    ? await Promise.all(apiRecipeIds.map(id => recipe_utils.getAPIRecipePreview(id)))
    : [];

  return [...dbRecipes, ...apiRecipes];
}

/**
 * Add a family relationship (both directions)
 */
async function addFamilyRelationship(user_id_1, username) {
  const users = await DButils.execQuery(`SELECT user_id FROM users WHERE username = '${username}'`);
  if (users.length === 0) {
    throw { status: 404, message: "User not found" };
  }
  const user_id_2 = users[0].user_id;

  if (user_id_1 === user_id_2) {
    throw { status: 400, message: "Cannot add yourself as family" };
  }

  await DButils.execQuery(`
    INSERT IGNORE INTO family_ties (user_id_1, user_id_2)
    VALUES (${user_id_1}, ${user_id_2})
  `);

  await DButils.execQuery(`
    INSERT IGNORE INTO family_ties (user_id_1, user_id_2)
    VALUES (${user_id_2}, ${user_id_1})
  `);
}

/**
 * Get all recipes created by the user's family members (preview)
 */
async function getFamilyRecipes(user_id) {
  const familyTies = await DButils.execQuery(`
    SELECT user_id_2 AS family_id FROM family_ties WHERE user_id_1 = ${user_id}
    UNION
    SELECT user_id_1 AS family_id FROM family_ties WHERE user_id_2 = ${user_id}
  `);
  const familyIds = [...new Set(familyTies.map(f => f.family_id).filter(id => id !== user_id))];

  if (familyIds.length === 0) {
    return [];
  }

  const recipesResult = await DButils.execQuery(`
    SELECT recipe_id
    FROM recipes
    WHERE created_by IN (${familyIds.join(",")})
  `);
  const recipeIds = recipesResult.map(r => r.recipe_id);

  if (recipeIds.length === 0) {
    return [];
  }
  return await Promise.all(recipeIds.map(id => recipe_utils.getRecipePreview(id)));
}

/**
 * Mark a recipe as viewed by the user
 */
async function markAsViewed(user_id, recipe_id, is_DB) {
  await DButils.execQuery(`
    INSERT IGNORE INTO viewed_recipes (user_id, recipe_id, is_DB, view_date)
    VALUES ('${user_id}', ${recipe_id}, ${is_DB}, NOW())
  `);
}

exports.authenticateUser = authenticateUser;
exports.markAsFavorite = markAsFavorite;
exports.getFavoriteRecipes = getFavoriteRecipes;
exports.getFavoriteRecipesPreview = getFavoriteRecipesPreview;
exports.getMyRecipesPreview = getMyRecipesPreview;
exports.getViewedRecipesPreview = getViewedRecipesPreview;
exports.addFamilyRelationship = addFamilyRelationship;
exports.getFamilyRecipes = getFamilyRecipes;
exports.markAsViewed = markAsViewed;
