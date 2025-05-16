var express = require("express");
var router = express.Router();
const DButils = require("./utils/DButils");
const user_utils = require("./utils/user_utils");
const recipe_utils = require("./utils/recipes_utils");

/**
 * Authenticate all incoming requests by middleware
 */
router.use(async function (req, res, next) {
  if (req.session && req.session.user_id) {
    DButils.execQuery("SELECT user_id FROM users").then((users) => {
      if (users.find((x) => x.user_id === req.session.user_id)) {
        req.user_id = req.session.user_id;
        next();
      }
    }).catch(err => next(err));
  } else {
    res.sendStatus(401);
  }
});


/**
 * This path gets body with recipeId and save this recipe in the favorites list of the logged-in user
 */
router.post('/favorites', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipe_id = req.body.recipeId;
    // Accept boolean for is_DB, default to true if not provided
    const is_DB = typeof req.body.is_DB === "boolean" ? req.body.is_DB : true;
    if (typeof is_DB !== "boolean") {
      return res.status(400).send("Invalid value. It must be boolean true for DB or false for 'spoonacular'.");
    }
    await user_utils.markAsFavorite(user_id, recipe_id, is_DB);
    res.status(200).send("The Recipe successfully saved as favorite");
  } catch (error) {
    next(error);
  }
});

/**
 * This path returns the favorites recipes that were saved by the logged-in user
 */
router.get('/favorites', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const favoriteRecipes = await user_utils.getFavoriteRecipes(user_id);

    const dbRecipeIds = favoriteRecipes
      .filter(r => r.is_DB === true)
      .map(r => r.recipe_id);

    const spoonacularRecipeIds = favoriteRecipes
      .filter(r => r.is_DB === false)
      .map(r => r.recipe_id);

    // Use getRecipePreview for each db recipe (single recipe per call)
    const dbRecipes = dbRecipeIds.length > 0
      ? await Promise.all(dbRecipeIds.map(id => recipe_utils.getRecipePreview(id)))
      : [];

    const spoonacularRecipes = spoonacularRecipeIds.length > 0 
      ? await Promise.all(spoonacularRecipeIds.map(id => recipe_utils.getAPIRecipePreview(id)))
      : [];

    res.status(200).send([...dbRecipes, ...spoonacularRecipes]);
  } catch (error) {
    next(error);
  }
});

router.get('/my-recipes', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    // Get all recipe IDs created by the user
    const myRecipesResult = await DButils.execQuery(`SELECT recipe_id FROM recipes WHERE created_by = ${user_id}`);
    const recipeIds = myRecipesResult.map(r => r.recipe_id);
    // Use getRecipesPreview to fetch recipe details
    const myRecipes = recipeIds.length > 0 ? await recipe_utils.getRecipePreview(recipeIds) : [];
    res.status(200).send(myRecipes);
  } catch (error) {
    next(error);
  }
});

router.get('/viewed-recipes', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    // Get all recipe IDs and their source flag (is_DB) viewed by the user
    const viewedRecipesResult = await DButils.execQuery(`
      SELECT recipe_id, is_DB
      FROM viewed_recipes
      WHERE user_id = ${user_id}
      ORDER BY view_date DESC
      LIMIT 3
    `);
    // Separate DB recipes and API recipes based on the is_DB flag
    const dbRecipeIds = viewedRecipesResult
      .filter(recipe => recipe.is_DB)
      .map(recipe => recipe.recipe_id);
      
    const apiRecipeIds = viewedRecipesResult
      .filter(recipe => !recipe.is_DB)
      .map(recipe => recipe.recipe_id);
      
    // Fetch details for DB recipes and API recipes respectively
    const dbRecipes = dbRecipeIds.length > 0
      ? await Promise.all(dbRecipeIds.map(id => recipe_utils.getRecipePreview(id)))
      : [];
      
    const apiRecipes = apiRecipeIds.length > 0
      ? await Promise.all(apiRecipeIds.map(id => recipe_utils.getAPIRecipePreview(id)))
      : [];
      
    res.status(200).send([...dbRecipes, ...apiRecipes]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
