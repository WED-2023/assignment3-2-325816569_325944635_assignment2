var express = require("express");
var router = express.Router();
const user_utils = require("./utils/user_utils");
const recipe_utils = require("./utils/recipes_utils");

/**
 * Authenticate all incoming requests by middleware
 */
router.use(user_utils.authenticateUser);

/**
 * Save a recipe as favorite for the logged-in user
 */
router.post('/favorites', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const { recipeId, is_DB } = req.body;
    await user_utils.markAsFavorite(user_id, recipeId, is_DB);
    res.status(200).send("The Recipe successfully saved as favorite");
  } catch (error) {
    next(error);
  }
});

/**
 * Get favorite recipes for the logged-in user
 */
router.get('/favorites', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipes = await user_utils.getFavoriteRecipesPreview(user_id);
    res.status(200).send(recipes);
  } catch (error) {
    next(error);
  }
});

/**
 * Get recipes created by the logged-in user
 */
router.get('/my-recipes', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const myRecipes = await user_utils.getMyRecipesPreview(user_id);
    res.status(200).send(myRecipes);
  } catch (error) {
    next(error);
  }
});

/**
 * Get the last 3 viewed recipes for the logged-in user
 */
router.get('/viewed-recipes', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const viewedRecipes = await user_utils.getViewedRecipesPreview(user_id);
    res.status(200).send(viewedRecipes);
  } catch (error) {
    next(error);
  }
});

/**
 * Add a family relationship between the logged-in user and another user by username
 */
router.post('/family', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const { username } = req.body;
    await user_utils.addFamilyRelationship(user_id, username);
    res.status(201).send({ message: "Family relationship added successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all recipes created by the user's family members
 */
router.get('/family', async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const familyRecipes = await user_utils.getFamilyRecipes(user_id);
    res.status(200).send(familyRecipes);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
