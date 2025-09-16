const Job = require('../models/Job');
const mongoose = require('mongoose'); 

exports.getAllJobs = async (req, res) => {
    try {
        const jobs = await Job.find().populate('userId', 'name');
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getJobById = async (req, res) => {
    try {
        const job = await Job.findById(req.params.id).populate('userId', 'name');
        if (!job) return res.status(404).json({ error: 'Job not found' });
        res.json(job);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createJob = async (req, res) => {
    try {
        const { userId, ...jobData } = req.body;
        
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }

        // Check if user exists
        const User = require('../models/User');
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const job = await Job.create({ ...jobData, userId });
        res.status(201).json(job);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateJob = async (req, res) => {
    try {
        const jobId = req.params.id;
        
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID format' });
        }

        // Check if job exists
        const existingJob = await Job.findById(jobId);
        if (!existingJob) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // If userId is being updated, validate it
        if (req.body.userId) {
            if (!mongoose.Types.ObjectId.isValid(req.body.userId)) {
                return res.status(400).json({ error: 'Invalid user ID format' });
            }
            
            const User = require('../models/User');
            const user = await User.findById(req.body.userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
        }

        const job = await Job.findByIdAndUpdate(jobId, { $set: req.body }, { new: true });
        res.json(job);
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }
        if (err.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid data format' });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteJob = async (req, res) => {
    try {
        const job = await Job.findByIdAndDelete(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        res.json({ message: 'Job deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};
