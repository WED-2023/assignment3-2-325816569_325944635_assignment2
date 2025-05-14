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
    const is_DB = req.body.is_DB !== undefined ? parseInt(req.body.is_DB, 10) : 1; // Convert to number
    if (is_DB !== 1 && is_DB !== 0) {
      return res.status(400).send("Invalid value. It must be 1 for DB or 0 for 'spoonacular'.");
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
      .filter(r => r.is_DB === 1)
      .map(r => r.recipe_id);

    const spoonacularRecipeIds = favoriteRecipes
      .filter(r => r.is_DB === 0)
      .map(r => r.recipe_id);

    const dbRecipes = dbRecipeIds.length > 0
      ? await recipe_utils.getRecipesPreview(dbRecipeIds)
      : [];

    const spoonacularRecipes = spoonacularRecipeIds.length > 0 
      ? await Promise.all(spoonacularRecipeIds.map(id => recipe_utils.getRecipeDetails(id)))
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
    const myRecipes = recipeIds.length > 0 ? await recipe_utils.getRecipesPreview(recipeIds) : [];
    res.status(200).send(myRecipes);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
