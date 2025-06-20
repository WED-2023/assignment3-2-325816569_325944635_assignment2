const axios = require("axios");
const api_domain = "https://api.spoonacular.com/recipes";
const DButils = require("./DButils");
require("dotenv").config();



async function getRecipeLikes(recipe_id, is_DB) {
  const result = await DButils.execQuery(
    `SELECT likes FROM popularity WHERE recipe_id = ${recipe_id} AND is_DB = ${is_DB ? 1 : 0}`
  );
  return result.length > 0 ? result[0].likes : 0;
}

/**
 * Get recipes list from spooncular response and extract the relevant recipe data for preview
 * @param {*} recipes_info 
 */
async function getRecipeInformation(recipe_id) {
    return await axios.get(`${api_domain}/${recipe_id}/information`, {
        params: {
            includeNutrition: false,
            apiKey: process.env.spoonacular_apiKey
        }
    });
}

async function getRecipeDetails(recipe_id) {
    let recipe_info = await getRecipeInformation(recipe_id);
    let { id, title, readyInMinutes, image, aggregateLikes, vegan, vegetarian, glutenFree, extendedIngredients, instructions, servings } = recipe_info.data;

    // Get likes from DB for this spoonacular recipe
    const dbLikes = await getRecipeLikes(id, false);
    const popularity = aggregateLikes + dbLikes;

    // Extract ingredients: list of { name, amount }
    const ingredients = (extendedIngredients || []).map(ing => ({
        name: ing.name,
        amount: ing.amount
    }));

    return {
        id: id,
        title: title,
        readyInMinutes: readyInMinutes,
        servings: servings || 4, // Include servings with a default value if missing
        image: image,
        popularity: popularity,
        vegan: vegan,
        vegetarian: vegetarian,
        glutenFree: glutenFree,
        ingredients: ingredients,
        steps: instructions
    }
}

async function getRecipeDetailsFromDB(recipe_id) {
  const recipe_info = await DButils.execQuery(`SELECT * FROM recipes WHERE recipe_id = ${recipe_id}`);
  if (recipe_info.length === 0) {
    throw { status: 404, message: "Recipe not found" };
  }
  const ingredientsResult = await DButils.execQuery(`
    SELECT name, amount
    FROM ingredients
    WHERE ingredient_id IN (
      SELECT ingredient_id
      FROM recipe_ingredients
      WHERE recipe_id = ${recipe_id}
    )
  `);
  const { recipe_id: id, title, image, readyInMinutes, servings, vegan, vegetarian, glutenFree, steps } = recipe_info[0];
  const popularity = await getRecipeLikes(id, true);
  return {
    id: id,
    title: title,
    readyInMinutes: readyInMinutes,
    servings: servings, // Include servings with a default value if missing
    image: image,
    popularity: popularity,
    vegan: !!vegan,
    vegetarian: !!vegetarian,
    glutenFree: !!glutenFree,
    ingredients: ingredientsResult.map(ingredient => ({
      name: ingredient.name,
      amount: ingredient.amount
    })),
    steps: steps ? JSON.parse(steps) : []
  };
}

async function isRecipeViewed(user_id, recipe_id, is_DB) {
  if (!user_id) return false;
  
  const result = await DButils.execQuery(
    `SELECT 1 FROM viewed_recipes 
     WHERE user_id = ${user_id} 
     AND recipe_id = ${recipe_id} 
     AND is_DB = ${is_DB ? 1 : 0}`
  );
  return result.length > 0;
}

/**
 * Extract recipe preview data with viewed and favorite status
 */
async function extractRecipePreview(recipe, is_DB, user_id = null) {
  // Get popularity/likes
  const dbLikes = await getRecipeLikes(recipe.id, is_DB);
  const popularity = (recipe.aggregateLikes || 0) + dbLikes;
  
  // Check viewed and favorite status if user is logged in
  let viewed = false;
  let favorite = false;
  
  if (user_id) {
    viewed = await isRecipeViewed(user_id, recipe.id, is_DB);
    const user_utils = require('./user_utils');
    favorite = await user_utils.isRecipeFavorite(user_id, recipe.id, is_DB);
  }
  
  return {
    id: recipe.id,
    title: recipe.title,
    readyInMinutes: recipe.readyInMinutes,
    image: recipe.image,
    popularity: popularity,
    vegan: !!recipe.vegan,
    vegetarian: !!recipe.vegetarian,
    glutenFree: !!recipe.glutenFree,
    viewed: viewed,
    favorite: favorite,
    is_DB: is_DB
  };
}

