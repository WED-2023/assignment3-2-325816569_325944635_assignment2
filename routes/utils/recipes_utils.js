const axios = require("axios");
const api_domain = "https://api.spoonacular.com/recipes";
const DButils = require("./DButils");
require("dotenv").config();



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
    let { id, title, readyInMinutes, image, aggregateLikes, vegan, vegetarian, glutenFree, extendedIngredients, instructions } = recipe_info.data;

    // Extract ingredients: list of { name, amount }
    const ingredients = (extendedIngredients || []).map(ing => ({
        name: ing.name,
        amount: ing.amount
    }));

    return {
        id: id,
        title: title,
        readyInMinutes: readyInMinutes,
        image: image,
        popularity: aggregateLikes,
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
  const { recipe_id: id, title, image, readyInMinutes, aggregateLikes, vegan, vegetarian, glutenFree, steps } = recipe_info[0];
  return {
    id: id,
    title: title,
    readyInMinutes: readyInMinutes,
    image: image,
    popularity: aggregateLikes,
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

function extractRecipePreview(recipe) {
  return {
    id: recipe.id,
    title: recipe.title,
    readyInMinutes: recipe.readyInMinutes,
    image: recipe.image,
    aggregateLikes: recipe.aggregateLikes,
    vegan: !!recipe.vegan,
    vegetarian: !!recipe.vegetarian,
    glutenFree: !!recipe.glutenFree
  };
}

async function getRecipePreview(recipe_id) {
  try {
    const query = `
      SELECT recipe_id AS id, title, readyInMinutes, image, aggregateLikes, vegan, vegetarian, glutenFree
      FROM recipes
      WHERE recipe_id = ?
    `;
    const recipesPreview = await DButils.execQuery(query.replace('?', recipe_id));
    if (recipesPreview.length === 0) {
      throw { status: 404, message: "Recipe not found" };
    }
    return extractRecipePreview(recipesPreview[0]);
  } catch (error) {
    console.error("Error fetching recipe preview:", error);
    throw error;
  }
}

async function getAPIRecipePreview(recipe_id) {
  let recipe_info = await getRecipeInformation(recipe_id);
  return extractRecipePreview(recipe_info.data);
}

async function getRandomRecipes() {
  let response = await axios.get(`${api_domain}/random`, {
        params: {
            number: 3,
            apiKey: process.env.spoonacular_apiKey
        }
    });
  const result = [];
  for (const recipe of response.data.recipes) {
    result.push(extractRecipePreview(recipe));
  }
  return result;
}

async function searchRecipes(query, number = 5, cuisine, diet, intolerances) {
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
  return response.data.results.map(recipe => extractRecipePreview(recipe));
}




exports.getRecipePreview = getRecipePreview;
exports.getRecipeDetails = getRecipeDetails;
exports.getRecipeDetailsFromDB = getRecipeDetailsFromDB;
exports.getAPIRecipePreview = getAPIRecipePreview;
exports.getRandomRecipes = getRandomRecipes;
exports.searchRecipes = searchRecipes;

