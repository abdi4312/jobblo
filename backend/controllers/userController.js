const User = require('../models/User');
const Job = require('../models/Job');

exports.getUserById = async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');
    res.json(user);
};

exports.updateUser = async (req, res) => {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    res.json(user);
};

exports.deleteUser = async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.status(204).end();
};

exports.getUserJobs = async (req, res) => {
    const jobs = await Job.find({ user: req.params.id });
    res.json(jobs);
};
