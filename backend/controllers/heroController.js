const Hero = require("../models/Hero");
// const {uploadBufferToAzure,deleteFromAzureByUrl,} = require("../utils/azureUpload");

exports.CreateHero = async (req, res) => {
  try {
    const { title, subtitle, description,image, activeFrom, expireAt } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title er påkrevd" });
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

       if (!activeFrom || !expireAt) {
      return res
        .status(400)
        .json({ error: "activeFrom og expireAt er påkrevd" });
    }
// ✅ auto active logic
    const now = new Date();
    const isActive = now >= new Date(activeFrom) && now <= new Date(expireAt);
    const hero = await Hero.create({
      title,
      subtitle,
      description,
      image,
      activeFrom,
      expireAt,
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
      expireAt: { $gte: now }
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
exports.UpdateHero = async (req, res) => {
  try {
    const hero = await Hero.findById(req.params.id);
    if (!hero) {
      return res.status(404).json({ error: "Hero ikke funnet" });
    }

    // update text fields
    hero.title = req.body.title ?? hero.title;
    hero.subtitle = req.body.subtitle ?? hero.subtitle;
    hero.description = req.body.description ?? hero.description;

    // update image if exists
    if (req.file) {
      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Kun bildefiler er tillatt" });
      }

      // delete old image from Azure
      await deleteFromAzureByUrl(hero.image);

      // upload new image
      hero.image = await uploadBufferToAzure(req.file, "hero");
    }

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
    const hero = await Hero.findById(req.params.id);
    if (!hero) {
      return res.status(404).json({ error: "Hero ikke funnet" });
    }

    // delete image from Azure
    await deleteFromAzureByUrl(hero.image);

    await hero.deleteOne();
    res.status(200).json({ message: "Hero slettet" });
  } catch (err) {
    console.error("Delete hero error:", err);
    res.status(500).json({ error: "Kunne ikke slette hero" });
  }
};
