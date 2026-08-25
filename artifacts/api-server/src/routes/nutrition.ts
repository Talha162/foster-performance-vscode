import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/requireAuth";
import { randomUUID } from "crypto";

const router = Router();

// ─── Seed recipes ────────────────────────────────────────────────────────────

export const SEED_RECIPES = [
  {
    id: "r1",
    title: "Greek Yogurt Berry Oat Bowl",
    description: "A creamy, protein-packed breakfast that keeps you full and satisfied. Great for weight loss and muscle support.",
    category: "Breakfast",
    goal_tags: JSON.stringify(["Lose Weight", "Build Muscle", "General Health"]),
    dietary_tags: JSON.stringify(["Vegetarian", "Gluten-Free Option"]),
    allergy_tags: JSON.stringify(["Dairy", "Gluten"]),
    prep_time_mins: 5,
    cook_time_mins: 0,
    servings: 1,
    difficulty: "Easy",
    calories: 420,
    protein: 28,
    carbs: 52,
    fat: 9,
    fiber: 7,
    sodium: 80,
    instructions: JSON.stringify([
      "Spoon Greek yogurt into a bowl.",
      "Sprinkle rolled oats over the yogurt.",
      "Add berries on top.",
      "Sprinkle chia seeds and a pinch of cinnamon.",
      "Drizzle honey if desired and serve immediately."
    ]),
    ingredients: JSON.stringify([
      { amount: "1 cup", name: "plain Greek yogurt", substitutes: ["dairy-free coconut yogurt"] },
      { amount: "1/2 cup", name: "mixed berries (fresh or frozen)", substitutes: ["sliced banana", "mango chunks"] },
      { amount: "1/3 cup", name: "rolled oats", substitutes: ["certified gluten-free oats", "quinoa flakes"] },
      { amount: "1 tbsp", name: "chia seeds", substitutes: ["flaxseeds", "hemp seeds"] },
      { amount: "1/4 tsp", name: "cinnamon", substitutes: [] },
      { amount: "1 tsp", name: "honey (optional)", substitutes: ["maple syrup"] }
    ]),
    cost_per_serving: 2.50,
    storage: "Store unassembled. Keep yogurt and toppings separate up to 3 days.",
    reheat: "No cooking required.",
    equipment: JSON.stringify(["Bowl", "Measuring cups"])
  },
  {
    id: "r2",
    title: "Chicken Quinoa Salad",
    description: "A balanced, high-protein lunch packed with vegetables and drizzled with a bright lemon-olive oil dressing.",
    category: "Lunch",
    goal_tags: JSON.stringify(["Lose Weight", "Build Muscle", "Mediterranean"]),
    dietary_tags: JSON.stringify(["Gluten-Free", "Dairy-Free"]),
    allergy_tags: JSON.stringify([]),
    prep_time_mins: 10,
    cook_time_mins: 15,
    servings: 2,
    difficulty: "Easy",
    calories: 480,
    protein: 42,
    carbs: 38,
    fat: 14,
    fiber: 6,
    sodium: 320,
    instructions: JSON.stringify([
      "Cook quinoa according to package directions and let cool.",
      "Season chicken breast with salt, pepper, and garlic powder. Grill or pan-cook 6–7 minutes per side until cooked through.",
      "Slice chicken and set aside.",
      "Combine quinoa, mixed greens, cucumber, tomato, and bell pepper in a large bowl.",
      "Whisk together olive oil, lemon juice, Dijon, salt, and pepper for the dressing.",
      "Top salad with sliced chicken, drizzle with dressing, and serve."
    ]),
    ingredients: JSON.stringify([
      { amount: "6 oz", name: "chicken breast", substitutes: ["canned tuna", "chickpeas (vegan)", "tofu"] },
      { amount: "1/2 cup", name: "dry quinoa", substitutes: ["brown rice", "farro"] },
      { amount: "2 cups", name: "mixed greens", substitutes: ["spinach", "arugula"] },
      { amount: "1/2", name: "cucumber, diced", substitutes: [] },
      { amount: "1", name: "tomato, diced", substitutes: ["cherry tomatoes"] },
      { amount: "1/2", name: "bell pepper, sliced", substitutes: [] },
      { amount: "2 tbsp", name: "olive oil", substitutes: ["avocado oil"] },
      { amount: "1", name: "lemon, juiced", substitutes: ["2 tbsp apple cider vinegar"] },
      { amount: "1 tsp", name: "Dijon mustard", substitutes: ["honey mustard"] }
    ]),
    cost_per_serving: 5.00,
    storage: "Store dressing separately. Salad keeps up to 2 days refrigerated.",
    reheat: "Serve cold or at room temperature.",
    equipment: JSON.stringify(["Grill pan or skillet", "Medium pot", "Large bowl"])
  },
  {
    id: "r3",
    title: "Sheet-Pan Salmon and Vegetables",
    description: "A simple one-pan dinner packed with omega-3s and colorful vegetables. Ready in 30 minutes.",
    category: "Dinner",
    goal_tags: JSON.stringify(["Lose Weight", "General Health", "Mediterranean", "Recovery"]),
    dietary_tags: JSON.stringify(["Gluten-Free", "Dairy-Free"]),
    allergy_tags: JSON.stringify(["Fish"]),
    prep_time_mins: 10,
    cook_time_mins: 25,
    servings: 2,
    difficulty: "Easy",
    calories: 520,
    protein: 38,
    carbs: 32,
    fat: 22,
    fiber: 6,
    sodium: 380,
    instructions: JSON.stringify([
      "Preheat oven to 400°F (200°C). Line a baking sheet with parchment.",
      "Toss broccoli, carrots, and potatoes with olive oil, salt, pepper, and garlic. Spread on baking sheet.",
      "Roast vegetables 15 minutes.",
      "Push vegetables to sides and place salmon on the center. Season with lemon juice, pepper, and garlic.",
      "Return to oven and roast another 12–15 minutes until salmon flakes easily.",
      "Garnish with fresh herbs and serve immediately."
    ]),
    ingredients: JSON.stringify([
      { amount: "2", name: "salmon fillets (5 oz each)", substitutes: ["tilapia", "chicken breast", "tofu steak"] },
      { amount: "2 cups", name: "broccoli florets", substitutes: ["asparagus", "green beans"] },
      { amount: "2 medium", name: "carrots, chopped", substitutes: ["parsnips", "sweet potato"] },
      { amount: "1 cup", name: "small potatoes, halved", substitutes: ["cauliflower florets"] },
      { amount: "2 tbsp", name: "olive oil", substitutes: ["avocado oil"] },
      { amount: "1", name: "lemon, sliced", substitutes: [] },
      { amount: "3 cloves", name: "garlic, minced", substitutes: ["1/2 tsp garlic powder"] },
      { amount: "to taste", name: "black pepper and salt", substitutes: [] }
    ]),
    cost_per_serving: 8.00,
    storage: "Refrigerate up to 2 days. Salmon is best eaten fresh.",
    reheat: "Reheat at 350°F for 8 minutes or in microwave at 60% power.",
    equipment: JSON.stringify(["Sheet pan", "Parchment paper", "Oven"])
  },
  {
    id: "r4",
    title: "Peanut Butter Banana Protein Oatmeal",
    description: "A calorie-dense, energy-boosting breakfast ideal for healthy weight gain and muscle building. Warm, filling, and satisfying.",
    category: "Breakfast",
    goal_tags: JSON.stringify(["Gain Weight", "Build Muscle", "Endurance"]),
    dietary_tags: JSON.stringify(["Vegetarian", "Dairy-Free Option"]),
    allergy_tags: JSON.stringify(["Peanuts", "Gluten"]),
    prep_time_mins: 5,
    cook_time_mins: 5,
    servings: 1,
    difficulty: "Easy",
    calories: 590,
    protein: 32,
    carbs: 72,
    fat: 18,
    fiber: 8,
    sodium: 160,
    instructions: JSON.stringify([
      "Cook oats with milk on stovetop or microwave according to package directions.",
      "Stir in protein powder until combined.",
      "Slice banana and arrange on top.",
      "Add peanut butter and a drizzle of honey.",
      "Sprinkle cinnamon and serve warm."
    ]),
    ingredients: JSON.stringify([
      { amount: "1 cup", name: "rolled oats", substitutes: ["gluten-free oats", "quinoa flakes"] },
      { amount: "1 cup", name: "milk", substitutes: ["oat milk", "soy milk", "almond milk"] },
      { amount: "1 scoop", name: "vanilla protein powder (optional)", substitutes: ["2 tbsp hemp seeds"] },
      { amount: "1 medium", name: "banana, sliced", substitutes: ["sliced apple with cinnamon"] },
      { amount: "2 tbsp", name: "peanut butter", substitutes: ["almond butter", "sunflower seed butter"] },
      { amount: "1 tsp", name: "honey", substitutes: ["maple syrup"] },
      { amount: "1/4 tsp", name: "cinnamon", substitutes: [] }
    ]),
    cost_per_serving: 2.80,
    storage: "Best eaten fresh. Store cooked oats up to 2 days refrigerated.",
    reheat: "Add a splash of milk and microwave 1 minute, stirring halfway.",
    equipment: JSON.stringify(["Small pot or microwave-safe bowl"])
  },
  {
    id: "r5",
    title: "Chicken Rice Power Bowl",
    description: "A complete muscle-building meal with lean protein, complex carbs, and healthy fats. Perfect post-workout fuel.",
    category: "Lunch",
    goal_tags: JSON.stringify(["Build Muscle", "Gain Weight", "Post-Workout"]),
    dietary_tags: JSON.stringify(["Gluten-Free", "Dairy-Free"]),
    allergy_tags: JSON.stringify([]),
    prep_time_mins: 10,
    cook_time_mins: 20,
    servings: 1,
    difficulty: "Easy",
    calories: 620,
    protein: 50,
    carbs: 62,
    fat: 14,
    fiber: 5,
    sodium: 420,
    instructions: JSON.stringify([
      "Cook rice according to package directions.",
      "Season chicken with cumin, garlic powder, salt, and pepper.",
      "Cook chicken in a skillet over medium-high heat 6–7 min per side until cooked through. Slice.",
      "Massage kale with a little olive oil and lemon juice.",
      "Build the bowl: rice → kale → sliced chicken → avocado → salsa.",
      "Drizzle with lime juice and serve."
    ]),
    ingredients: JSON.stringify([
      { amount: "6 oz", name: "chicken breast", substitutes: ["turkey breast", "tempeh", "tofu"] },
      { amount: "1/2 cup", name: "dry brown rice", substitutes: ["white rice", "quinoa", "cauliflower rice"] },
      { amount: "1 cup", name: "kale or spinach", substitutes: ["romaine lettuce", "mixed greens"] },
      { amount: "1/2", name: "avocado, sliced", substitutes: ["guacamole (2 tbsp)"] },
      { amount: "2 tbsp", name: "salsa", substitutes: ["pico de gallo", "hot sauce"] },
      { amount: "1 tsp", name: "olive oil", substitutes: [] },
      { amount: "1/2 tsp each", name: "cumin, garlic powder, chili powder", substitutes: [] }
    ]),
    cost_per_serving: 5.50,
    storage: "Keep components separate. Rice and chicken up to 4 days refrigerated.",
    reheat: "Microwave rice and chicken. Add cold avocado fresh.",
    equipment: JSON.stringify(["Skillet", "Medium pot", "Bowl"])
  },
  {
    id: "r6",
    title: "Lean Beef Pasta with Vegetables",
    description: "A hearty muscle-building dinner rich in protein and complex carbohydrates. Family-friendly and budget-friendly.",
    category: "Dinner",
    goal_tags: JSON.stringify(["Build Muscle", "Gain Weight", "Family Meals"]),
    dietary_tags: JSON.stringify(["Dairy-Free Option"]),
    allergy_tags: JSON.stringify(["Gluten"]),
    prep_time_mins: 10,
    cook_time_mins: 25,
    servings: 4,
    difficulty: "Medium",
    calories: 560,
    protein: 42,
    carbs: 58,
    fat: 14,
    fiber: 6,
    sodium: 480,
    instructions: JSON.stringify([
      "Cook pasta according to package directions. Reserve 1/2 cup pasta water before draining.",
      "Brown lean ground beef in a large skillet over medium-high heat. Drain excess fat.",
      "Add onion and garlic; cook 2 minutes. Add zucchini and bell pepper; cook 4 minutes.",
      "Stir in crushed tomatoes, Italian seasoning, salt, and pepper. Simmer 10 minutes.",
      "Add cooked pasta to sauce; toss to coat, adding pasta water to loosen if needed.",
      "Serve topped with fresh basil and Parmesan if desired."
    ]),
    ingredients: JSON.stringify([
      { amount: "12 oz", name: "whole-wheat pasta", substitutes: ["gluten-free pasta", "chickpea pasta", "zucchini noodles"] },
      { amount: "1 lb", name: "lean ground beef (93%)", substitutes: ["ground turkey", "ground chicken", "lentils (vegan)"] },
      { amount: "1 medium", name: "zucchini, diced", substitutes: ["eggplant", "mushrooms"] },
      { amount: "1", name: "bell pepper, diced", substitutes: [] },
      { amount: "1", name: "onion, diced", substitutes: [] },
      { amount: "3 cloves", name: "garlic, minced", substitutes: [] },
      { amount: "28 oz can", name: "crushed tomatoes", substitutes: ["tomato sauce"] },
      { amount: "1 tsp", name: "Italian seasoning", substitutes: [] },
      { amount: "2 tbsp", name: "Parmesan (optional)", substitutes: ["nutritional yeast (vegan)"] }
    ]),
    cost_per_serving: 4.50,
    storage: "Refrigerate up to 4 days. Freezes well up to 3 months.",
    reheat: "Microwave with a splash of water, or reheat in skillet over medium heat.",
    equipment: JSON.stringify(["Large pot", "Large skillet", "Colander"])
  },
  {
    id: "r7",
    title: "Berry Protein Smoothie",
    description: "A quick, nutrient-dense smoothie perfect post-workout or as a fast breakfast. Customize macros by adjusting ingredients.",
    category: "Smoothies",
    goal_tags: JSON.stringify(["Build Muscle", "Lose Weight", "Post-Workout", "Quick Meals"]),
    dietary_tags: JSON.stringify(["Vegetarian", "Gluten-Free", "Dairy-Free Option"]),
    allergy_tags: JSON.stringify([]),
    prep_time_mins: 5,
    cook_time_mins: 0,
    servings: 1,
    difficulty: "Easy",
    calories: 380,
    protein: 35,
    carbs: 44,
    fat: 7,
    fiber: 5,
    sodium: 120,
    instructions: JSON.stringify([
      "Add all ingredients to a blender.",
      "Blend on high for 60 seconds until smooth.",
      "Add more milk for thinner consistency.",
      "Pour into a large glass and enjoy immediately."
    ]),
    ingredients: JSON.stringify([
      { amount: "1 cup", name: "frozen mixed berries", substitutes: ["mango chunks", "frozen banana"] },
      { amount: "1 scoop", name: "vanilla or unflavored protein powder", substitutes: ["2 tbsp hemp seeds + 1 tbsp nut butter"] },
      { amount: "1 cup", name: "milk of choice", substitutes: ["water", "coconut water"] },
      { amount: "1/2", name: "banana", substitutes: ["1/4 avocado for creaminess"] },
      { amount: "1 handful", name: "spinach (optional)", substitutes: [] }
    ]),
    cost_per_serving: 2.20,
    storage: "Best consumed immediately. Store sealed in fridge up to 12 hours.",
    reheat: "Serve cold.",
    equipment: JSON.stringify(["Blender"])
  },
  {
    id: "r8",
    title: "Tofu Scramble Breakfast Bowl",
    description: "A hearty vegan breakfast that mimics scrambled eggs. High in plant protein with turmeric for color and anti-inflammatory benefits.",
    category: "Breakfast",
    goal_tags: JSON.stringify(["General Health", "Lose Weight", "Vegan"]),
    dietary_tags: JSON.stringify(["Vegan", "Gluten-Free", "Dairy-Free"]),
    allergy_tags: JSON.stringify(["Soy"]),
    prep_time_mins: 5,
    cook_time_mins: 10,
    servings: 2,
    difficulty: "Easy",
    calories: 320,
    protein: 22,
    carbs: 26,
    fat: 14,
    fiber: 6,
    sodium: 340,
    instructions: JSON.stringify([
      "Press tofu dry between paper towels for 5 minutes. Crumble into rough pieces.",
      "Heat olive oil in a non-stick skillet over medium heat.",
      "Add crumbled tofu; cook 3 minutes without stirring to develop some browning.",
      "Add turmeric, garlic powder, nutritional yeast, salt, and pepper. Stir to coat.",
      "Push tofu aside, add spinach and cherry tomatoes. Cook until spinach wilts, 2 minutes.",
      "Mix everything together. Serve with whole-grain or gluten-free toast."
    ]),
    ingredients: JSON.stringify([
      { amount: "14 oz", name: "firm tofu", substitutes: ["extra-firm tofu"] },
      { amount: "1 tsp", name: "turmeric", substitutes: [] },
      { amount: "1/2 tsp", name: "garlic powder", substitutes: [] },
      { amount: "2 tbsp", name: "nutritional yeast", substitutes: [] },
      { amount: "1 cup", name: "baby spinach", substitutes: ["kale", "arugula"] },
      { amount: "1/2 cup", name: "cherry tomatoes, halved", substitutes: ["diced bell pepper"] },
      { amount: "1 tbsp", name: "olive oil", substitutes: [] },
      { amount: "2 slices", name: "whole-grain toast", substitutes: ["gluten-free bread", "corn tortillas"] }
    ]),
    cost_per_serving: 2.80,
    storage: "Refrigerate up to 3 days.",
    reheat: "Reheat in skillet over medium heat or microwave 1–2 minutes.",
    equipment: JSON.stringify(["Non-stick skillet", "Spatula"])
  },
  {
    id: "r9",
    title: "Lentil Curry with Rice",
    description: "A warming, budget-friendly vegan dinner packed with plant protein, fiber, and aromatic spices. Meal-prep friendly.",
    category: "Dinner",
    goal_tags: JSON.stringify(["Lose Weight", "Vegan", "Budget Meals", "General Health"]),
    dietary_tags: JSON.stringify(["Vegan", "Gluten-Free", "Dairy-Free"]),
    allergy_tags: JSON.stringify([]),
    prep_time_mins: 10,
    cook_time_mins: 30,
    servings: 4,
    difficulty: "Easy",
    calories: 420,
    protein: 18,
    carbs: 70,
    fat: 7,
    fiber: 14,
    sodium: 380,
    instructions: JSON.stringify([
      "Heat oil in a large pot. Add onion and cook until softened, 5 minutes.",
      "Add garlic, ginger, curry powder, cumin, and tomato paste. Cook 2 minutes, stirring constantly.",
      "Add rinsed lentils, coconut milk, and vegetable broth. Bring to a boil.",
      "Reduce heat and simmer uncovered 20–25 minutes until lentils are tender.",
      "Stir in spinach until wilted. Season with salt, pepper, and lime juice.",
      "Serve over cooked rice with fresh cilantro."
    ]),
    ingredients: JSON.stringify([
      { amount: "1.5 cups", name: "red lentils, rinsed", substitutes: ["green lentils", "yellow split peas"] },
      { amount: "1 cup", name: "dry basmati rice", substitutes: ["brown rice", "quinoa", "cauliflower rice"] },
      { amount: "1 can (14oz)", name: "coconut milk", substitutes: ["low-fat coconut milk", "vegetable broth"] },
      { amount: "2 cups", name: "vegetable broth", substitutes: ["water"] },
      { amount: "1", name: "onion, diced", substitutes: [] },
      { amount: "3 cloves", name: "garlic, minced", substitutes: [] },
      { amount: "1 tbsp", name: "fresh ginger, grated", substitutes: ["1 tsp ground ginger"] },
      { amount: "2 tbsp", name: "curry powder", substitutes: [] },
      { amount: "2 cups", name: "baby spinach", substitutes: ["kale", "peas"] },
      { amount: "1", name: "lime, juiced", substitutes: ["lemon"] }
    ]),
    cost_per_serving: 2.20,
    storage: "Refrigerate up to 5 days. Freezes up to 3 months.",
    reheat: "Microwave with a splash of water, stirring halfway.",
    equipment: JSON.stringify(["Large pot", "Medium pot for rice"])
  },
  {
    id: "r10",
    title: "Mediterranean Chicken Bowl",
    description: "A vibrant, flavor-packed bowl with herb-marinated chicken, hummus, and fresh Mediterranean vegetables.",
    category: "Lunch",
    goal_tags: JSON.stringify(["Lose Weight", "Mediterranean", "General Health"]),
    dietary_tags: JSON.stringify(["Gluten-Free", "Dairy-Free"]),
    allergy_tags: JSON.stringify(["Sesame"]),
    prep_time_mins: 10,
    cook_time_mins: 15,
    servings: 2,
    difficulty: "Easy",
    calories: 490,
    protein: 40,
    carbs: 36,
    fat: 18,
    fiber: 7,
    sodium: 420,
    instructions: JSON.stringify([
      "Marinate chicken in olive oil, lemon juice, oregano, garlic, salt, and pepper for at least 15 minutes.",
      "Cook chicken in a skillet over medium-high heat 6–7 minutes per side until cooked through. Slice.",
      "Build bowls: cooked quinoa or rice → sliced chicken → cucumber → tomatoes → olives → red onion.",
      "Add a dollop of hummus and drizzle with tahini sauce or extra lemon.",
      "Garnish with fresh parsley."
    ]),
    ingredients: JSON.stringify([
      { amount: "2", name: "chicken breasts (5 oz each)", substitutes: ["chickpeas (vegan)", "falafel", "halloumi"] },
      { amount: "1/2 cup", name: "dry quinoa or couscous", substitutes: ["brown rice", "gluten-free grain"] },
      { amount: "1", name: "cucumber, sliced", substitutes: [] },
      { amount: "1 cup", name: "cherry tomatoes, halved", substitutes: [] },
      { amount: "1/4 cup", name: "Kalamata olives", substitutes: ["green olives"] },
      { amount: "1/4", name: "red onion, thinly sliced", substitutes: [] },
      { amount: "4 tbsp", name: "hummus", substitutes: [] },
      { amount: "2 tbsp", name: "olive oil", substitutes: [] },
      { amount: "1 tsp", name: "dried oregano", substitutes: [] },
      { amount: "1", name: "lemon, juiced", substitutes: [] }
    ]),
    cost_per_serving: 6.00,
    storage: "Refrigerate components separately up to 3 days.",
    reheat: "Warm chicken only. Assemble bowl fresh.",
    equipment: JSON.stringify(["Skillet", "Medium pot", "Bowl"])
  },
  {
    id: "r11",
    title: "Overnight Oats",
    description: "A no-cook, make-ahead breakfast. Customize toppings for any goal. Ideal for meal prep and busy mornings.",
    category: "Breakfast",
    goal_tags: JSON.stringify(["Lose Weight", "General Health", "Meal Prep", "Quick Meals"]),
    dietary_tags: JSON.stringify(["Vegetarian", "Gluten-Free Option", "Dairy-Free Option"]),
    allergy_tags: JSON.stringify(["Gluten", "Dairy"]),
    prep_time_mins: 5,
    cook_time_mins: 0,
    servings: 1,
    difficulty: "Easy",
    calories: 380,
    protein: 18,
    carbs: 52,
    fat: 10,
    fiber: 8,
    sodium: 95,
    instructions: JSON.stringify([
      "Combine oats, milk, yogurt, chia seeds, and sweetener in a jar or container with a lid.",
      "Stir well to combine.",
      "Cover and refrigerate overnight, or at least 4 hours.",
      "In the morning, stir and add a splash more milk if too thick.",
      "Top with your choice of fruit, nuts, or nut butter before serving."
    ]),
    ingredients: JSON.stringify([
      { amount: "1/2 cup", name: "rolled oats", substitutes: ["certified gluten-free oats", "quinoa flakes"] },
      { amount: "1/2 cup", name: "milk of choice", substitutes: ["coconut milk", "oat milk"] },
      { amount: "1/4 cup", name: "plain Greek yogurt", substitutes: ["dairy-free yogurt", "extra milk"] },
      { amount: "1 tbsp", name: "chia seeds", substitutes: ["flaxseeds"] },
      { amount: "1 tsp", name: "maple syrup or honey", substitutes: ["mashed ripe banana"] },
      { amount: "to taste", name: "fruit toppings (berries, banana, apple)", substitutes: [] },
      { amount: "1 tbsp", name: "nut butter or granola (optional)", substitutes: [] }
    ]),
    cost_per_serving: 1.80,
    storage: "Refrigerate up to 5 days without toppings.",
    reheat: "Enjoy cold or microwave 1 minute. Add toppings fresh.",
    equipment: JSON.stringify(["Jar or container with lid"])
  },
  {
    id: "r12",
    title: "Turkey Chili",
    description: "A hearty, high-protein chili that works for meal prep and feeds a family. Versatile and freezer-friendly.",
    category: "Dinner",
    goal_tags: JSON.stringify(["Lose Weight", "Build Muscle", "Budget Meals", "Meal Prep", "Family Meals"]),
    dietary_tags: JSON.stringify(["Gluten-Free", "Dairy-Free"]),
    allergy_tags: JSON.stringify([]),
    prep_time_mins: 10,
    cook_time_mins: 35,
    servings: 6,
    difficulty: "Easy",
    calories: 380,
    protein: 35,
    carbs: 38,
    fat: 8,
    fiber: 10,
    sodium: 520,
    instructions: JSON.stringify([
      "Heat oil in a large pot over medium heat. Add onion, bell peppers, and garlic. Cook 5 minutes.",
      "Add ground turkey; cook until browned, breaking it apart, about 8 minutes.",
      "Add chili powder, cumin, smoked paprika, and oregano. Stir 1 minute.",
      "Add canned tomatoes, beans, chicken broth, and tomato paste. Stir well.",
      "Bring to a boil, then simmer uncovered 20–25 minutes until thickened.",
      "Season with salt, pepper, and lime juice. Serve with toppings of choice."
    ]),
    ingredients: JSON.stringify([
      { amount: "1.5 lbs", name: "lean ground turkey", substitutes: ["ground chicken", "extra beans + mushrooms (vegan)"] },
      { amount: "2 cans (15oz)", name: "kidney or black beans, drained", substitutes: ["pinto beans", "chickpeas"] },
      { amount: "28 oz can", name: "diced tomatoes", substitutes: [] },
      { amount: "2 tbsp", name: "tomato paste", substitutes: [] },
      { amount: "1 cup", name: "chicken or vegetable broth", substitutes: [] },
      { amount: "1", name: "onion, diced", substitutes: [] },
      { amount: "2", name: "bell peppers, diced", substitutes: [] },
      { amount: "3 cloves", name: "garlic, minced", substitutes: [] },
      { amount: "2 tbsp", name: "chili powder", substitutes: [] },
      { amount: "1 tsp each", name: "cumin, smoked paprika, oregano", substitutes: [] }
    ]),
    cost_per_serving: 3.00,
    storage: "Refrigerate up to 5 days. Freezes up to 3 months.",
    reheat: "Microwave 2–3 minutes or reheat on stovetop over medium heat.",
    equipment: JSON.stringify(["Large pot", "Wooden spoon"])
  },
  {
    id: "r13",
    title: "Black Bean Burrito Bowl",
    description: "A filling, budget-friendly vegetarian bowl loaded with fiber, plant protein, and bold flavors.",
    category: "Lunch",
    goal_tags: JSON.stringify(["Lose Weight", "Budget Meals", "Vegetarian", "Vegan"]),
    dietary_tags: JSON.stringify(["Vegan", "Gluten-Free", "Dairy-Free"]),
    allergy_tags: JSON.stringify([]),
    prep_time_mins: 10,
    cook_time_mins: 15,
    servings: 2,
    difficulty: "Easy",
    calories: 520,
    protein: 20,
    carbs: 78,
    fat: 12,
    fiber: 16,
    sodium: 480,
    instructions: JSON.stringify([
      "Cook rice according to package instructions. Stir in lime juice and cilantro when done.",
      "Heat black beans in a small saucepan with cumin, garlic powder, and a pinch of salt.",
      "Build bowls: rice → beans → corn → pico de gallo/salsa → avocado → shredded lettuce.",
      "Top with a squeeze of lime and hot sauce if desired.",
      "Add optional Greek yogurt or dairy-free sour cream."
    ]),
    ingredients: JSON.stringify([
      { amount: "1 can (15oz)", name: "black beans, drained and rinsed", substitutes: ["pinto beans", "kidney beans"] },
      { amount: "3/4 cup", name: "dry rice", substitutes: ["quinoa", "cauliflower rice"] },
      { amount: "1/2 cup", name: "frozen corn, thawed", substitutes: ["canned corn"] },
      { amount: "1", name: "avocado, sliced", substitutes: ["guacamole"] },
      { amount: "1/2 cup", name: "pico de gallo or salsa", substitutes: [] },
      { amount: "1 cup", name: "romaine lettuce, shredded", substitutes: ["cabbage slaw"] },
      { amount: "1", name: "lime, juiced", substitutes: [] },
      { amount: "1/4 cup", name: "fresh cilantro", substitutes: [] },
      { amount: "1/2 tsp each", name: "cumin, garlic powder", substitutes: [] }
    ]),
    cost_per_serving: 2.50,
    storage: "Store components separately. Refrigerate up to 4 days.",
    reheat: "Reheat beans and rice; add cold toppings fresh.",
    equipment: JSON.stringify(["Small pot", "Medium pot", "Bowl"])
  },
  {
    id: "r14",
    title: "Egg and Vegetable Scramble with Toast",
    description: "A classic protein-packed breakfast with colorful vegetables. Quick, nutritious, and adaptable to any goal.",
    category: "Breakfast",
    goal_tags: JSON.stringify(["Lose Weight", "Build Muscle", "Low Carb", "General Health"]),
    dietary_tags: JSON.stringify(["Vegetarian", "Gluten-Free Option"]),
    allergy_tags: JSON.stringify(["Eggs", "Gluten"]),
    prep_time_mins: 5,
    cook_time_mins: 8,
    servings: 1,
    difficulty: "Easy",
    calories: 440,
    protein: 28,
    carbs: 32,
    fat: 20,
    fiber: 5,
    sodium: 390,
    instructions: JSON.stringify([
      "Toast bread to desired doneness.",
      "Whisk eggs with a pinch of salt and pepper.",
      "Heat olive oil in a non-stick skillet over medium heat.",
      "Add onion and bell pepper; sauté 2 minutes.",
      "Add spinach; cook until wilted, 1 minute.",
      "Pour in eggs and gently scramble until just set, 2–3 minutes.",
      "Serve immediately with toast."
    ]),
    ingredients: JSON.stringify([
      { amount: "3 large", name: "eggs", substitutes: ["2 whole eggs + 2 whites for lower fat"] },
      { amount: "2 slices", name: "whole-grain toast", substitutes: ["gluten-free bread", "sweet potato slices"] },
      { amount: "1/4", name: "onion, diced", substitutes: ["green onions"] },
      { amount: "1/2", name: "bell pepper, diced", substitutes: [] },
      { amount: "1 handful", name: "baby spinach", substitutes: ["kale", "arugula"] },
      { amount: "1 tsp", name: "olive oil", substitutes: [] },
      { amount: "to taste", name: "salt, pepper, and hot sauce", substitutes: [] }
    ]),
    cost_per_serving: 2.00,
    storage: "Best eaten immediately.",
    reheat: "Microwave 30 seconds if needed.",
    equipment: JSON.stringify(["Non-stick skillet", "Toaster"])
  },
  {
    id: "r15",
    title: "Salmon Quinoa Power Salad",
    description: "A nutrient-dense Mediterranean-inspired salad with omega-3-rich salmon and protein-packed quinoa.",
    category: "Lunch",
    goal_tags: JSON.stringify(["Mediterranean", "General Health", "Lose Weight", "Recovery"]),
    dietary_tags: JSON.stringify(["Gluten-Free", "Dairy-Free"]),
    allergy_tags: JSON.stringify(["Fish"]),
    prep_time_mins: 10,
    cook_time_mins: 15,
    servings: 2,
    difficulty: "Easy",
    calories: 510,
    protein: 38,
    carbs: 34,
    fat: 22,
    fiber: 5,
    sodium: 340,
    instructions: JSON.stringify([
      "Cook quinoa and let cool to room temperature.",
      "Season salmon with olive oil, lemon, garlic, salt, and pepper. Pan-cook or bake at 400°F for 12–15 min.",
      "Flake salmon into large pieces.",
      "Combine quinoa, arugula, cucumber, cherry tomatoes, and olives.",
      "Top with flaked salmon.",
      "Drizzle with lemon-olive oil dressing and garnish with fresh herbs."
    ]),
    ingredients: JSON.stringify([
      { amount: "10 oz", name: "salmon fillet", substitutes: ["canned salmon", "tuna", "chickpeas"] },
      { amount: "1/2 cup", name: "dry quinoa", substitutes: ["farro", "rice"] },
      { amount: "2 cups", name: "arugula or mixed greens", substitutes: [] },
      { amount: "1", name: "cucumber, diced", substitutes: [] },
      { amount: "1 cup", name: "cherry tomatoes", substitutes: [] },
      { amount: "2 tbsp", name: "Kalamata olives", substitutes: [] },
      { amount: "2 tbsp", name: "olive oil", substitutes: [] },
      { amount: "1", name: "lemon, juiced", substitutes: [] }
    ]),
    cost_per_serving: 8.50,
    storage: "Store dressing separately. Refrigerate up to 2 days.",
    reheat: "Serve cold or at room temperature.",
    equipment: JSON.stringify(["Skillet or oven", "Medium pot", "Large bowl"])
  },
  {
    id: "r16",
    title: "Protein Oatmeal with Banana",
    description: "A simple, protein-boosted oatmeal that fits weight loss and muscle building goals. Ready in under 10 minutes.",
    category: "Breakfast",
    goal_tags: JSON.stringify(["Lose Weight", "Build Muscle", "Endurance"]),
    dietary_tags: JSON.stringify(["Vegetarian", "Gluten-Free Option", "Dairy-Free Option"]),
    allergy_tags: JSON.stringify(["Gluten", "Dairy"]),
    prep_time_mins: 2,
    cook_time_mins: 5,
    servings: 1,
    difficulty: "Easy",
    calories: 450,
    protein: 30,
    carbs: 60,
    fat: 8,
    fiber: 7,
    sodium: 130,
    instructions: JSON.stringify([
      "Cook oats with water or milk per package directions.",
      "Stir in protein powder off heat until smooth.",
      "Transfer to a bowl. Slice banana on top.",
      "Drizzle with almond butter and sprinkle with cinnamon."
    ]),
    ingredients: JSON.stringify([
      { amount: "1 cup", name: "rolled oats", substitutes: ["gluten-free oats", "steel-cut oats"] },
      { amount: "1 scoop", name: "protein powder", substitutes: ["1/4 cup hemp seeds"] },
      { amount: "1", name: "banana, sliced", substitutes: ["1 cup berries"] },
      { amount: "1 tbsp", name: "almond butter", substitutes: ["peanut butter", "sunflower butter"] },
      { amount: "1/4 tsp", name: "cinnamon", substitutes: [] },
      { amount: "1 cup", name: "water or milk", substitutes: [] }
    ]),
    cost_per_serving: 2.50,
    storage: "Refrigerate up to 2 days; reheat with a splash of liquid.",
    reheat: "Microwave 1–2 minutes with added liquid.",
    equipment: JSON.stringify(["Small pot or microwave-safe bowl"])
  },
  {
    id: "r17",
    title: "Avocado Egg Toast",
    description: "A trendy, nutrient-balanced breakfast with healthy fats from avocado and complete protein from eggs.",
    category: "Breakfast",
    goal_tags: JSON.stringify(["Lose Weight", "General Health", "Quick Meals"]),
    dietary_tags: JSON.stringify(["Vegetarian", "Dairy-Free", "Gluten-Free Option"]),
    allergy_tags: JSON.stringify(["Eggs", "Gluten"]),
    prep_time_mins: 5,
    cook_time_mins: 5,
    servings: 1,
    difficulty: "Easy",
    calories: 400,
    protein: 22,
    carbs: 30,
    fat: 22,
    fiber: 6,
    sodium: 360,
    instructions: JSON.stringify([
      "Toast bread until golden.",
      "Mash avocado with lemon juice, salt, and pepper.",
      "Cook eggs to your preference (poached, fried, or scrambled).",
      "Spread mashed avocado on toast.",
      "Top with eggs.",
      "Season with red pepper flakes, everything bagel seasoning, or hot sauce."
    ]),
    ingredients: JSON.stringify([
      { amount: "2 slices", name: "whole-grain or sourdough bread", substitutes: ["gluten-free bread", "rice cakes"] },
      { amount: "1/2", name: "avocado, ripe", substitutes: [] },
      { amount: "2", name: "eggs", substitutes: [] },
      { amount: "squeeze", name: "lemon juice", substitutes: ["lime juice"] },
      { amount: "to taste", name: "red pepper flakes, salt, pepper", substitutes: [] }
    ]),
    cost_per_serving: 2.80,
    storage: "Best eaten immediately.",
    reheat: "N/A — make fresh.",
    equipment: JSON.stringify(["Toaster", "Small skillet or poaching pan"])
  },
  {
    id: "r18",
    title: "Turkey Quinoa Bowl",
    description: "A high-protein, muscle-building lunch with lean ground turkey, quinoa, and roasted vegetables.",
    category: "Lunch",
    goal_tags: JSON.stringify(["Build Muscle", "Gain Weight", "Meal Prep"]),
    dietary_tags: JSON.stringify(["Gluten-Free", "Dairy-Free"]),
    allergy_tags: JSON.stringify([]),
    prep_time_mins: 10,
    cook_time_mins: 20,
    servings: 3,
    difficulty: "Easy",
    calories: 540,
    protein: 45,
    carbs: 50,
    fat: 14,
    fiber: 7,
    sodium: 400,
    instructions: JSON.stringify([
      "Cook quinoa in broth for extra flavor per package directions.",
      "Brown ground turkey in a skillet with olive oil over medium-high heat, 8 minutes.",
      "Season with garlic powder, cumin, chili powder, salt, and pepper.",
      "Roast vegetables at 400°F with olive oil for 20 minutes.",
      "Build bowls: quinoa → turkey → roasted vegetables → avocado.",
      "Top with salsa or hot sauce."
    ]),
    ingredients: JSON.stringify([
      { amount: "1 lb", name: "lean ground turkey", substitutes: ["ground chicken", "tempeh"] },
      { amount: "3/4 cup", name: "dry quinoa", substitutes: ["brown rice", "farro"] },
      { amount: "2 cups", name: "vegetable broth", substitutes: ["water"] },
      { amount: "2 cups", name: "broccoli, sweet potato, or zucchini (any mix)", substitutes: [] },
      { amount: "1", name: "avocado", substitutes: [] },
      { amount: "1/4 cup", name: "salsa", substitutes: [] },
      { amount: "1 tsp each", name: "garlic powder, cumin, chili powder", substitutes: [] }
    ]),
    cost_per_serving: 4.20,
    storage: "Refrigerate up to 4 days.",
    reheat: "Microwave 2 minutes. Add avocado fresh.",
    equipment: JSON.stringify(["Skillet", "Medium pot", "Sheet pan", "Oven"])
  },
  {
    id: "r19",
    title: "Chickpea Mediterranean Wrap",
    description: "A quick, satisfying plant-based wrap full of Mediterranean flavors. Budget-friendly and high in fiber.",
    category: "Lunch",
    goal_tags: JSON.stringify(["Vegetarian", "Budget Meals", "Quick Meals", "Mediterranean"]),
    dietary_tags: JSON.stringify(["Vegetarian", "Vegan Option", "Dairy-Free Option"]),
    allergy_tags: JSON.stringify(["Gluten", "Sesame"]),
    prep_time_mins: 10,
    cook_time_mins: 5,
    servings: 2,
    difficulty: "Easy",
    calories: 460,
    protein: 18,
    carbs: 58,
    fat: 16,
    fiber: 12,
    sodium: 500,
    instructions: JSON.stringify([
      "Warm tortillas in a dry skillet 30 seconds per side.",
      "Season chickpeas with cumin, paprika, salt, and pepper. Briefly warm in skillet if desired.",
      "Spread hummus on each tortilla.",
      "Layer with chickpeas, tomatoes, cucumber, red onion, and feta.",
      "Drizzle with olive oil and lemon juice.",
      "Roll tightly and slice in half."
    ]),
    ingredients: JSON.stringify([
      { amount: "1 can (15oz)", name: "chickpeas, drained and rinsed", substitutes: ["grilled chicken for non-veg"] },
      { amount: "2 large", name: "whole-wheat tortillas", substitutes: ["gluten-free tortillas", "lettuce wraps"] },
      { amount: "4 tbsp", name: "hummus", substitutes: [] },
      { amount: "1", name: "tomato, diced", substitutes: ["cherry tomatoes"] },
      { amount: "1/2", name: "cucumber, sliced", substitutes: [] },
      { amount: "2 tbsp", name: "feta cheese", substitutes: ["omit for vegan", "dairy-free feta"] },
      { amount: "1/4", name: "red onion, thinly sliced", substitutes: [] },
      { amount: "1/2 tsp each", name: "cumin, paprika", substitutes: [] }
    ]),
    cost_per_serving: 2.80,
    storage: "Wrap tightly in foil. Refrigerate up to 2 days.",
    reheat: "Eat cold or warm in a skillet 2 minutes per side.",
    equipment: JSON.stringify(["Skillet"])
  },
  {
    id: "r20",
    title: "Chicken Taco Bowl",
    description: "A colorful, high-protein taco bowl with lettuce, beans, and all the classics. Great for the whole family.",
    category: "Dinner",
    goal_tags: JSON.stringify(["Lose Weight", "Build Muscle", "Family Meals"]),
    dietary_tags: JSON.stringify(["Gluten-Free", "Dairy-Free Option"]),
    allergy_tags: JSON.stringify([]),
    prep_time_mins: 10,
    cook_time_mins: 20,
    servings: 4,
    difficulty: "Easy",
    calories: 490,
    protein: 40,
    carbs: 52,
    fat: 12,
    fiber: 9,
    sodium: 440,
    instructions: JSON.stringify([
      "Season chicken with taco seasoning.",
      "Cook chicken in a skillet over medium-high heat until cooked through, 15 minutes. Shred or slice.",
      "Cook rice according to package directions.",
      "Warm black beans with a pinch of cumin.",
      "Build bowls: rice → beans → chicken → corn → lettuce → pico de gallo → avocado.",
      "Add optional cheese, sour cream, or hot sauce."
    ]),
    ingredients: JSON.stringify([
      { amount: "1.5 lbs", name: "chicken breast", substitutes: ["ground turkey", "black beans only (vegetarian)"] },
      { amount: "1 cup", name: "dry rice", substitutes: ["cauliflower rice", "quinoa"] },
      { amount: "1 can", name: "black beans, drained", substitutes: [] },
      { amount: "1/2 cup", name: "frozen corn", substitutes: [] },
      { amount: "2 cups", name: "shredded lettuce or romaine", substitutes: [] },
      { amount: "1 cup", name: "pico de gallo or salsa", substitutes: [] },
      { amount: "1", name: "avocado, diced", substitutes: [] },
      { amount: "2 tbsp", name: "taco seasoning", substitutes: [] }
    ]),
    cost_per_serving: 4.00,
    storage: "Refrigerate components separately up to 4 days.",
    reheat: "Reheat chicken, rice, and beans. Add cold toppings fresh.",
    equipment: JSON.stringify(["Skillet", "Medium pot", "Bowls"])
  },
  {
    id: "r21",
    title: "Lentil Vegetable Soup",
    description: "A hearty, high-fiber vegetarian soup perfect for meal prep. Warming, budget-friendly, and very satisfying.",
    category: "Lunch",
    goal_tags: JSON.stringify(["Vegetarian", "Vegan", "Budget Meals", "Meal Prep", "General Health"]),
    dietary_tags: JSON.stringify(["Vegan", "Gluten-Free", "Dairy-Free"]),
    allergy_tags: JSON.stringify([]),
    prep_time_mins: 10,
    cook_time_mins: 35,
    servings: 6,
    difficulty: "Easy",
    calories: 290,
    protein: 15,
    carbs: 48,
    fat: 4,
    fiber: 14,
    sodium: 520,
    instructions: JSON.stringify([
      "Heat olive oil in a large pot over medium heat. Add onion, carrots, and celery. Cook 5 minutes.",
      "Add garlic, cumin, turmeric, and smoked paprika. Cook 1 minute.",
      "Add lentils, diced tomatoes, vegetable broth, and bay leaves.",
      "Bring to a boil, then simmer 25–30 minutes until lentils are tender.",
      "Remove bay leaves. Add spinach and stir until wilted.",
      "Season with lemon juice, salt, and pepper."
    ]),
    ingredients: JSON.stringify([
      { amount: "1.5 cups", name: "green or brown lentils, rinsed", substitutes: ["red lentils"] },
      { amount: "3", name: "carrots, diced", substitutes: [] },
      { amount: "3 stalks", name: "celery, diced", substitutes: [] },
      { amount: "1", name: "onion, diced", substitutes: [] },
      { amount: "4 cloves", name: "garlic, minced", substitutes: [] },
      { amount: "14 oz can", name: "diced tomatoes", substitutes: [] },
      { amount: "6 cups", name: "vegetable broth", substitutes: ["water"] },
      { amount: "2 cups", name: "baby spinach", substitutes: ["kale"] },
      { amount: "1 tsp each", name: "cumin, turmeric, smoked paprika", substitutes: [] },
      { amount: "1", name: "lemon, juiced", substitutes: [] }
    ]),
    cost_per_serving: 1.80,
    storage: "Refrigerate up to 5 days. Freezes up to 3 months.",
    reheat: "Microwave 2–3 minutes or stovetop over medium heat. Add water if too thick.",
    equipment: JSON.stringify(["Large pot"])
  },
  {
    id: "r22",
    title: "Baked White Fish with Sweet Potato",
    description: "A light, omega-rich dinner balanced with sweet potato and green beans. Low-calorie, high-protein, and easy.",
    category: "Dinner",
    goal_tags: JSON.stringify(["Lose Weight", "General Health", "Low Carb Option"]),
    dietary_tags: JSON.stringify(["Gluten-Free", "Dairy-Free"]),
    allergy_tags: JSON.stringify(["Fish"]),
    prep_time_mins: 10,
    cook_time_mins: 25,
    servings: 2,
    difficulty: "Easy",
    calories: 430,
    protein: 40,
    carbs: 38,
    fat: 10,
    fiber: 6,
    sodium: 300,
    instructions: JSON.stringify([
      "Preheat oven to 400°F. Line a sheet pan with parchment.",
      "Cube sweet potatoes and toss with olive oil, salt, pepper, and paprika.",
      "Roast sweet potatoes 15 minutes.",
      "Push to one side. Place fish on pan. Brush with olive oil, lemon, garlic, and herbs.",
      "Add green beans to pan. Roast 12–15 more minutes until fish flakes.",
      "Serve immediately with lemon wedges."
    ]),
    ingredients: JSON.stringify([
      { amount: "2 fillets", name: "tilapia, cod, or halibut", substitutes: ["salmon", "chicken breast", "firm tofu"] },
      { amount: "2 medium", name: "sweet potatoes, cubed", substitutes: ["regular potatoes", "butternut squash"] },
      { amount: "2 cups", name: "green beans, trimmed", substitutes: ["asparagus", "broccoli"] },
      { amount: "2 tbsp", name: "olive oil", substitutes: [] },
      { amount: "1", name: "lemon", substitutes: [] },
      { amount: "2 cloves", name: "garlic, minced", substitutes: [] },
      { amount: "1 tsp", name: "paprika and dried herbs of choice", substitutes: [] }
    ]),
    cost_per_serving: 6.50,
    storage: "Refrigerate up to 2 days. Fish is best eaten fresh.",
    reheat: "Reheat at 350°F for 8 minutes.",
    equipment: JSON.stringify(["Sheet pan", "Oven", "Parchment paper"])
  },
  {
    id: "r23",
    title: "Whole-Grain Protein Pancakes",
    description: "Fluffy, high-protein pancakes that make a great weekend breakfast or meal-prep item. Kid-friendly.",
    category: "Breakfast",
    goal_tags: JSON.stringify(["Gain Weight", "Build Muscle", "Family Meals", "General Health"]),
    dietary_tags: JSON.stringify(["Vegetarian"]),
    allergy_tags: JSON.stringify(["Eggs", "Gluten", "Dairy"]),
    prep_time_mins: 5,
    cook_time_mins: 15,
    servings: 2,
    difficulty: "Easy",
    calories: 420,
    protein: 28,
    carbs: 48,
    fat: 12,
    fiber: 5,
    sodium: 310,
    instructions: JSON.stringify([
      "In a bowl, mix oat flour, protein powder, baking powder, and cinnamon.",
      "In another bowl, whisk together eggs, milk, banana, and vanilla.",
      "Combine wet and dry ingredients. Do not overmix.",
      "Heat a non-stick skillet over medium heat; lightly grease with oil or cooking spray.",
      "Pour 1/4 cup batter per pancake. Cook until bubbles form, ~2 min, then flip.",
      "Cook another 1–2 minutes until cooked through.",
      "Serve with fresh berries, yogurt, or maple syrup."
    ]),
    ingredients: JSON.stringify([
      { amount: "1 cup", name: "oat flour (or blended oats)", substitutes: ["whole-wheat flour", "gluten-free flour blend"] },
      { amount: "1 scoop", name: "protein powder", substitutes: ["2 tbsp hemp seeds + extra oat flour"] },
      { amount: "2", name: "eggs", substitutes: ["flax eggs (1 tbsp flax + 3 tbsp water each)"] },
      { amount: "1/2 cup", name: "milk of choice", substitutes: [] },
      { amount: "1", name: "ripe banana, mashed", substitutes: ["1/4 cup applesauce"] },
      { amount: "1 tsp", name: "baking powder", substitutes: [] },
      { amount: "1/2 tsp", name: "vanilla extract", substitutes: [] },
      { amount: "1/4 tsp", name: "cinnamon", substitutes: [] }
    ]),
    cost_per_serving: 2.50,
    storage: "Refrigerate up to 3 days. Freeze up to 1 month.",
    reheat: "Microwave 30–45 seconds or toast until warm.",
    equipment: JSON.stringify(["Non-stick skillet", "Two mixing bowls", "Spatula"])
  },
  {
    id: "r24",
    title: "Tuna Chickpea Bowl",
    description: "A no-cook, high-protein budget lunch packed with fiber from chickpeas and omega-3s from tuna.",
    category: "Lunch",
    goal_tags: JSON.stringify(["Lose Weight", "Budget Meals", "Quick Meals", "No-Cook"]),
    dietary_tags: JSON.stringify(["Gluten-Free", "Dairy-Free"]),
    allergy_tags: JSON.stringify(["Fish"]),
    prep_time_mins: 8,
    cook_time_mins: 0,
    servings: 2,
    difficulty: "Easy",
    calories: 430,
    protein: 38,
    carbs: 42,
    fat: 10,
    fiber: 10,
    sodium: 480,
    instructions: JSON.stringify([
      "Drain and rinse chickpeas and tuna.",
      "Combine in a large bowl with cherry tomatoes, cucumber, and red onion.",
      "Whisk together olive oil, lemon juice, Dijon, oregano, salt, and pepper.",
      "Toss everything with the dressing.",
      "Serve over a bed of greens or with pita."
    ]),
    ingredients: JSON.stringify([
      { amount: "2 cans (5oz each)", name: "tuna in water, drained", substitutes: ["salmon", "chickpeas only (vegan)"] },
      { amount: "1 can (15oz)", name: "chickpeas, drained", substitutes: ["white beans", "lentils"] },
      { amount: "1 cup", name: "cherry tomatoes, halved", substitutes: [] },
      { amount: "1", name: "cucumber, diced", substitutes: [] },
      { amount: "1/4", name: "red onion, diced", substitutes: [] },
      { amount: "2 tbsp", name: "olive oil", substitutes: [] },
      { amount: "1", name: "lemon, juiced", substitutes: [] },
      { amount: "1 tsp", name: "dried oregano", substitutes: [] }
    ]),
    cost_per_serving: 3.20,
    storage: "Refrigerate up to 3 days without dressing.",
    reheat: "Serve cold.",
    equipment: JSON.stringify(["Large bowl", "Whisk"])
  },
  {
    id: "r25",
    title: "Slow-Cooker Chicken Vegetable Soup",
    description: "A comforting, lean protein-rich soup that practically makes itself. Perfect for batch cooking and recovery days.",
    category: "Dinner",
    goal_tags: JSON.stringify(["Lose Weight", "Recovery", "Meal Prep", "Family Meals", "Budget Meals"]),
    dietary_tags: JSON.stringify(["Gluten-Free", "Dairy-Free", "Low Carb Option"]),
    allergy_tags: JSON.stringify([]),
    prep_time_mins: 15,
    cook_time_mins: 240,
    servings: 6,
    difficulty: "Easy",
    calories: 310,
    protein: 35,
    carbs: 25,
    fat: 6,
    fiber: 5,
    sodium: 540,
    instructions: JSON.stringify([
      "Place chicken breasts in the slow cooker.",
      "Add carrots, celery, onion, garlic, potatoes, and corn.",
      "Pour in chicken broth. Add thyme, rosemary, bay leaves, salt, and pepper.",
      "Cook on HIGH 3–4 hours or LOW 7–8 hours.",
      "Remove chicken and shred with two forks. Return to pot.",
      "Stir in fresh parsley. Adjust seasoning before serving."
    ]),
    ingredients: JSON.stringify([
      { amount: "2 lbs", name: "chicken breast", substitutes: ["chicken thighs", "turkey breast"] },
      { amount: "4", name: "carrots, sliced", substitutes: [] },
      { amount: "3 stalks", name: "celery, sliced", substitutes: [] },
      { amount: "1", name: "onion, diced", substitutes: [] },
      { amount: "3 cloves", name: "garlic, minced", substitutes: [] },
      { amount: "2", name: "potatoes, cubed", substitutes: ["sweet potatoes", "omit for lower carb"] },
      { amount: "1 cup", name: "frozen corn", substitutes: ["omit for lower carb"] },
      { amount: "6 cups", name: "low-sodium chicken broth", substitutes: ["vegetable broth"] },
      { amount: "1 tsp each", name: "thyme, rosemary, salt, pepper", substitutes: [] },
      { amount: "2 bay leaves", name: "bay leaves", substitutes: [] }
    ]),
    cost_per_serving: 3.50,
    storage: "Refrigerate up to 5 days. Freeze up to 3 months.",
    reheat: "Microwave 2–3 minutes or stovetop over medium heat.",
    equipment: JSON.stringify(["Slow cooker or large pot", "Two forks for shredding"])
  }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeMacro(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Nutrition Profile ────────────────────────────────────────────────────────

router.get("/nutrition/profile", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  try {
    const result = await db.execute(
      sql`SELECT * FROM nutrition_profiles WHERE user_id = ${userId} LIMIT 1`
    );
    if (result.rows.length === 0) {
      // Return sensible defaults
      res.json({
        onboarding_complete: false,
        goal: null,
        daily_calories: 2000,
        protein_target: 150,
        carbs_target: 200,
        fat_target: 65,
        fiber_target: 30,
        water_target_ml: 2500,
        tracking_mode: "guided",
        dietary_pattern: "omnivore",
        allergies: [],
        intolerances: [],
        activity_level: "moderately_active",
        meal_frequency: "three_plus_snacks"
      });
      return;
    }
    const row = result.rows[0] as any;
    res.json({
      ...row,
      allergies: row.allergies ? JSON.parse(row.allergies) : [],
      intolerances: row.intolerances ? JSON.parse(row.intolerances) : [],
      secondary_goals: row.secondary_goals ? JSON.parse(row.secondary_goals) : [],
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch nutrition profile" });
  }
});

router.put("/nutrition/profile", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  const {
    goal, secondary_goals, daily_calories, protein_target, carbs_target,
    fat_target, fiber_target, water_target_ml, tracking_mode,
    dietary_pattern, allergies, intolerances, activity_level,
    meal_frequency, onboarding_complete
  } = req.body;

  try {
    await db.execute(sql`
      INSERT INTO nutrition_profiles (
        user_id, goal, secondary_goals, daily_calories, protein_target,
        carbs_target, fat_target, fiber_target, water_target_ml,
        tracking_mode, dietary_pattern, allergies, intolerances,
        activity_level, meal_frequency, onboarding_complete, updated_at
      ) VALUES (
        ${userId},
        ${goal ?? null},
        ${JSON.stringify(secondary_goals ?? [])},
        ${daily_calories ?? 2000},
        ${protein_target ?? 150},
        ${carbs_target ?? 200},
        ${fat_target ?? 65},
        ${fiber_target ?? 30},
        ${water_target_ml ?? 2500},
        ${tracking_mode ?? 'guided'},
        ${dietary_pattern ?? 'omnivore'},
        ${JSON.stringify(allergies ?? [])},
        ${JSON.stringify(intolerances ?? [])},
        ${activity_level ?? 'moderately_active'},
        ${meal_frequency ?? 'three_plus_snacks'},
        ${onboarding_complete ?? false},
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        goal = EXCLUDED.goal,
        secondary_goals = EXCLUDED.secondary_goals,
        daily_calories = EXCLUDED.daily_calories,
        protein_target = EXCLUDED.protein_target,
        carbs_target = EXCLUDED.carbs_target,
        fat_target = EXCLUDED.fat_target,
        fiber_target = EXCLUDED.fiber_target,
        water_target_ml = EXCLUDED.water_target_ml,
        tracking_mode = EXCLUDED.tracking_mode,
        dietary_pattern = EXCLUDED.dietary_pattern,
        allergies = EXCLUDED.allergies,
        intolerances = EXCLUDED.intolerances,
        activity_level = EXCLUDED.activity_level,
        meal_frequency = EXCLUDED.meal_frequency,
        onboarding_complete = EXCLUDED.onboarding_complete,
        updated_at = NOW()
    `);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update nutrition profile" });
  }
});

// ─── Recipes ─────────────────────────────────────────────────────────────────

router.get("/nutrition/recipes", async (req, res) => {
  const { category, goal, dietary, q, limit = "50", offset = "0" } = req.query as any;
  try {
    let rows: any[];
    // Simple approach: fetch all then filter in JS (25 recipes is fine)
    const result = await db.execute(sql`
      SELECT id, title, description, category, goal_tags, dietary_tags, allergy_tags,
             prep_time_mins, cook_time_mins, servings, difficulty,
             calories, protein, carbs, fat, fiber, sodium, cost_per_serving
      FROM recipes
      WHERE is_published = true
      ORDER BY title
    `);
    rows = result.rows as any[];

    if (category && category !== "All") {
      rows = rows.filter((r) => r.category === category);
    }
    if (goal) {
      rows = rows.filter((r) => {
        try { return (JSON.parse(r.goal_tags) as string[]).some((g) => g.toLowerCase().includes(goal.toLowerCase())); }
        catch { return false; }
      });
    }
    if (dietary) {
      rows = rows.filter((r) => {
        try { return (JSON.parse(r.dietary_tags) as string[]).some((d) => d.toLowerCase().includes(dietary.toLowerCase())); }
        catch { return false; }
      });
    }
    if (q) {
      const query = q.toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(query) || r.description.toLowerCase().includes(query));
    }

    const total = rows.length;
    rows = rows.slice(Number(offset), Number(offset) + Number(limit));
    rows = rows.map((r) => ({
      ...r,
      goal_tags: r.goal_tags ? JSON.parse(r.goal_tags) : [],
      dietary_tags: r.dietary_tags ? JSON.parse(r.dietary_tags) : [],
      allergy_tags: r.allergy_tags ? JSON.parse(r.allergy_tags) : [],
    }));

    res.json({ recipes: rows, total });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch recipes" });
  }
});

router.get("/nutrition/recipes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.execute(sql`SELECT * FROM recipes WHERE id = ${id} AND is_published = true LIMIT 1`);
    if (result.rows.length === 0) { res.status(404).json({ error: "Recipe not found" }); return; }
    const row = result.rows[0] as any;
    res.json({
      ...row,
      goal_tags: row.goal_tags ? JSON.parse(row.goal_tags) : [],
      dietary_tags: row.dietary_tags ? JSON.parse(row.dietary_tags) : [],
      allergy_tags: row.allergy_tags ? JSON.parse(row.allergy_tags) : [],
      ingredients: row.ingredients ? JSON.parse(row.ingredients) : [],
      instructions: row.instructions ? JSON.parse(row.instructions) : [],
      equipment: row.equipment ? JSON.parse(row.equipment) : [],
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch recipe" });
  }
});

// ─── Saved Recipes ────────────────────────────────────────────────────────────

router.post("/nutrition/recipes/:id/save", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  const { id } = req.params;
  try {
    await db.execute(sql`
      INSERT INTO saved_recipes (user_id, recipe_id) VALUES (${userId}, ${id})
      ON CONFLICT (user_id, recipe_id) DO NOTHING
    `);
    res.json({ saved: true });
  } catch { res.status(500).json({ error: "Failed to save recipe" }); }
});

