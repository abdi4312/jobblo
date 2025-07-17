const Job = require('../models/Job'); // Importer Mongoose-modellen

exports.getAllJobs = async (req, res, next) => {
    try {
        const jobs = await Job.find();
        res.json(jobs);
    } catch (err) {
        next(err);
    }
};

exports.getJobById = async (req, res, next) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        res.json(job);
    } catch (err) {
        next(err);
    }
};

exports.createJob = async (req, res, next) => {
    try {
        const job = new Job(req.body);
        const saved = await job.save();
        res.status(201).json(saved);
    } catch (err) {
        next(err);
    }
};

exports.updateJob = async (req, res, next) => {
    try {
        const updated = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ error: 'Job not found' });
        res.json(updated);
    } catch (err) {
        next(err);
    }
};

exports.deleteJob = async (req, res, next) => {
    try {
        const deleted = await Job.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Job not found' });
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};
