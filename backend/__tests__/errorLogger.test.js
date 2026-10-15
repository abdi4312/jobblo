const AdminActivity = require('../models/AdminActivity');
const ErrorLog = require('../models/ErrorLog');
const { logApplicationError } = require('../utils/errorLogger');

afterEach(() => {
  jest.restoreAllMocks();
});

describe('application error logging', () => {
  it('maps unknown integration error codes to a valid AdminActivity action', async () => {
    const adminActivityCreate = jest.spyOn(AdminActivity, 'create').mockResolvedValue({});
    const errorLogCreate = jest.spyOn(ErrorLog, 'create').mockResolvedValue({});

    await logApplicationError({
      error: new Error('Subscription update could not be reconciled: subscription_not_found'),
      requestPath: '/api/stripe/webhook',
      httpMethod: 'POST',
      httpStatus: 500,
      ip: '127.0.0.1',
      userAgent: 'test',
      errorCode: 'STRIPE_WEBHOOK_HANDLER_FAILED',
      source: 'stripe_webhook',
    });

    expect(AdminActivity.schema.path('action').enumValues).toContain(
      adminActivityCreate.mock.calls[0][0].action
    );
    expect(adminActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', action: 'error_integration' })
    );
    expect(errorLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'STRIPE_WEBHOOK_HANDLER_FAILED' })
    );
  });
});
