const Campaign = require('../models/Campaign');
const CampaignEvent = require('../models/CampaignEvent');

describe('campaign persistence indexes', () => {
  it('uniquely indexes event IDs for idempotent tracking', () => {
    expect(CampaignEvent.schema.indexes()).toContainEqual([
      { eventId: 1 },
      { background: true, unique: true },
    ]);
  });

  it('indexes campaign variant and event type for analytics aggregation', () => {
    expect(CampaignEvent.schema.indexes()).toContainEqual([
      { campaignId: 1, variant: 1, eventType: 1, createdAt: -1 },
      { background: true },
    ]);
  });

  it('uniquely identifies the built-in campaign and indexes active date checks', () => {
    expect(Campaign.schema.path('slug').options.unique).toBe(true);
    expect(Campaign.schema.indexes()).toContainEqual([
      { enabled: 1, startDate: 1, endDate: 1 },
      { background: true },
    ]);
  });
});
