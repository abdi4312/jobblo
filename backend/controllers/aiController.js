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
      Based on the job title "${title}" ${category ? `in the category "${category}"` : ""}, please provide the following information.
      
      STRICT LANGUAGE RULE:
      - Detect the language of the input: "${title}".
      - You MUST provide all text fields ("description", "skills", "category") in the EXACT SAME LANGUAGE as the input.
      - DO NOT switch to any other language.

      Requirements:
      1. A professional, engaging, and SPECIFIC job description (100-150 words). Include typical tasks, expectations, and any relevant details for the Norwegian market.
      2. A list of 3-5 RELEVANT, specific skills required for this job in Norway.
      3. A fair hourly rate in NOK (Norwegian Krone) for this type of work (based on Norwegian market rates - e.g., 350-600 NOK/hour for skilled work).
      4. An estimated total price based on a realistic duration for this task.
      5. Category: Choose the most appropriate one ONLY from this list: [${categoryNames}].
      
      OTHER RULES: 
      - PERSPECTIVE: The user is the HIRER. Write the description from the perspective of "I need help with..." or "I am looking for someone to...". 
      - DO NOT write as if you are offering a service.
      - PRICING: Base the hourlyRate on REALISTIC Norwegian market rates (considering both skilled and unskilled work appropriately).
      - CALCULATION: The "estimatedPrice" MUST be "hourlyRate" * "duration.value".
      - DURATION: Choose a realistic duration (value + unit: hours/days) for this type of task.
      
      Respond strictly in JSON format:
      {
        "description": "...",
        "skills": ["...", "...", "...", "..."],
        "hourlyRate": 450,
        "estimatedPrice": 900,
        "category": "...",
        "duration": { "value": 2, "unit": "hours" }
      }
    `;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. You MUST detect the language of the user's input and respond in that EXACT SAME language for all text fields. This is mandatory.",
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
      Based on the description: "${description}", please provide the following information.
      
      STRICT LANGUAGE RULE:
      - Detect the language of the input: "${description}".
      - You MUST provide all text fields ("title", "skills") in the EXACT SAME LANGUAGE as the input.
      - DO NOT switch to any other language.

      Requirements:
      1. A professional, catchy, and SPECIFIC job title (max 60 characters).
      2. A list of 3-5 RELEVANT, specific skills for this work in Norway.
      3. A fair hourly rate in NOK (Norwegian Krone) for this work (based on realistic Norwegian market rates).
      4. A realistic estimated duration for the task (value + unit: hours/days).
      5. An estimated total price (hourlyRate * duration.value).
      
      OTHER RULES: 
      - PRICING: Base the hourlyRate on REALISTIC Norwegian market rates (consider both skilled and unskilled work appropriately).
      - CALCULATION: "estimatedPrice" MUST be exactly "hourlyRate" * "duration.value".
      
      Respond strictly in JSON format:
      {
        "title": "...",
        "skills": ["...", "...", "...", "..."],
        "hourlyRate": 450,
        "estimatedPrice": 900,
        "duration": { "value": 2, "unit": "hours" }
      }
    `;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. You MUST detect the language of the user's input and respond in that EXACT SAME language for all text fields. This is mandatory.",
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
      Based on the prompt: "${prompt}", please generate a complete job listing.
      
      STRICT LANGUAGE RULE:
      - Detect the language of the input: "${prompt}".
      - You MUST provide all text fields ("title", "description", "skills", "pricingReasoning") in the EXACT SAME LANGUAGE as the input.
      - DO NOT switch to any other language.

      Requirements:
      1. Title: A professional, catchy, and SPECIFIC job title.
      2. Description: A detailed, engaging, and SPECIFIC job description (100-200 words). Include typical tasks, expectations, and relevant details for the Norwegian market.
      3. Category: Choose the most appropriate category ONLY from: [${categoryNames}].
      4. Skills: A list of 3-5 RELEVANT, specific skills required for this job in Norway.
      5. Hourly Rate: A fair hourly rate in NOK for this service in Norway (based on realistic Norwegian market rates - e.g., 350-600 NOK/hour for skilled work).
      6. Duration: Realistic estimated time required to complete the task (value + unit: hours/days).
      7. Location Relevance: Whether the job needs to be on-site or can be done remotely (choose one: "on-site" or "remote").
      8. Price Range: A suggested total price range (min-max) based on hourlyRate * duration (consider slight variations in time).
      9. Pricing Reasoning: Clearly explain why you chose that hourly rate and duration, referencing Norwegian market context (in the same language as the prompt).
      
      OTHER RULES: 
      - PERSPECTIVE: The user is the HIRER. Write from the perspective of "I need help with..." or "I am looking for someone to...". 
      - DO NOT write as if you are offering a service.
      - PRICING: Base the hourlyRate on REALISTIC Norwegian market rates (consider both skilled and unskilled work appropriately).
      
      Respond strictly in JSON format:
      {
        "title": "...",
        "description": "...",
        "category": "...",
        "skills": ["...", "...", "...", "..."],
        "hourlyRate": 450,
        "duration": { "value": 2, "unit": "hours" },
        "locationRelevance": "on-site",
        "priceRange": { "min": 800, "max": 1000 },
        "pricingReasoning": "..."
      }
    `;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. You MUST detect the language of the user's input and respond in that EXACT SAME language for all text fields. This is mandatory.",
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
