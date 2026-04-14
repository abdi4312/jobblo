const { OpenAI } = require("openai");

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

    const prompt = `
      You are a professional job assistant. Based on the job title "${title}" ${category ? `in the category "${category}"` : ""}, 
      please provide:
      1. A professional and engaging job description (around 100-150 words).
      2. An estimated price range in NOK (Norwegian Krone) for this service.
      
      CRITICAL: Detect the language used in the title and respond in that same language (e.g., if the title is in Norwegian, the description must be in Norwegian. If in English, respond in English).
      
      Respond strictly in JSON format with the following keys:
      {
        "description": "...",
        "estimatedPrice": 500
      }
      
      Note: estimatedPrice should be a single number representing a fair starting price.
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
      You are a professional job assistant. Based on the user's brief description: "${description}", 
      please provide:
      1. A professional and catchy job title (max 60 characters).
      2. An estimated price in NOK (Norwegian Krone) for this service.
      
      CRITICAL: Detect the language used in the description and respond in that same language (e.g., if the description is in Norwegian, the title must be in Norwegian. If in English, respond in English).
      
      Respond strictly in JSON format with the following keys:
      {
        "title": "...",
        "estimatedPrice": 500
      }
      
      Note: estimatedPrice should be a single number representing a fair starting price.
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
