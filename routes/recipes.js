var express = require("express");
var router = express.Router();
const recipes_utils = require("./utils/recipes_utils");
const DButils = require("./utils/DButils"); // Re-import DButils

router.get("/", (req, res) => res.send("im here"));

/**
 * This path returns a full details of a recipe by its id
 */
router.get("/:recipeId", async (req, res, next) => {
  try {
    const recipe = await recipes_utils.getRecipeDetails(req.params.recipeId);
    res.send(recipe);
  } catch (error) {
    next(error);
  }
});

router.get("/DB/:recipeId", async (req, res, next) => {
  try {
    const recipe = await recipes_utils.getRecipeDetailsFromDB(req.params.recipeId);
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

    const { title, imageUrl, preparationTime, isVegan, isVegetarian, isGlutenFree, ingredients, steps } = req.body;

    // Validate required fields
    if (!title || !ingredients || !steps) {
      return res.status(400).send({ message: "Invalid input data" });
    }

    // Insert the recipe into the recipes table
    const recipeResult = await DButils.execQuery(`
      INSERT INTO recipes (title, imageUrl, preparationTime, isVegan, isVegetarian, isGlutenFree, steps, created_by)
      VALUES ('${title}', '${imageUrl}', ${preparationTime || null}, ${isVegan || false}, ${isVegetarian || false}, ${isGlutenFree || false}, '${JSON.stringify(steps)}', ${user_id});
    `);

    const recipe_id = recipeResult.insertId;

    // Insert ingredients into the ingredients and recipe_ingredients tables
    for (const ingredient of ingredients) {
      let ingredientResult = await DButils.execQuery(`
        INSERT IGNORE INTO ingredients (name) VALUES ('${ingredient}');
      `);

      const ingredient_id = ingredientResult.insertId || (
        await DButils.execQuery(`SELECT ingredient_id FROM ingredients WHERE name='${ingredient}'`)
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

module.exports = router;
