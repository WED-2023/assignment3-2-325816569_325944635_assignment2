var express = require("express");
var path = require("path");
var router = express.Router();
const recipes_utils = require("./utils/recipes_utils");

/**
 * Get 3 random recipes from Spoonacular
 */
router.get("/random", async (req, res, next) => {
  try {
    const recipes = await recipes_utils.getRandomRecipes();
    res.send(recipes);
  } catch (error) {
    next(error);
  }
});

/**
 * Search recipes from Spoonacular using GET with query parameters
 */
router.get("/search", async (req, res, next) => {
  try {
    const { query, number, cuisine, diet, intolerances } = req.query;
    console.log("Search request received with query params:", req.query);
    
    const recipes = await recipes_utils.searchRecipes(query, number, cuisine, diet, intolerances);
    if (!recipes || recipes.length === 0) {
      return res.status(404).send({ message: "No recipes found" });
    }
    res.send(recipes);
  } catch (error) {
    next(error);
  }
});

/**
 * Get full details of a recipe by its id (only if recipeId is an integer)
 */
router.get("/:recipeId(\\d+)", async (req, res, next) => {
  try {
    const recipe = await recipes_utils.getRecipeDetails(req.params.recipeId);
    if (req.session && req.session.user_id) {
      await require("./utils/user_utils").markAsViewed(req.session.user_id, req.params.recipeId, 0);
    }
    res.send(recipe);
  } catch (error) {
    next(error);
  }
});

/**
 * Get full details of a DB recipe by its id
 */
router.get("/DB/:recipeId", async (req, res, next) => {
  try {
    const recipe = await recipes_utils.getRecipeDetailsFromDB(req.params.recipeId);
    if (req.session && req.session.user_id) {
      await require("./utils/user_utils").markAsViewed(req.session.user_id, req.params.recipeId, 1);
    }
    res.send(recipe);
  } catch (error) {
    next(error);
  }
});

/**
 * Create a new recipe
 */
router.post("/create", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    if (!user_id) {
      return res.status(401).send({ message: "Unauthorized – user must be logged in" });
    }
    const recipe_id = await recipes_utils.createRecipe(user_id, req.body);
    res.status(201).send({ message: "Recipe created successfully", recipe_id });
  } catch (error) {
    next(error);
  }
});

/**
 * Set the number of likes for a recipe (DB or Spoonacular)
 */
router.post("/set-likes/:recipeId", async (req, res, next) => {
  try {
    const recipeId = req.params.recipeId;
    const { likes, is_DB } = req.body;
    if (typeof likes !== "number" || typeof is_DB !== "boolean") {
      return res.status(400).send({ message: "likes (number) and is_DB (boolean) are required" });
    }
    await recipes_utils.setRecipeLikes(recipeId, is_DB, likes);
    res.status(200).send({ message: "Likes updated successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
