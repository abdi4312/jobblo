const request = require('supertest');
const express = require('express');
const Service = require('../models/Service');
const Category = require('../models/Category');
const filterController = require('../controllers/filterController');
const { getSortOptionsForClient } = require('../utils/serviceSort');

/**
 * `GET /api/filter/options` is the API that tells the client what it may sort and
 * filter by. Two things went wrong here at once and this pins both:
 *
 *   1. It advertised sort values the list endpoint did not accept, so sorting did
 *      nothing (see serviceSortContract.test.js for the vocabulary itself).
 *   2. It served English display labels — "Newest first", "Price: low to high",
 *      "Buy", "Free", "Wanted" — into a Norwegian-only product. Worse, the frontend
 *      had a Norwegian fallback list that was only used when the request *failed*,
 *      so the English text won whenever the API was up.
 */
describe('GET /api/filter/options', () => {
  let app;

  beforeAll(() => {
    jest.spyOn(Service, 'aggregate').mockResolvedValue([]);
    jest.spyOn(Service, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(Service, 'distinct').mockResolvedValue([]);
    jest.spyOn(Category, 'find').mockReturnValue({ lean: () => Promise.resolve([]) });

    app = express();
    app.get('/api/filter/options', filterController.getFilterOptions);
  });

  afterAll(() => jest.restoreAllMocks());

  const get = () => request(app).get('/api/filter/options');

  it('serves the sort options from the shared contract', async () => {
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.filters.sortOptions).toEqual(getSortOptionsForClient());
  });

  it('advertises only values the list endpoint accepts', async () => {
    const { resolveSort } = require('../utils/serviceSort');
    const res = await get();

    for (const option of res.body.filters.sortOptions) {
      expect(resolveSort(option.value).matched).toBe(true);
    }
  });

  it('has no English sort labels left', async () => {
    const res = await get();
    const labels = res.body.filters.sortOptions.map((o) => o.label);

    expect(labels).not.toContain('Newest first');
    expect(labels).not.toContain('Price: low to high');
    expect(labels).not.toContain('Price: high to low');
    expect(labels).not.toContain('Most relevant');
    expect(labels).toEqual([
      'Nyeste først',
      'Pris – lavest først',
      'Pris – høyest først',
      'Mest relevant',
    ]);
  });

  it('has no English type labels left', async () => {
    const res = await get();
    const labels = res.body.filters.types.map((t) => t.label);

    expect(labels).not.toContain('Buy');
    expect(labels).not.toContain('Free');
    expect(labels).not.toContain('Wanted');
    expect(labels).toEqual(['Kjøp', 'Gratis', 'Ønskes kjøpt']);
  });

  it('keeps the machine-readable values stable and language-independent', async () => {
    const res = await get();

    // Renaming a label must never change the API key — that is what makes it safe to
    // translate this endpoint later without breaking every saved filter and bookmark.
    expect(res.body.filters.sortOptions.map((o) => o.value)).toEqual([
      'newest',
      'price_low',
      'price_high',
      'relevant',
    ]);
    expect(res.body.filters.types.map((t) => t.value)).toEqual(['sale', 'free', 'wanted']);
  });
});