router.delete("/nutrition/recipes/:id/save", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  const { id } = req.params;
  try {
    await db.execute(sql`DELETE FROM saved_recipes WHERE user_id = ${userId} AND recipe_id = ${id}`);
    res.json({ saved: false });
  } catch { res.status(500).json({ error: "Failed to unsave recipe" }); }
});

router.get("/nutrition/saved-recipes", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  try {
    const result = await db.execute(sql`
      SELECT r.id, r.title, r.description, r.category, r.goal_tags, r.dietary_tags,
             r.prep_time_mins, r.cook_time_mins, r.servings, r.difficulty,
             r.calories, r.protein, r.carbs, r.fat, r.fiber, r.cost_per_serving
      FROM saved_recipes sr
      JOIN recipes r ON r.id = sr.recipe_id
      WHERE sr.user_id = ${userId}
      ORDER BY sr.created_at DESC
    `);
    res.json({ recipes: (result.rows as any[]).map((r) => ({
      ...r,
      goal_tags: r.goal_tags ? JSON.parse(r.goal_tags) : [],
      dietary_tags: r.dietary_tags ? JSON.parse(r.dietary_tags) : [],
    })) });
  } catch { res.status(500).json({ error: "Failed to fetch saved recipes" }); }
});

// ─── Food Logging ─────────────────────────────────────────────────────────────

