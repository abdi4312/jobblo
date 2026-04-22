const { OpenAI } = require("openai");
const Category = require("../models/Category");

// OpenAI Client Initialization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate Job Description and Estimate Price
 * POST /api/ai/generate-job-info
 */
exports.generateJobInfo = async (req, res) => {
  try {
    const { title, category } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ error: "AI Service not configured (Missing API Key)" });
    }

    // Fetch available categories from database
    const dbCategories = await Category.find({ isActive: true }).select("name");
    const categoryNames = dbCategories.map((c) => c.name).join(", ");

    const prompt = `
      You are a professional job assistant specialized in the Norwegian labor market. Based on the job title "${title}" ${category ? `in the category "${category}"` : ""}, 
      please provide:
      1. A professional and engaging job description (around 100-150 words).
      2. A list of 3-5 required skills (Ferdigheter/Tags) for this job.
      3. A fair hourly rate in NOK (Norwegian Krone) for this type of work.
      4. An estimated total price based on the duration.
      5. Category: If the current category is not appropriate, suggest the best one from this list: [${categoryNames}].
      
      CRITICAL: 
      - PERSPECTIVE: The user is the HIRER (the person who will pay). Write the description from the perspective of "I need help with..." or "I am looking for someone to...". 
      - DO NOT write as if you are offering a service (e.g., DON'T say "Are you looking for...?" or "We provide..."). 
      - The user is NOT a company or service provider; the user is a person who needs a task done.
      - Detect the language used in the title and respond in that same language.
      - If you suggest or confirm a category, it MUST be an exact match from the provided list: [${categoryNames}].
      - PRICING: Base the hourlyRate on the local Norwegian market (Norway). Consider typical hourly rates and service fees in Norway (e.g., minimum hourly rates are often 300-500 NOK, while skilled labor starts much higher).
      - CALCULATION: The "estimatedPrice" MUST be exactly "hourlyRate" multiplied by the "duration.value" (if unit is hours).
      
      Respond strictly in JSON format with the following keys:
      {
        "description": "...",
        "skills": ["...", "..."],
        "hourlyRate": 400,
        "estimatedPrice": 800,
        "category": "...",
        "duration": {
          "value": 1,
          "unit": "hours"
        }
      }
      
      Note: duration.unit MUST be one of: "minutes", "hours", "days".
      Note: hourlyRate and estimatedPrice should be numbers.
    `;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generates job information in JSON format.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("AI GENERATION ERROR:", error);

    // Check for OpenAI specific errors
    if (error.status === 429 || error.code === "insufficient_quota") {
      return res.status(429).json({
        error: "AI Quota Exceeded",
        message:
          "You have exceeded your OpenAI API quota. Please check your billing details or plan.",
      });
    }

    return res.status(500).json({ error: "Failed to generate AI content" });
  }
};

/**
 * Generate Job Title based on user description
 * POST /api/ai/generate-title
 */
exports.generateTitle = async (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ error: "Description is required" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ error: "AI Service not configured (Missing API Key)" });
    }

    const prompt = `
      You are a professional job assistant specialized in the Norwegian labor market. Based on the user's brief description: "${description}", 
      please provide:
      1. A professional and catchy job title (max 60 characters).
      2. A list of 3-5 required skills (Ferdigheter/Tags).
      3. A fair hourly rate in NOK (Norwegian Krone).
      4. An estimated duration for the task.
      5. An estimated total price (hourlyRate * duration).
      
      CRITICAL: 
      - PERSPECTIVE: The user is the HIRER (the person who will pay). Write from the perspective of "I need help with..." or "I am looking for someone to...". 
      - DO NOT write as if you are offering a service (e.g., DON'T say "Are you looking for...?" or "We provide..."). 
      - The user is NOT a company or service provider; the user is a person who needs a task done.
      - Detect the language used in the description and respond in that same language.
      - PRICING: Base the hourlyRate on the local Norwegian market (Norway).
      - CALCULATION: "estimatedPrice" MUST be "hourlyRate" multiplied by "duration.value".
      
      Respond strictly in JSON format with the following keys:
      {
        "title": "...",
        "skills": ["...", "..."],
        "hourlyRate": 400,
        "estimatedPrice": 800,
        "duration": {
          "value": 2,
          "unit": "hours"
        }
      }
      
      Note: duration.unit MUST be one of: "minutes", "hours", "days".
    `;

    // Hum explicitly gpt-4o use karte hain kyunke ye JSON mode ke liye behtar hai
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generates job titles in JSON format.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("OpenAI returned empty content");
    }

    const result = JSON.parse(content);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("AI TITLE GENERATION ERROR:", error);

    return res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to generate AI title",
      details: error.code || null,
    });
  }
};

/**
 * Generate a complete, structured job listing based on a short prompt
 * POST /api/ai/generate-full-listing
 */
exports.generateFullJobListing = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ error: "AI Service not configured (Missing API Key)" });
    }

    // Fetch available categories from database
    const dbCategories = await Category.find({ isActive: true }).select("name");
    const categoryNames = dbCategories.map((c) => c.name).join(", ");

    const aiPrompt = `
      You are a professional job listing expert specialized in the Norwegian labor market. Based on the following brief description: "${prompt}", 
      please generate a complete, structured job listing and suggest a fair price range.
      
      Requirements:
      1. Title: A professional and catchy job title.
      2. Description: A detailed and engaging job description (100-200 words).
      3. Category: Choose the most appropriate category ONLY from this list: [${categoryNames}].
      4. Skills: A list of 3-5 required skills for this job.
      5. Hourly Rate: A fair hourly rate in NOK for this service in Norway.
      6. Duration: Estimated time required to complete the task.
      7. Location Relevance: Whether the job needs to be on-site or can be done remotely.
      8. Price Range: A suggested total price range (min-max) based on hourlyRate * duration.
      9. Pricing Reasoning: Explain the hourly rate and how it relates to the duration.
      
      CRITICAL: 
      - PERSPECTIVE: The user is the HIRER (the person who will pay). Write the description from the perspective of "I need help with..." or "I am looking for someone to...". 
      - DO NOT write as if you are offering a service (e.g., DON'T say "Are you looking for...?" or "We provide..."). 
      - The user is NOT a company or service provider; the user is a person who needs a task done.
      - Detect the language used in the prompt and respond in that same language.
      - The "category" field MUST be an exact match from the provided list: [${categoryNames}].
      - PRICING: Base the hourlyRate on the local Norwegian market (Norway).
      - CALCULATION: "priceRange" MUST be based on "hourlyRate" multiplied by "duration.value".
      
      Respond strictly in JSON format with the following keys:
      {
        "title": "...",
        "description": "...",
        "category": "...",
        "skills": ["...", "..."],
        "hourlyRate": 400,
        "duration": {
          "value": 2,
          "unit": "hours"
        },
        "locationRelevance": "on-site/remote",
        "priceRange": {
          "min": 700,
          "max": 900
        },
        "pricingReasoning": "..."
      }

      Note: duration.unit MUST be one of: "minutes", "hours", "days".
    `;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a professional job listing assistant that provides structured information in JSON format.",
        },
        { role: "user", content: aiPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("OpenAI returned empty content");
    }

    const result = JSON.parse(content);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("AI FULL LISTING GENERATION ERROR:", error);

    // Handle OpenAI specific errors
    if (error.status === 429 || error.code === "insufficient_quota") {
      return res.status(429).json({
        success: false,
        error: "AI Quota Exceeded",
        message: "You have exceeded your OpenAI API quota.",
      });
    }

    return res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to generate AI listing",
      details: error.code || null,
    });
  }
};
