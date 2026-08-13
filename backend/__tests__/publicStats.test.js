const request = require('supertest');
const express = require('express');
const publicStatsRouter = require('../routes/publicStats');
const User = require('../models/User');
const Service = require('../models/Service');

describe('GET /api/public/stats', () => {
  let app;

  beforeAll(() => {
    jest.spyOn(User, 'countDocuments').mockResolvedValue(52);
    jest.spyOn(Service, 'countDocuments').mockResolvedValue(6);
    app = express();
    app.use('/api/public', publicStatsRouter);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('returns public counts', async () => {
    const res = await request(app).get('/api/public/stats');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('users', 52);
    expect(res.body).toHaveProperty('jobs', 6);
  });
});
