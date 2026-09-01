/**
 * Controller-level failure handling for the job-listing AI.
 *
 * The OpenAI SDK and the Category model are both mocked, so these tests make no
 * network call and need no database. They assert only the things that must hold
 * whatever the model says: the app does not crash, the key never leaks, and a
 * failure produces a usable response rather than a 500 with a stack trace.
 */

const mockCreate = jest.fn();

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

jest.mock('../models/Category', () => ({
  find: jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue([{ name: 'Rengjøring' }, { name: 'Maling' }]),
  }),
}));

const aiController = require('../controllers/aiController');

const GOOD_OUTPUT = {
  title: 'Maling av to soverom',
  description: 'Jeg trenger hjelp til å male to soverom. Kun veggene skal males.',
  category: 'Maling',
  skills: ['Maling', 'Sparkling'],
  openQuestions: ['Hvor store er rommene?'],
  paymentType: 'Fastpris',
  hourlyRate: 420,
  suggestedPrice: 2520,
  priceMin: 2100,
  priceMax: 2900,
  duration: { value: 6, unit: 'hours' },
  locationRelevance: 'on-site',
  pricingReasoning: 'Estimat basert på timepris for maling — ikke en offisiell markedssats.',
};

function completion(content, extra = {}) {
  return {
    choices: [{ message: { content: JSON.stringify(content), ...extra } }],
    usage: { prompt_tokens: 1800, completion_tokens: 200 },
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const REQ = {
  body: {
    prompt: 'Trenger hjelp til å male to soverom, kun vegger',
    existingCategory: 'Maling',
    existingPaymentType: 'Fastpris',
    lang: 'no',
  },
};

describe('aiController failure handling', () => {
  const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    mockCreate.mockReset();
    process.env.OPENAI_API_KEY = 'sk-test-not-a-real-key';
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = ORIGINAL_KEY;
  });

  test('a well-formed response is returned with the fields the frontend reads', async () => {
    mockCreate.mockResolvedValue(completion(GOOD_OUTPUT));
    const res = mockRes();
    await aiController.generateFullJobListing(REQ, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.title).toBeTruthy();
    expect(payload.data.description).toBeTruthy();
    expect(payload.data.priceRange).toEqual({
      min: payload.data.priceMin,
      max: payload.data.priceMax,
    });
    expect(payload.data.isEstimate).toBe(true);
    expect(Array.isArray(payload.data.openQuestions)).toBe(true);
  });

  test('malformed JSON from the model does not crash and does not echo the raw text', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Sure! Here is your listing: {broken json' } }],
      usage: {},
    });
    const res = mockRes();
    await expect(aiController.generateFullJobListing(REQ, res)).resolves.not.toThrow();

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(JSON.stringify(body)).not.toMatch(/broken json/);
    expect(body.success).toBe(false);
  });

  test('an empty completion is handled as an error, not as an empty listing', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: '' } }], usage: {} });
    const res = mockRes();
    await aiController.generateFullJobListing(REQ, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('a schema refusal is surfaced as a failure rather than silently accepted', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '', refusal: 'I cannot help with that.' } }],
      usage: {},
    });
    const res = mockRes();
    await aiController.generateFullJobListing(REQ, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  test('a rate limit becomes a 429 with a user-readable message, not a generic 500', async () => {
    const err = new Error('429 Too Many Requests');
    err.status = 429;
    mockCreate.mockRejectedValue(err);
    const res = mockRes();
    await aiController.generateFullJobListing(REQ, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json.mock.calls[0][0].message).toMatch(/AI/i);
  });

  test('a timed-out upstream call becomes a 504, not an opaque 500', async () => {
    mockCreate.mockRejectedValue(new Error('socket hang up'));
    const res = mockRes();
    await expect(aiController.generateFullJobListing(REQ, res)).resolves.not.toThrow();
    expect(res.status).toHaveBeenCalledWith(504);
  });

  test('the API key is redacted in server logs too', async () => {
    process.env.OPENAI_API_KEY = 'sk-proj-SUPERSECRETVALUE';
    const err = new Error('Incorrect API key provided: sk-proj-SUPERSECRETVALUE');
    err.status = 401;
    mockCreate.mockRejectedValue(err);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await aiController.generateFullJobListing(REQ, mockRes());

    const logged = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).not.toMatch(/SUPERSECRETVALUE/);
    expect(logged).toMatch(/REDACTED/);
    spy.mockRestore();
  });

  test('no upstream error text is ever forwarded to the client', async () => {
    mockCreate.mockRejectedValue(new Error('internal routing detail leaked here'));
    const res = mockRes();
    await aiController.generateFullJobListing(REQ, res);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/internal routing detail/);
  });

  test('the API key never appears in a response body', async () => {
    process.env.OPENAI_API_KEY = 'sk-proj-SUPERSECRETVALUE';
    const err = new Error('Incorrect API key provided: sk-proj-SUPERSECRETVALUE');
    err.status = 401;
    mockCreate.mockRejectedValue(err);
    const res = mockRes();
    await aiController.generateFullJobListing(REQ, res);

    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/SUPERSECRETVALUE/);
  });

  test('a missing API key is reported instead of crashing the process', async () => {
    delete process.env.OPENAI_API_KEY;
    const res = mockRes();
    await expect(aiController.generateFullJobListing(REQ, res)).resolves.not.toThrow();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('too-short input is rejected before any model call is billed', async () => {
    const res = mockRes();
    await aiController.generateFullJobListing({ body: { prompt: 'hei' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('the language the caller asked for is forwarded to the model', async () => {
    mockCreate.mockResolvedValue(completion(GOOD_OUTPUT));
    await aiController.generateFullJobListing(
      { body: { ...REQ.body, lang: 'en' } },
      mockRes()
    );
    expect(mockCreate.mock.calls[0][0].messages[0].content).toMatch(/in English/);
  });

  test('all three endpoints share the same hardening', async () => {
    mockCreate.mockRejectedValue(new Error('boom'));
    for (const [handler, body] of [
      [aiController.generateTitle, { description: 'male stua og gangen', lang: 'no' }],
      [aiController.generateJobInfo, { title: 'Maling av stue og gang', lang: 'no' }],
      [aiController.generateFullJobListing, REQ.body],
    ]) {
      const res = mockRes();
      await expect(handler({ body }, res)).resolves.not.toThrow();
      expect(res.status).toHaveBeenCalledWith(500);
    }
  });
});