async function getRecipePreview(recipe_id, user_id = null) {
  try {
    const query = `
      SELECT recipe_id AS id, title, readyInMinutes, image, vegan, vegetarian, glutenFree
      FROM recipes
      WHERE recipe_id = ?
    `;
    const recipesPreview = await DButils.execQuery(query.replace('?', recipe_id));
    if (recipesPreview.length === 0) {
      throw { status: 404, message: "Recipe not found" };
    }
    
    // Use the centralized function to extract preview with status checks
    return await extractRecipePreview(recipesPreview[0], true, user_id);
  } catch (error) {
    console.error("Error fetching recipe preview:", error);
    throw error;
  }
}

async function getAPIRecipePreview(recipe_id, user_id = null) {
  let recipe_info = await getRecipeInformation(recipe_id);
  
  // Use the centralized function to extract preview with status checks
  return await extractRecipePreview(recipe_info.data, false, user_id);
}

async function getRandomRecipes(user_id = null) {
  let response = await axios.get(`${api_domain}/random`, {
        params: {
            number: 3,
            apiKey: process.env.spoonacular_apiKey
        }
    });
  
  // Use the centralized function for each recipe
  const result = await Promise.all(
    response.data.recipes.map(recipe => extractRecipePreview(recipe, false, user_id))
  );
  
  return result;
}

async function searchRecipes(query, number = 5, cuisine, diet, intolerances, user_id = null) {
  const params = {
    query,
    number,
    addRecipeInformation: true,
    apiKey: process.env.spoonacular_apiKey
  };
  if (cuisine) {
    params.cuisine = cuisine;
  }
  if (diet) {
    params.diet = diet;
  }
  if (intolerances) {
    params.intolerances = intolerances;
  }
  const response = await axios.get(`${api_domain}/complexSearch`, { params });
  if (!response.data || !response.data.results) {
    throw new Error("Invalid response from Spoonacular API");
  }
  // For each recipe, get aggregateLikes + likes from DB and favorite status if user is logged in
  return await Promise.all(
    response.data.results.map(recipe => extractRecipePreview(recipe, false, user_id))
  );
}

async function createRecipe(user_id, body) {
  let { title, image, readyInMinutes, servings, aggregateLikes, vegan, vegetarian, glutenFree, ingredients, steps } = body;

  // Validate required fields
  if (!title || !ingredients || !steps) {
    throw { status: 400, message: "Invalid input data" };
  }

  // Ensure boolean values
  vegan = !!vegan;
  vegetarian = !!vegetarian;
  glutenFree = !!glutenFree;

  // Insert the recipe into the recipes table
  const recipeResult = await DButils.execQuery(`
    INSERT INTO recipes (title, image, readyInMinutes, servings, vegan, vegetarian, glutenFree, steps, created_by)
    VALUES ('${title}', '${image}', ${readyInMinutes || null}, ${servings || 4}, ${vegan}, ${vegetarian}, ${glutenFree}, '${JSON.stringify(steps)}', ${user_id});
  `);

  const recipe_id = recipeResult.insertId;

  // Insert likes into popularity table for new DB recipe (default 0)
  await DButils.execQuery(`
    INSERT INTO popularity (recipe_id, likes, is_DB)
    VALUES (${recipe_id}, ${aggregateLikes || 0}, 1)
    ON DUPLICATE KEY UPDATE likes = likes
  `);

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

  return recipe_id;
}

async function setRecipeLikes(recipe_id, is_DB, likes) {
  await DButils.execQuery(`
    INSERT INTO popularity (recipe_id, likes, is_DB)
    VALUES (${recipe_id}, ${likes}, ${is_DB ? 1 : 0})
    ON DUPLICATE KEY UPDATE likes = ${likes}
  `);
}

exports.getRecipePreview = getRecipePreview;
exports.getRecipeDetails = getRecipeDetails;
exports.getRecipeDetailsFromDB = getRecipeDetailsFromDB;
exports.getAPIRecipePreview = getAPIRecipePreview;
exports.getRandomRecipes = getRandomRecipes;
exports.searchRecipes = searchRecipes;
exports.createRecipe = createRecipe;
exports.setRecipeLikes = setRecipeLikes;