router.get("/nutrition/food-logs", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  const date = (req.query.date as string) || today();
  try {
    const result = await db.execute(sql`
      SELECT * FROM food_logs
      WHERE user_id = ${userId}
        AND DATE(logged_at AT TIME ZONE 'UTC') = ${date}::date
      ORDER BY logged_at ASC
    `);
    res.json({ logs: result.rows });
  } catch { res.status(500).json({ error: "Failed to fetch food logs" }); }
});

router.post("/nutrition/food-logs", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  const { meal_category, food_name, brand, calories, protein, carbs, fat, fiber,
          serving_amount, serving_unit, notes, recipe_id } = req.body;
  if (!meal_category || !food_name) {
    res.status(400).json({ error: "meal_category and food_name are required" });
    return;
  }
  const id = randomUUID();
  try {
    await db.execute(sql`
      INSERT INTO food_logs (id, user_id, meal_category, food_name, brand,
        calories, protein, carbs, fat, fiber, serving_amount, serving_unit, notes, recipe_id)
      VALUES (${id}, ${userId}, ${meal_category}, ${food_name}, ${brand ?? null},
        ${safeMacro(calories)}, ${safeMacro(protein)}, ${safeMacro(carbs)},
        ${safeMacro(fat)}, ${safeMacro(fiber)},
        ${safeMacro(serving_amount) || 1}, ${serving_unit ?? 'serving'},
        ${notes ?? null}, ${recipe_id ?? null})
    `);
    const result = await db.execute(sql`SELECT * FROM food_logs WHERE id = ${id}`);
    res.status(201).json(result.rows[0]);
  } catch { res.status(500).json({ error: "Failed to log food" }); }
});

