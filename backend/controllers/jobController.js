const Job = require('../models/Job');

exports.getAllJobs = async (req, res) => {
    const jobs = await Job.find().populate('user', 'name');
    res.json(jobs);
};

exports.getJobById = async (req, res) => {
    const job = await Job.findById(req.params.id).populate('user', 'name');
    res.json(job);
};

exports.createJob = async (req, res) => {
    const job = await Job.create({ ...req.body, user: req.user.id });
    res.status(201).json(job);
};

exports.updateJob = async (req, res) => {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(job);
};

exports.deleteJob = async (req, res) => {
    await Job.findByIdAndDelete(req.params.id);
    res.status(204).end();
};
