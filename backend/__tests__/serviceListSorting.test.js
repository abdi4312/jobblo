const request = require('supertest');
const express = require('express');
const Service = require('../models/Service');
const serviceController = require('../controllers/serviceController');

/**
 * End-to-end proof that a sort value chosen in the UI reaches Mongo as a real sort.
 *
 * `serviceSortContract.test.js` pins the vocabulary in isolation. This one pins the
 * wiring: it captures what `GET /api/services` actually hands to `.sort()`. That is
 * the step that was broken — the resolver did not exist, the controller had its own
 * whitelist, and `price_low` was quietly discarded on the way through.
 */
describe('GET /api/services sorting', () => {
  let app;
  let capturedSort;

  beforeAll(() => {
    app = express();
    app.get('/api/services', serviceController.getAllServices);
  });

  beforeEach(() => {
    capturedSort = undefined;

    // Minimal stand-in for the chained query builder the controller uses.
    const chain = {
      populate: () => chain,
      skip: () => chain,
      limit: () => chain,
      sort: (value) => {
        capturedSort = value;
        return Promise.resolve([]);
      },
    };

    jest.spyOn(Service, 'find').mockReturnValue(chain);
    jest.spyOn(Service, 'countDocuments').mockResolvedValue(0);
  });

  afterEach(() => jest.restoreAllMocks());

  const sortFor = async (query) => {
    const res = await request(app).get('/api/services').query(query);
    expect(res.statusCode).toBe(200);
    return capturedSort;
  };

  it('newest → { createdAt: -1 }', async () => {
    expect(await sortFor({ sort: 'newest' })).toEqual({ createdAt: -1 });
  });

  it('price_low → cheapest first (this is the case that used to do nothing)', async () => {
    expect(await sortFor({ sort: 'price_low' })).toEqual({ price: 1, createdAt: -1 });
  });

  it('price_high → most expensive first', async () => {
    expect(await sortFor({ sort: 'price_high' })).toEqual({ price: -1, createdAt: -1 });
  });

  it('relevant → the documented default', async () => {
    expect(await sortFor({ sort: 'relevant' })).toEqual({ createdAt: -1 });
  });

  it('no sort parameter → newest', async () => {
    expect(await sortFor({})).toEqual({ createdAt: -1 });
  });

  it('an unknown value falls back instead of failing the request', async () => {
    expect(await sortFor({ sort: 'most_popular' })).toEqual({ createdAt: -1 });
  });

  it('refuses to sort on a non-whitelisted field', async () => {
    expect(await sortFor({ sort: 'contactPhone' })).toEqual({ createdAt: -1 });
    expect(await sortFor({ sort: 'password' })).toEqual({ createdAt: -1 });
  });

  it('survives an object injected through the query string', async () => {
    // `?sort[$ne]=null` arrives as an object, not a string.
    const res = await request(app).get('/api/services').query({ 'sort[$ne]': 'null' });
    expect(res.statusCode).toBe(200);
    expect(capturedSort).toEqual({ createdAt: -1 });
  });

  it('price_low and price_high are genuinely different (the regression itself)', async () => {
    const low = await sortFor({ sort: 'price_low' });
    const high = await sortFor({ sort: 'price_high' });
    expect(low).not.toEqual(high);
    expect(low.price).toBe(1);
    expect(high.price).toBe(-1);
  });

  it('legacy raw field values still work for older clients', async () => {
    expect(await sortFor({ sort: '-price' })).toEqual({ price: -1 });
    expect(await sortFor({ sort: 'views' })).toEqual({ views: 1 });
  });
});