router.delete("/nutrition/food-logs/:id", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  const { id } = req.params;
  try {
    const result = await db.execute(sql`SELECT user_id FROM food_logs WHERE id = ${id} LIMIT 1`);
    if (result.rows.length === 0) { res.status(404).json({ error: "Log not found" }); return; }
    if ((result.rows[0] as any).user_id !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
    await db.execute(sql`DELETE FROM food_logs WHERE id = ${id}`);
    res.json({ deleted: true });
  } catch { res.status(500).json({ error: "Failed to delete log" }); }
});

// ─── Water Logging ────────────────────────────────────────────────────────────

router.get("/nutrition/water-logs", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  const date = (req.query.date as string) || today();
  try {
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(amount_ml), 0) as total_ml, COUNT(*) as entries
      FROM water_logs
      WHERE user_id = ${userId}
        AND DATE(logged_at AT TIME ZONE 'UTC') = ${date}::date
    `);
    res.json(result.rows[0] || { total_ml: 0, entries: 0 });
  } catch { res.status(500).json({ error: "Failed to fetch water logs" }); }
});

router.post("/nutrition/water-logs", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  const { amount_ml = 250 } = req.body;
  if (amount_ml <= 0 || amount_ml > 5000) {
    res.status(400).json({ error: "amount_ml must be between 1 and 5000" });
    return;
  }
  try {
    await db.execute(sql`INSERT INTO water_logs (user_id, amount_ml) VALUES (${userId}, ${amount_ml})`);
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(amount_ml), 0) as total_ml
      FROM water_logs WHERE user_id = ${userId} AND DATE(logged_at AT TIME ZONE 'UTC') = CURRENT_DATE
    `);
    res.status(201).json({ total_ml: (result.rows[0] as any)?.total_ml ?? 0 });
  } catch { res.status(500).json({ error: "Failed to log water" }); }
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

