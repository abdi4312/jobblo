const authController = require('../controllers/authController');

describe('terms acceptance validation', () => {
  it('rejects registration unless the user accepts the current terms', () => {
    const result = authController.validateRegisterInput({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'Password1',
      role: 'user',
      acceptedTerms: false,
      termsVersion: '2026-01-08',
    });

    expect(result).toMatch(/godta|brukervilkårene/i);
  });

  it('accepts the current terms version when the checkbox is checked', () => {
    const result = authController.validateRegisterInput({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'Password1',
      role: 'user',
      acceptedTerms: true,
      termsVersion: '2026-01-08',
    });

    expect(result).toBeNull();
  });

  it.each([undefined, false, 'true', 1, 'yes'])('rejects non-boolean true value %p', (acceptedTerms) => {
    const result = authController.validateRegisterInput({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'Password1',
      role: 'user',
      acceptedTerms,
    });

    expect(result).toMatch(/godta|brukervilkårene/i);
  });
});
