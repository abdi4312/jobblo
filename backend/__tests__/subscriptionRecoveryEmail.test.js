jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const nodemailer = require('nodemailer');
const { sendSubscriptionRecoveryEmail } = require('../utils/emailService');

describe('subscription recovery email templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nodemailer.createTransport.mockReturnValue({ sendMail: jest.fn().mockResolvedValue({}) });
  });

  test('sends a recovery notice with an escaped recipient name, deadline, and server-owned settings URL', async () => {
    const deadline = new Date('2026-10-24T10:00:00.000Z');
    await sendSubscriptionRecoveryEmail({
      to: 'customer@example.test',
      name: '<script>alert(1)</script>',
      kind: 'payment_failed',
      gracePeriodEndsAt: deadline,
      frontendUrl: 'https://jobblo.example/base',
    });

    const sendMail = nodemailer.createTransport.mock.results[0].value.sendMail;
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'customer@example.test',
      subject: 'Betalingen for Jobblo-abonnementet mislyktes',
      text: expect.stringContaining('https://jobblo.example/profile/settings/subscriptions'),
      html: expect.stringContaining('&lt;script&gt;alert(1)&lt;/script&gt;'),
    }));
    expect(sendMail.mock.calls[0][0].html).not.toContain('<script>alert(1)</script>');
    expect(sendMail.mock.calls[0][0].text).toContain('Betalingsfrist:');
  });

  test('supports configured reminder days and rejects an unsafe return URL', async () => {
    await sendSubscriptionRecoveryEmail({
      to: 'customer@example.test',
      kind: 'reminder_day_2',
      frontendUrl: 'https://jobblo.example',
    });
    expect(nodemailer.createTransport.mock.results[0].value.sendMail).toHaveBeenCalled();

    await expect(sendSubscriptionRecoveryEmail({
      to: 'customer@example.test',
      kind: 'payment_failed',
      frontendUrl: 'javascript:alert(1)',
    })).rejects.toThrow('FRONTEND_URL must be a valid http(s) URL');
  });
});
