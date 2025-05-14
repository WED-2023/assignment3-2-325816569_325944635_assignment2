const axios = require("axios");
const api_domain = "https://api.spoonacular.com/recipes";
const DButils = require("./DButils");



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

async function getRecipesPreview() {
  try {
    const recipesPreview = await DButils.execQuery(`
      SELECT recipe_id AS id, title, imageUrl, likes, isVegan, isVegetarian, isGlutenFree 
      FROM recipes
    `);
    return recipesPreview;
  } catch (error) {
    console.error("Error fetching recipes preview:", error);
    throw error;
  }
}

exports.getRecipesPreview = getRecipesPreview;

exports.getRecipeDetails = getRecipeDetails;



