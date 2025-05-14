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
router.post('/favorites', async (req,res,next) => {
  try{
    const user_id = req.session.user_id;
    const recipe_id = req.body.recipeId;
    const source = req.body.source ? req.body.source.toLowerCase() : 'db'; // Default to 'db'
    if (source !== 'db' && source !== 'spoonacular') {
      return res.status(400).send("Invalid source value. It must be 'db' or 'spoonacular'.");
    }
    await user_utils.markAsFavorite(user_id,recipe_id,source);
    res.status(200).send("The Recipe successfully saved as favorite");
    } catch(error){
    next(error);
  }
})

/**
 * This path returns the favorites recipes that were saved by the logged-in user
 */
router.get('/favorites', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const favoriteRecipes = await user_utils.getFavoriteRecipes(user_id);

    const dbRecipeIds = favoriteRecipes
      .filter(r => r.source === 'db')
      .map(r => r.recipe_id);

    const spoonacularRecipeIds = favoriteRecipes
      .filter(r => r.source === 'spoonacular')
      .map(r => r.recipe_id);

    const dbRecipes = dbRecipeIds.length > 0
      ? await recipe_utils.getRecipesPreview(dbRecipeIds)
      : [];

    const spoonacularRecipes = [];
    for (const id of spoonacularRecipeIds) {
      const recipe = await recipe_utils.getRecipeDetails(id);
      spoonacularRecipes.push(recipe);
    }

    res.status(200).send([...dbRecipes, ...spoonacularRecipes]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
