const User = require('../../models/User');

/** Profile sections a provider edits: portfolio, previous projects, certifications, experience. */

// ------------------- Portfolio Management -------------------

exports.addPortfolioItem = async (req, res) => {
  try {
    const { title, description, link } = req.body;
    const userId = req.userId;

    const updates = { title, description, link };

    if (req.file) {
      updates.imageUrl = req.file.path;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $push: { portfolio: updates } },
      { new: true }
    );

    res.status(201).json(user.portfolio[user.portfolio.length - 1]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deletePortfolioItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.userId;

    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { portfolio: { _id: itemId } } },
      { new: true }
    );

    res.json({ message: 'Portfolio item deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ------------------- Previous Projects Management -------------------

exports.addPreviousProject = async (req, res) => {
  try {
    const { title, description, category, date, link } = req.body;
    const userId = req.userId;

    const projectData = { title, description, category, date, link };

    if (req.file) {
      projectData.imageUrl = req.file.path;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $push: { previousProjects: projectData } },
      { new: true }
    );

    res.status(201).json(user.previousProjects[user.previousProjects.length - 1]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deletePreviousProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.userId;

    await User.findByIdAndUpdate(userId, {
      $pull: { previousProjects: { _id: projectId } },
    });

    res.json({ message: 'Previous project deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ------------------- Certifications Management -------------------

exports.addCertification = async (req, res) => {
  try {
    const { title, issuedBy, date, description } = req.body;
    const userId = req.userId;

    const certData = { title, issuedBy, date, description };

    if (req.file) {
      certData.url = req.file.path;
      certData.publicId = req.file.filename;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $push: { certifications: certData } },
      { new: true }
    );

    res.status(201).json(user.certifications[user.certifications.length - 1]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteCertification = async (req, res) => {
  try {
    const { certId } = req.params;
    const userId = req.userId;

    const user = await User.findById(userId);
    const cert = user.certifications.id(certId);

    if (cert && cert.publicId) {
      // publicId now holds the Azure blob name.
      const { deleteFromAzure } = require('../../utils/azureUpload');
      await deleteFromAzure(cert.publicId);
    }

    await User.findByIdAndUpdate(userId, {
      $pull: { certifications: { _id: certId } },
    });

    res.json({ message: 'Certification deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ------------------- Experience Management -------------------

exports.addExperience = async (req, res) => {
  try {
    const { title, company, startDate, endDate, description } = req.body;
    const userId = req.userId;

    const expData = { title, company, startDate, endDate, description };

    const user = await User.findByIdAndUpdate(
      userId,
      { $push: { experience: expData } },
      { new: true }
    );

    res.status(201).json(user.experience[user.experience.length - 1]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteExperience = async (req, res) => {
  try {
    const { expId } = req.params;
    const userId = req.userId;

    await User.findByIdAndUpdate(userId, {
      $pull: { experience: { _id: expId } },
    });

    res.json({ message: 'Experience deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