router.get("/nutrition/dashboard", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  const date = (req.query.date as string) || today();
  try {
    const [profileResult, foodResult, waterResult] = await Promise.all([
      db.execute(sql`SELECT * FROM nutrition_profiles WHERE user_id = ${userId} LIMIT 1`),
      db.execute(sql`
        SELECT meal_category, food_name, calories, protein, carbs, fat, fiber, id, logged_at
        FROM food_logs
        WHERE user_id = ${userId} AND DATE(logged_at AT TIME ZONE 'UTC') = ${date}::date
        ORDER BY logged_at ASC
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(amount_ml), 0) as total_ml
        FROM water_logs WHERE user_id = ${userId} AND DATE(logged_at AT TIME ZONE 'UTC') = ${date}::date
      `)
    ]);

    const profile = (profileResult.rows[0] as any) ?? {
      daily_calories: 2000, protein_target: 150, carbs_target: 200,
      fat_target: 65, fiber_target: 30, water_target_ml: 2500,
      onboarding_complete: false, tracking_mode: "guided"
    };

    const logs = foodResult.rows as any[];
    const totals = logs.reduce(
      (acc, log) => ({
        calories: acc.calories + safeMacro(log.calories),
        protein: acc.protein + safeMacro(log.protein),
        carbs: acc.carbs + safeMacro(log.carbs),
        fat: acc.fat + safeMacro(log.fat),
        fiber: acc.fiber + safeMacro(log.fiber),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );

    const waterMl = safeMacro((waterResult.rows[0] as any)?.total_ml ?? 0);
    const caloriesRemaining = Math.max(0, (profile.daily_calories ?? 2000) - Math.round(totals.calories));
    const nutritionScore = calculateScore({ totals, profile, waterMl, logCount: logs.length });

    res.json({
      profile: {
        ...profile,
        allergies: profile.allergies ? JSON.parse(profile.allergies) : [],
        secondary_goals: profile.secondary_goals ? JSON.parse(profile.secondary_goals) : [],
      },
      today: {
        date,
        ...totals,
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fat: Math.round(totals.fat),
        fiber: Math.round(totals.fiber),
        calories_remaining: caloriesRemaining,
        water_ml: waterMl,
      },
      logs,
      nutrition_score: nutritionScore,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

function calculateScore({ totals, profile, waterMl, logCount }: any): number {
  let score = 0;
  const cal = profile.daily_calories ?? 2000;
  const calPct = totals.calories / cal;
  if (calPct >= 0.7 && calPct <= 1.1) score += 25;
  else if (calPct >= 0.5) score += 12;

  const proTarget = profile.protein_target ?? 150;
  const proPct = totals.protein / proTarget;
  if (proPct >= 0.8) score += 25;
  else if (proPct >= 0.5) score += 12;

  const waterTarget = profile.water_target_ml ?? 2500;
  const waterPct = waterMl / waterTarget;
  if (waterPct >= 0.8) score += 20;
  else if (waterPct >= 0.5) score += 10;

  if (logCount >= 3) score += 15;
  else if (logCount >= 1) score += 8;

  const fiberTarget = profile.fiber_target ?? 30;
  if (totals.fiber >= fiberTarget * 0.8) score += 15;
  else if (totals.fiber >= fiberTarget * 0.5) score += 8;

  return Math.min(100, score);
}

// ─── Grocery Lists ────────────────────────────────────────────────────────────

router.get("/nutrition/grocery-lists", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  try {
    const lists = await db.execute(sql`
      SELECT id, title, created_at, is_active FROM grocery_lists
      WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 10
    `);
    if (lists.rows.length === 0) { res.json({ lists: [] }); return; }
    const listId = (lists.rows[0] as any).id;
    const items = await db.execute(sql`SELECT * FROM grocery_items WHERE list_id = ${listId} ORDER BY category, name`);
    res.json({ lists: lists.rows, active: lists.rows[0], items: items.rows });
  } catch { res.status(500).json({ error: "Failed to fetch grocery lists" }); }
});

router.post("/nutrition/grocery-lists", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  const { title = "My Grocery List", items = [] } = req.body;
  const listId = randomUUID();
  try {
    await db.execute(sql`INSERT INTO grocery_lists (id, user_id, title) VALUES (${listId}, ${userId}, ${title})`);
    for (const item of items) {
      const itemId = randomUUID();
      await db.execute(sql`
        INSERT INTO grocery_items (id, list_id, category, name, amount, unit)
        VALUES (${itemId}, ${listId}, ${item.category ?? 'Other'}, ${item.name}, ${item.amount ?? ''}, ${item.unit ?? ''})
      `);
    }
    const result = await db.execute(sql`SELECT * FROM grocery_items WHERE list_id = ${listId} ORDER BY category, name`);
    res.status(201).json({ list_id: listId, items: result.rows });
  } catch { res.status(500).json({ error: "Failed to create grocery list" }); }
});

router.post("/nutrition/grocery-items", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  const { list_id, category = "Other", name, amount = "", unit = "" } = req.body;
  if (!list_id || !name) { res.status(400).json({ error: "list_id and name are required" }); return; }
  // Verify ownership
  const check = await db.execute(sql`SELECT id FROM grocery_lists WHERE id = ${list_id} AND user_id = ${userId} LIMIT 1`);
  if (check.rows.length === 0) { res.status(403).json({ error: "Forbidden" }); return; }
  const id = randomUUID();
  try {
    await db.execute(sql`INSERT INTO grocery_items (id, list_id, category, name, amount, unit, custom_added) VALUES (${id}, ${list_id}, ${category}, ${name}, ${amount}, ${unit}, true)`);
    const result = await db.execute(sql`SELECT * FROM grocery_items WHERE id = ${id}`);
    res.status(201).json(result.rows[0]);
  } catch { res.status(500).json({ error: "Failed to add item" }); }
});

router.patch("/nutrition/grocery-items/:id", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  const { id } = req.params;
  const { is_checked } = req.body;
  try {
    // Verify ownership via join
    const check = await db.execute(sql`
      SELECT gi.id FROM grocery_items gi
      JOIN grocery_lists gl ON gl.id = gi.list_id
      WHERE gi.id = ${id} AND gl.user_id = ${userId} LIMIT 1
    `);
    if (check.rows.length === 0) { res.status(403).json({ error: "Forbidden" }); return; }
    await db.execute(sql`UPDATE grocery_items SET is_checked = ${is_checked} WHERE id = ${id}`);
    res.json({ updated: true });
  } catch { res.status(500).json({ error: "Failed to update item" }); }
});

router.delete("/nutrition/grocery-items/:id", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.authUser!.userId;
  const { id } = req.params;
  try {
    const check = await db.execute(sql`
      SELECT gi.id FROM grocery_items gi
      JOIN grocery_lists gl ON gl.id = gi.list_id
      WHERE gi.id = ${id} AND gl.user_id = ${userId} LIMIT 1
    `);
    if (check.rows.length === 0) { res.status(403).json({ error: "Forbidden" }); return; }
    await db.execute(sql`DELETE FROM grocery_items WHERE id = ${id}`);
    res.json({ deleted: true });
  } catch { res.status(500).json({ error: "Failed to delete item" }); }
});

export default router;
