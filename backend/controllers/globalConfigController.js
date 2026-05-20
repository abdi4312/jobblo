const GlobalConfig = require("../models/GlobalConfig");

exports.getConfigs = async (req, res) => {
  try {
    const configs = await GlobalConfig.find();
    res.status(200).json(configs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching configs" });
  }
};

exports.getConfigByKey = async (req, res) => {
  try {
    const config = await GlobalConfig.findOne({ key: req.params.key });
    if (!config) {
      return res.status(404).json({ message: "Config not found" });
    }
    res.status(200).json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching config" });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { key, value } = req.body;
    const config = await GlobalConfig.findOneAndUpdate(
      { key },
      { value },
      { new: true, upsert: true }
    );
    res.status(200).json({ message: "Config updated successfully", config });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error updating config" });
  }
};

exports.initializeConfigs = async (req, res) => {
  try {
    const defaultConfigs = [
      {
        key: "FREE_PRIVATE_JOBS_UNDER_10000",
        value: true,
        description: "Private users get free contact for jobs under 10,000 NOK",
      },
      {
        key: "ADS_FOR_NON_SUBSCRIBERS",
        value: true,
        description: "Enable ads for non-subscribers",
      },
    ];

    for (const config of defaultConfigs) {
      await GlobalConfig.findOneAndUpdate(
        { key: config.key },
        { $setOnInsert: config },
        { upsert: true }
      );
    }

    res.status(200).json({ message: "Configs initialized successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error initializing configs" });
  }
};
