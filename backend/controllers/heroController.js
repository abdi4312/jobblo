const Hero = require("../models/Hero");
// const {uploadBufferToAzure,deleteFromAzureByUrl,} = require("../utils/azureUpload");

exports.CreateHero = async (req, res) => {
try {
    const {
      title,
      subtitle,
      subtitleSecondary,
      description,
      image, // Abhi ke liye hum assume kar rahe hain ke URL direct body mein aa raha hai
      activeFrom,
      expireAt,
    } = req.body;

    // 1. Validation
    if (!title) {
      return res.status(400).json({ error: "Title er påkrevd" });
    }

    if (!image) {
      return res.status(400).json({ error: "Bilde-URL er påkrevd" });
    }

    if (!activeFrom || !expireAt) {
      return res.status(400).json({ error: "activeFrom og expireAt er påkrevd" });
    }

    // if (!req.file) {
    //   return res
    //     .status(400)
    //     .json({ error: 'Ingen fil mottatt (bruk field "image")' });
    // }

    // if (!req.file.mimetype.startsWith("image/")) {
    //   return res.status(400).json({ error: "Kun bildefiler er tillatt" });
    // }

    // const imageUrl = await uploadBufferToAzure(req.file, "hero");

    // console.log(imageUrl);
// 2. Dates parsing
    const startDate = new Date(activeFrom);
    const endDate = new Date(expireAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Ugyldig datoformat" });
    }

    // 3. Auto-active logic
    const now = new Date();
    // isActive tab true hoga agar 'now' in dates ke darmiyan hai
    const isActive = now >= startDate && now <= endDate;

    // 4. Database Entry
    const hero = await Hero.create({
      title,
      subtitle,
      subtitleSecondary,
      description,
      image, // Direct URL string
      activeFrom: startDate,
      expireAt: endDate,
      isActive,
    });

    res.status(201).json(hero);
  } catch (err) {
    console.error("Create hero error:", err);
    res.status(500).json({ error: "Kunne ikke opprette hero" });
  }
};

/**
 * GET HERO
 */
exports.GetHero = async (req, res) => {
  try {
    const now = new Date();
    const heroes = await Hero.find({
      activeFrom: { $lte: now },
      expireAt: { $gte: now },
    }).sort({ createdAt: -1 });

    res.status(200).json(heroes);
  } catch (err) {
    console.error("Get active heroes error:", err);
    res.status(500).json({ error: "Kunne ikke hente hero data" });
  }
};

/**
 * UPDATE HERO
 * optional image
 */
/**
 * UPDATE HERO
 */
