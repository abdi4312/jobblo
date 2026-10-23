jest.mock('../models/User', () => ({
  countDocuments: jest.fn(async () => 0),
  aggregate: jest.fn(async () => []),
  find: jest.fn(),
}));
jest.mock('../models/Service', () => ({
  countDocuments: jest.fn(async () => 0),
  find: jest.fn(),
}));
jest.mock('../models/Order', () => ({
  countDocuments: jest.fn(async () => 0),
  aggregate: jest.fn(async () => []),
  find: jest.fn(),
}));
jest.mock('../models/Transaction', () => ({ aggregate: jest.fn(async () => []) }));
jest.mock('../models/Review', () => ({ countDocuments: jest.fn(async () => 0) }));
jest.mock('../models/Notification', () => ({}));
jest.mock('../models/AdminActivity', () => ({ find: jest.fn() }));
jest.mock('../models/SubscriptionV2', () => ({ countDocuments: jest.fn(async () => 3) }));

const SubscriptionV2 = require('../models/SubscriptionV2');
const { getOverview } = require('../controllers/admin/dashboardController');

function emptyQuery() {
  return {
    sort() { return this; },
    limit() { return this; },
    populate() { return this; },
    select() { return this; },
    lean: async () => [],
  };
}

test('admin overview reports active subscriptions from V2 records only', async () => {
  require('../models/User').find.mockReturnValue(emptyQuery());
  require('../models/Service').find.mockReturnValue(emptyQuery());
  require('../models/Order').find.mockReturnValue(emptyQuery());
  require('../models/AdminActivity').find.mockReturnValue(emptyQuery());
  const res = {
    status: jest.fn(function status() { return this; }),
    json: jest.fn(),
  };

  await getOverview({}, res);

  expect(SubscriptionV2.countDocuments).toHaveBeenCalledWith({ status: 'active' });
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        stats: expect.objectContaining({
          activeSubscriptions: { value: 3 },
        }),
      }),
    })
  );
});
