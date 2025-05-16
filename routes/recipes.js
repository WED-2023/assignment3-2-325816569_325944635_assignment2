var express = require("express");
var router = express.Router();
const recipes_utils = require("./utils/recipes_utils");
const DButils = require("./utils/DButils"); // Re-import DButils

router.get("/", (req, res) => res.send("im here"));

/**
 * This path returns a full details of a recipe by its id (only if recipeId is an integer)
 */
router.get("/:recipeId(\\d+)", async (req, res, next) => {
  try {
    const recipe = await recipes_utils.getRecipeDetails(req.params.recipeId);
    // Mark the recipe as viewed (API recipe -> is_DB = 0)
    if (req.session && req.session.user_id) {
      await require("./utils/user_utils").markAsViewed(req.session.user_id, req.params.recipeId, 0);
    }
    res.send(recipe);
  } catch (error) {
    next(error);
  }
});

router.get("/DB/:recipeId", async (req, res, next) => {
  try {
    const recipe = await recipes_utils.getRecipeDetailsFromDB(req.params.recipeId);
    // Mark the recipe as viewed (DB recipe -> is_DB = 1)
    if (req.session && req.session.user_id) {
      await require("./utils/user_utils").markAsViewed(req.session.user_id, req.params.recipeId, 1);
    }
    res.send(recipe);
  } catch (error) {
    next(error);
  }
});

/**
 * This path allows a user to create a new recipe
 */
router.post("/create", async (req, res, next) => {
  try {
    const user_id = req.session.user_id; // Ensure the user is logged in
    if (!user_id) {
      return res.status(401).send({ message: "Unauthorized – user must be logged in" });
    }

    let { title, image, readyInMinutes, aggregateLikes, vegan, vegetarian, glutenFree, ingredients, steps } = req.body;

    // Validate required fields
    if (!title || !ingredients || !steps) {
      return res.status(400).send({ message: "Invalid input data" });
    }

    // Ensure boolean values
    vegan = !!vegan;
    vegetarian = !!vegetarian;
    glutenFree = !!glutenFree;

    // Insert the recipe into the recipes table
    const recipeResult = await DButils.execQuery(`
      INSERT INTO recipes (title, image, readyInMinutes, aggregateLikes, vegan, vegetarian, glutenFree, steps, created_by)
      VALUES ('${title}', '${image}', ${readyInMinutes || null}, ${aggregateLikes || 0}, ${vegan}, ${vegetarian}, ${glutenFree}, '${JSON.stringify(steps)}', ${user_id});
    `);

    const recipe_id = recipeResult.insertId;

    // Insert ingredients into the ingredients and recipe_ingredients tables
    for (const ingredient of ingredients) {
      // ingredient should be an object: { name, amount }
      const name = ingredient.name;
      const amount = ingredient.amount;

      // Insert ingredient if not exists (by name and amount)
      let ingredientResult = await DButils.execQuery(`
        INSERT IGNORE INTO ingredients (name, amount) VALUES ('${name}', '${amount}');
      `);

      // Get the ingredient_id for this name and amount
      const ingredient_id = ingredientResult.insertId || (
        await DButils.execQuery(`SELECT ingredient_id FROM ingredients WHERE name='${name}' AND amount='${amount}'`)
      )[0].ingredient_id;

      await DButils.execQuery(`
        INSERT INTO recipe_ingredients (recipe_id, ingredient_id) VALUES (${recipe_id}, ${ingredient_id});
      `);
    }

    res.status(201).send({ message: "Recipe created successfully", recipe_id });
  } catch (error) {
    next(error);
  }
});

/**
 * This path returns 3 random recipes from Spoonacular
 */
router.get("/random", async (req, res, next) => {
  try {
    const recipes = await recipes_utils.getRandomRecipes();
    res.send(recipes);
  } catch (error) {
    next(error);
  }
});


router.get("/search", async (req, res, next) => {
  try {
    const { query, number, cuisine, diet, intolerances } = req.query;
    const recipes = await recipes_utils.searchRecipes(query, number, cuisine, diet, intolerances);
    if (!recipes || recipes.length === 0) {
      return res.status(404).send({ message: "No recipes found" });
    }
    res.send(recipes);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
