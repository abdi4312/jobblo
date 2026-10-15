jest.mock('../models/GlobalConfig', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../services/admin/activityService', () => ({ logActivity: jest.fn() }));

const GlobalConfig = require('../models/GlobalConfig');
const { logActivity } = require('../services/admin/activityService');
const { updateConfig } = require('../controllers/admin/contentAdminController');

beforeEach(() => jest.clearAllMocks());

function response() {
  return {
    status: jest.fn(function () { return this; }),
    json: jest.fn(function (body) { this.body = body; return this; }),
  };
}

it.each([2, 3, 4])('accepts and audits an administrator setting of %i days', async (days) => {
  GlobalConfig.findOne.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({ value: 3 }),
    }),
  });
  GlobalConfig.findOneAndUpdate.mockReturnValue({
    lean: jest.fn().mockResolvedValue({ _id: 'config_1', key: 'SAFEPAY_CONNECT_ONBOARDING_DEADLINE_DAYS', value: days }),
  });
  const res = response();

  await updateConfig(
    {
      body: {
        key: 'SAFEPAY_CONNECT_ONBOARDING_DEADLINE_DAYS',
        value: days,
      },
      user: { _id: 'admin_1' },
      ip: '127.0.0.1',
      headers: {},
    },
    res
  );

  expect(res.status).toHaveBeenCalledWith(200);
  expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
    action: 'settings_updated',
    metadata: {
      key: 'SAFEPAY_CONNECT_ONBOARDING_DEADLINE_DAYS',
      previousValue: 3,
      newValue: days,
    },
  }));
});

it.each([0, 31, 2.5, '3'])('rejects invalid Connect deadline %p', async (value) => {
  const res = response();
  await updateConfig(
    {
      body: { key: 'SAFEPAY_CONNECT_ONBOARDING_DEADLINE_DAYS', value },
      user: { _id: 'admin_1' },
      ip: '127.0.0.1',
      headers: {},
    },
    res
  );

  expect(res.status).toHaveBeenCalledWith(400);
  expect(GlobalConfig.findOneAndUpdate).not.toHaveBeenCalled();
  expect(logActivity).not.toHaveBeenCalled();
});
