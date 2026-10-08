jest.mock('../models/Campaign', () => ({
  findOneAndUpdate: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
  exists: jest.fn(),
}));
jest.mock('../models/CampaignEvent', () => ({ create: jest.fn(), aggregate: jest.fn() }));

const Campaign = require('../models/Campaign');
const CampaignEvent = require('../models/CampaignEvent');
const controller = require('../controllers/campaignController');

const campaign = {
  _id: '507f1f77bcf86cd799439011',
  assignmentSecret: 'test-assignment-secret',
  name: 'SafePay giveaway',
  enabled: true,
  startDate: new Date('2026-01-01T00:00:00Z'),
  endDate: new Date('2027-01-01T00:00:00Z'),
  bannerText: 'Banner content',
  bannerCtaLabel: 'Legg ut en jobb',
  bannerCtaUrl: '/Publish-job',
  popupVersionA: 'Version A',
  popupVersionB: 'Version B',
  popupCtaLabel: 'Legg ut en jobb',
  popupCtaUrl: '/Publish-job',
  popupDelayMs: 2500,
  popupCooldownMs: 86400000,
  termsLabel: 'Se vilkår',
  termsUrl: '/kampanjevilkar',
  disclaimer: 'Terms',
};

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const makeQuery = (value) => ({ select: jest.fn().mockResolvedValue(value) });

beforeEach(() => {
  jest.clearAllMocks();
  Campaign.findOneAndUpdate.mockReturnValue(makeQuery(campaign));
  Campaign.findOne.mockReturnValue(makeQuery(campaign));
  Campaign.findById.mockReturnValue(makeQuery(campaign));
});

