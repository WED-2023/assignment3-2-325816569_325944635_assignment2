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
 * Check if a recipe is in user's favorites
 */
async function isRecipeFavorite(user_id, recipe_id, is_DB) {
  if (!user_id) return false;
  
  const result = await DButils.execQuery(
    `SELECT 1 FROM favorite_recipes 
     WHERE user_id = ${user_id} 
     AND recipe_id = ${recipe_id} 
     AND is_DB = ${is_DB ? 1 : 0}`
  );
  return result.length > 0;
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
    ? await Promise.all(dbRecipeIds.map(id => recipe_utils.getRecipePreview(id, user_id)))
    : [];

  const spoonacularRecipes = spoonacularRecipeIds.length > 0 
    ? await Promise.all(spoonacularRecipeIds.map(id => recipe_utils.getAPIRecipePreview(id, user_id)))
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

  // Pass user_id to properly check both viewed and favorite status
  const dbRecipes = dbRecipeIds.length > 0
    ? await Promise.all(dbRecipeIds.map(id => recipe_utils.getRecipePreview(id, user_id)))
    : [];

  const apiRecipes = apiRecipeIds.length > 0
    ? await Promise.all(apiRecipeIds.map(id => recipe_utils.getAPIRecipePreview(id, user_id)))
    : [];

  return [...dbRecipes, ...apiRecipes];
}

/**
 * Add a family recipe for a user
 */
async function addFamilyRecipe(user_id, recipeData) {
  const { 
    family_member, 
    title, 
    image, 
    readyInMinutes, 
    servings,
    vegan, 
    vegetarian, 
    glutenFree, 
    ingredients, 
    steps 
  } = recipeData;

  // Validate required fields
  if (!family_member || !title || !ingredients || !steps) {
    throw { status: 400, message: "Missing required fields" };
  }

  // Convert boolean values
  const veganValue = vegan ? 1 : 0;
  const vegetarianValue = vegetarian ? 1 : 0;
  const glutenFreeValue = glutenFree ? 1 : 0;

  // Escape special characters to prevent SQL injection
  const escapedFamilyMember = family_member.replace(/'/g, "\\'");
  const escapedTitle = title.replace(/'/g, "\\'");
  const escapedImage = image ? image.replace(/'/g, "\\'") : '';
  const escapedSteps = JSON.stringify(steps).replace(/'/g, "\\'");

  // Insert family recipe using string interpolation
  const result = await DButils.execQuery(`
    INSERT INTO family_recipes (
      user_id, family_member, title, image, readyInMinutes, servings, 
      vegan, vegetarian, glutenFree, steps
    ) VALUES (
      ${user_id}, '${escapedFamilyMember}', '${escapedTitle}', '${escapedImage}', ${readyInMinutes || 0}, ${servings || 1},
      ${veganValue}, ${vegetarianValue}, ${glutenFreeValue}, '${escapedSteps}'
    )
  `);

  const recipe_id = result.insertId;

  // Insert ingredients for the family recipe
  for (const ingredient of ingredients) {
    const name = ingredient.name.replace(/'/g, "\\'");
    const amount = ingredient.amount.replace(/'/g, "\\'");

    // Insert ingredient if not exists
    let ingredientResult = await DButils.execQuery(`
      INSERT IGNORE INTO ingredients (name, amount) VALUES ('${name}', '${amount}');
    `);

    // Get the ingredient_id
    const ingredient_id = ingredientResult.insertId || (
      await DButils.execQuery(`SELECT ingredient_id FROM ingredients WHERE name='${name}' AND amount='${amount}'`)
    )[0].ingredient_id;

    // Link ingredient to family recipe
    await DButils.execQuery(`
      INSERT INTO family_recipe_ingredients (recipe_id, ingredient_id) 
      VALUES (${recipe_id}, ${ingredient_id});
    `);
  }

  return recipe_id;
}

/**
 * Get family recipes for a user
 */
async function getFamilyRecipes(user_id) {
  // Get all family recipes for this user
  const familyRecipesResult = await DButils.execQuery(`
    SELECT * FROM family_recipes WHERE user_id = ${user_id}
  `);

  // Get ingredients for each family recipe
  const recipes = await Promise.all(familyRecipesResult.map(async (recipe) => {
    const ingredientsResult = await DButils.execQuery(`
      SELECT i.name, i.amount
      FROM ingredients i
      JOIN family_recipe_ingredients fri ON i.ingredient_id = fri.ingredient_id
      WHERE fri.recipe_id = ${recipe.recipe_id}
    `);

    return {
      id: recipe.recipe_id,
      user_id: recipe.user_id,
      family_member: recipe.family_member,
      title: recipe.title,
      image: recipe.image,
      readyInMinutes: recipe.readyInMinutes,
      servings: recipe.servings,
      vegan: !!recipe.vegan,
      vegetarian: !!recipe.vegetarian,
      glutenFree: !!recipe.glutenFree,
      ingredients: ingredientsResult.map(ingredient => ({
        name: ingredient.name,
        amount: ingredient.amount
      })),
      steps: recipe.steps ? JSON.parse(recipe.steps) : []
    };
  }));

  return recipes;
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

// Add new family recipe related exports
exports.addFamilyRecipe = addFamilyRecipe;
exports.getFamilyRecipes = getFamilyRecipes;
exports.authenticateUser = authenticateUser;
exports.markAsFavorite = markAsFavorite;
exports.getFavoriteRecipes = getFavoriteRecipes;
exports.getFavoriteRecipesPreview = getFavoriteRecipesPreview;
exports.getMyRecipesPreview = getMyRecipesPreview;
exports.getViewedRecipesPreview = getViewedRecipesPreview;
exports.markAsViewed = markAsViewed;
exports.isRecipeFavorite = isRecipeFavorite;
exports.getViewedRecipesPreview = getViewedRecipesPreview;
exports.markAsViewed = markAsViewed;
exports.isRecipeFavorite = isRecipeFavorite;
