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
            apiKey: process.env.spooncular_apiKey
        }
    });
}

async function getRecipeDetails(recipe_id) {
    let recipe_info = await getRecipeInformation(recipe_id);
    let { id, title, readyInMinutes, image, aggregateLikes, vegan, vegetarian, glutenFree } = recipe_info.data;

    return {
        id: id,
        title: title,
        readyInMinutes: readyInMinutes,
        image: image,
        popularity: aggregateLikes,
        vegan: vegan,
        vegetarian: vegetarian,
        glutenFree: glutenFree,
        
    }
}

async function getRecipeDetailsFromDB(recipe_id) {
  const recipe_info = await DButils.execQuery(`SELECT * FROM recipes WHERE recipe_id = ${recipe_id}`);
  if (recipe_info.length === 0) {
    throw { status: 404, message: "Recipe not found" };
  }
  const ingredientsResult = await DButils.execQuery(`
    SELECT name 
    FROM ingredients 
    WHERE ingredient_id IN (
      SELECT ingredient_id 
      FROM recipe_ingredients 
      WHERE recipe_id = ${recipe_id}
    )
  `);
  const { recipe_id: id, title, imageUrl, preparationTime, isVegan, isVegetarian, isGlutenFree } = recipe_info[0];
  return {
    id,
    title,
    readyInMinutes: preparationTime,
    image: imageUrl,
    vegan: isVegan,
    vegetarian: isVegetarian,
    glutenFree: isGlutenFree,
    ingredients: ingredientsResult.map(ingredient => ingredient.name)
  };
}

async function getRecipesPreview(recipeIds) {
  try {
    let query = `
      SELECT recipe_id AS id, title, imageUrl, likes, isVegan, isVegetarian, isGlutenFree 
      FROM recipes
    `;
    if (recipeIds && recipeIds.length) {
      if (recipeIds.length === 1) {
        query += ` WHERE recipe_id = ${recipeIds[0]}`;
      } else {
        const idsStr = recipeIds.join(',');
        query += ` WHERE recipe_id IN (${idsStr})`;
      }
    }
    const recipesPreview = await DButils.execQuery(query);
    return recipesPreview;
  } catch (error) {
    console.error("Error fetching recipes preview:", error);
    throw error;
  }
}


exports.getRecipesPreview = getRecipesPreview;

exports.getRecipeDetails = getRecipeDetails;

exports.getRecipeDetailsFromDB = getRecipeDetailsFromDB;

exports.getRandomRecipes = getRandomRecipes;