describe('campaign controller', () => {
  it('returns backend defaults for the admin create form without internal identifiers', async () => {
    const res = response();
    await controller.getCampaignDefaults({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.defaults).toMatchObject({
      name: 'Jobblo SafePay 5 000 kr giveaway',
      enabled: false,
      bannerCtaUrl: '/Publish-job',
      popupDelayMs: 2500,
      popupCooldownMs: 86400000,
    });
    expect(res.body.data.defaults).not.toHaveProperty('slug');
  });

  it('issues a stable server-signed variant without exposing the signing secret', async () => {
    const visitorId = '2f3c51c0-31ca-4bc3-84b0-387d5f610bd4';
    const first = response();
    const second = response();
    await controller.getPublicCampaign({ query: { visitorId } }, first);
    await controller.getPublicCampaign({ query: { visitorId } }, second);

    expect(first.statusCode).toBe(200);
    expect(first.body.data.assignment.variant).toMatch(/^[AB]$/);
    expect(second.body.data.assignment.variant).toBe(first.body.data.assignment.variant);
    expect(first.body.data.assignment.token).toEqual(expect.stringContaining('.'));
    expect(first.body.data.campaign).not.toHaveProperty('assignmentSecret');
    expect(Campaign.findOneAndUpdate.mock.calls[0][1]).toHaveProperty('$setOnInsert');
  });

  it('records only the first event ID and aggregates variant CTR', async () => {
    const visitorId = '2f3c51c0-31ca-4bc3-84b0-387d5f610bd4';
    const publicResponse = response();
    await controller.getPublicCampaign({ query: { visitorId } }, publicResponse);
    const assignmentToken = publicResponse.body.data.assignment.token;
    const storedEvents = new Map();
    CampaignEvent.create.mockImplementation(async (event) => {
      if (storedEvents.has(event.eventId)) {
        const error = new Error('duplicate key');
        error.code = 11000;
        throw error;
      }
      storedEvents.set(event.eventId, event);
      return event;
    });
    CampaignEvent.aggregate.mockImplementation(async () => {
      const totals = new Map();
      for (const event of storedEvents.values()) {
        const key = `${event.variant}:${event.eventType}`;
        totals.set(key, (totals.get(key) || 0) + 1);
      }
      return [...totals].map(([key, count]) => {
        const [variant, eventType] = key.split(':');
        return { _id: { variant, eventType }, count };
      });
    });

    const eventId = 'bb6cff66-c213-4c23-8aad-9408fdf2bcf7';
    const eventRequest = (id, eventType) => ({ body: { eventId: id, eventType, assignmentToken } });
    const impression = response();
    await controller.trackEvent(eventRequest(eventId, 'impression'), impression);
    const duplicate = response();
    await controller.trackEvent(eventRequest(eventId, 'impression'), duplicate);
    const click = response();
    await controller.trackEvent(
      eventRequest('aef22f35-64f8-4bd0-8c94-52c118ce6717', 'click'),
      click
    );

    expect(impression.statusCode).toBe(201);
    expect(duplicate.body.data).toEqual({ recorded: false, duplicate: true });
    expect(storedEvents.size).toBe(2);

    const analytics = response();
    Campaign.exists.mockResolvedValue(true);
    await controller.getAnalytics({ params: { id: campaign._id } }, analytics);
    const variant =
      analytics.body.data.analytics.variants[publicResponse.body.data.assignment.variant];
    expect(variant).toMatchObject({ impressions: 1, clicks: 1, ctr: 100 });
    expect(analytics.body.data.analytics.total.ctr).toBe(100);
  });

  it('rejects client-selected variants and malformed destinations', async () => {
    const invalid = response();
    await controller.trackEvent(
      {
        body: {
          eventId: 'bb6cff66-c213-4c23-8aad-9408fdf2bcf7',
          eventType: 'impression',
          variant: 'B',
        },
      },
      invalid
    );
    expect(invalid.statusCode).toBe(400);
    expect(CampaignEvent.create).not.toHaveBeenCalled();
  });

  it('creates a draft from backend defaults and removes private fields from the response', async () => {
    const created = { ...campaign, toObject: () => ({ ...campaign }) };
    Campaign.create.mockResolvedValue(created);
    const res = response();
    await controller.createCampaign({ body: {} }, res);

    expect(res.statusCode).toBe(201);
    expect(Campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Jobblo SafePay 5 000 kr giveaway',
        enabled: false,
        bannerCtaUrl: '/Publish-job',
        popupDelayMs: 2500,
        popupCooldownMs: 86400000,
      })
    );
    expect(res.body.data.campaign).not.toHaveProperty('assignmentSecret');
  });

  it('allows an admin to enable and disable campaigns but rejects overlapping schedules', async () => {
    campaign.toObject = () => ({ ...campaign });
    campaign.save = jest.fn().mockResolvedValue(campaign);
    Campaign.findById.mockResolvedValue(campaign);
    Campaign.exists.mockResolvedValue(false);
    const enabled = response();
    await controller.updateCampaign(
      { params: { id: campaign._id }, body: { enabled: true } },
      enabled
    );
    expect(enabled.statusCode).toBe(200);
    expect(campaign.enabled).toBe(true);
    expect(campaign.save).toHaveBeenCalledTimes(1);

    const conflict = response();
    Campaign.exists.mockResolvedValue(true);
    await controller.updateCampaign(
      { params: { id: campaign._id }, body: { enabled: true } },
      conflict
    );
    expect(conflict.statusCode).toBe(409);
    expect(campaign.save).toHaveBeenCalledTimes(1);

    Campaign.exists.mockResolvedValue(false);
    const disabled = response();
    await controller.updateCampaign(
      { params: { id: campaign._id }, body: { enabled: false } },
      disabled
    );
    expect(disabled.statusCode).toBe(200);
    expect(campaign.enabled).toBe(false);
  });

  it('serves the current disclaimer without requiring an active campaign', async () => {
    const res = response();
    await controller.getTerms({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.disclaimer).toBe(campaign.disclaimer);
  });

  it('archives a campaign, disables it, and preserves its event history', async () => {
    campaign.deletedAt = null;
    campaign.enabled = true;
    campaign.save = jest.fn().mockResolvedValue(campaign);
    Campaign.findById.mockResolvedValue(campaign);
    const res = response();
    await controller.deleteCampaign({ params: { id: campaign._id } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.deleted).toBe(true);
    expect(campaign.enabled).toBe(false);
    expect(campaign.deletedAt).toBeInstanceOf(Date);
    expect(CampaignEvent.deleteMany).not.toBeDefined();
  });

  it('allows only super-admins through the campaign admin guard', () => {
    const { requireAdmin } = require('../middleware/auth');
    const denied = response();
    const next = jest.fn();
    requireAdmin({ user: { role: 'user' } }, denied, next);
    expect(denied.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();

    const allowed = response();
    requireAdmin({ user: { role: 'superAdmin' } }, allowed, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
