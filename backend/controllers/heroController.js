const Hero = require("../models/Hero");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../utils/cloudinaryUpload");

/**
 * CREATE HERO
 */
exports.CreateHero = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      buttonText,
      buttonUrl,
      footerText,
      bgColor,
      activeFrom,
      expireAt,
    } = req.body;

    // 1. Validation
    if (!title) {
      return res.status(400).json({ error: "Title er påkrevd" });
    }

    if (!activeFrom || !expireAt) {
      return res
        .status(400)
        .json({ error: "activeFrom og expireAt er påkrevd" });
    }

    let imageUrl = "";
    if (req.file) {
      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Kun bildefiler er tillatt" });
      }
      imageUrl = await uploadToCloudinary(req.file, "hero");
    } else if (req.body.image) {
      imageUrl = req.body.image; // If already a URL
    } else {
      return res.status(400).json({ error: "Bilde er påkrevd" });
    }

    // 2. Dates parsing
    const startDate = new Date(activeFrom);
    const endDate = new Date(expireAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "Ugyldig datoformat" });
    }

    // 3. Auto-active logic
    const now = new Date();
    const isActive = now >= startDate && now <= endDate;

    // 4. Database Entry
    const hero = await Hero.create({
      title,
      subtitle,
      buttonText,
      buttonUrl,
      footerText,
      bgColor,
      image: imageUrl,
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
 * GET ACTIVE HEROES (For Frontend)
 */
exports.GetHero = async (req, res) => {
  try {
    const now = new Date();
    const heroes = await Hero.find({
      activeFrom: { $lte: now },
      expireAt: { $gte: now },
      isActive: true,
    }).sort({ createdAt: -1 });

    res.status(200).json(heroes);
  } catch (err) {
    console.error("Get active heroes error:", err);
    res.status(500).json({ error: "Kunne ikke hente hero data" });
  }
};

/**
 * GET ALL HEROES (For Admin)
 */
exports.GetAllHeroes = async (req, res) => {
  try {
    const heroes = await Hero.find().sort({ createdAt: -1 });
    res.status(200).json(heroes);
  } catch (err) {
    console.error("Get all heroes error:", err);
    res.status(500).json({ error: "Kunne ikke hente hero data" });
  }
};

/**
 * UPDATE HERO
 */
exports.UpdateHero = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      subtitle,
      buttonText,
      buttonUrl,
      footerText,
      bgColor,
      activeFrom,
      expireAt,
      isActive,
    } = req.body;

    const hero = await Hero.findById(id);
    if (!hero) {
      return res.status(404).json({ error: "Hero ikke funnet" });
    }

    // Update image if new file provided
    if (req.file) {
      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Kun bildefiler er tillatt" });
      }
      // Delete old image from cloudinary
      if (hero.image && hero.image.includes("cloudinary.com")) {
        await deleteFromCloudinary(hero.image);
      }
      hero.image = await uploadToCloudinary(req.file, "hero");
    } else if (req.body.image) {
      hero.image = req.body.image;
    }

    if (title) hero.title = title;
    if (subtitle !== undefined) hero.subtitle = subtitle;
    if (buttonText !== undefined) hero.buttonText = buttonText;
    if (buttonUrl !== undefined) hero.buttonUrl = buttonUrl;
    if (footerText !== undefined) hero.footerText = footerText;
    if (bgColor !== undefined) hero.bgColor = bgColor;
    if (activeFrom) hero.activeFrom = new Date(activeFrom);
    if (expireAt) hero.expireAt = new Date(expireAt);
    if (isActive !== undefined) hero.isActive = isActive;

    await hero.save();
    res.status(200).json(hero);
  } catch (err) {
    console.error("Update hero error:", err);
    res.status(500).json({ error: "Kunne ikke oppdatere hero" });
  }
};

/**
 * DELETE HERO
 */
exports.DeleteHero = async (req, res) => {
  try {
    const { id } = req.params;
    const hero = await Hero.findById(id);
    if (!hero) {
      return res.status(404).json({ error: "Hero ikke funnet" });
    }

    // Delete image from cloudinary
    if (hero.image && hero.image.includes("cloudinary.com")) {
      await deleteFromCloudinary(hero.image);
    }

    await Hero.findByIdAndDelete(id);
    res.status(200).json({ message: "Hero slettet" });
  } catch (err) {
    console.error("Delete hero error:", err);
    res.status(500).json({ error: "Kunne ikke slette hero" });
  }
};
