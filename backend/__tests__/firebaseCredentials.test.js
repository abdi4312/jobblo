/**
 * Firebase service-account keys must never reach a Docker image, Git, or CI artifacts,
 * and the Admin SDK must keep working from a runtime credential file.
 *
 * The backend Dockerfile did `COPY . .` and .dockerignore did not exclude the
 * `*firebase-adminsdk*.json` key that lives (git-ignored) in backend/, so any locally
 * built image carried the private key in a layer.
 *
 * Only fake credentials are used. The private-key marker is assembled at runtime
 * because the Dockerfile guard greps the whole build context — including this file.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const BACKEND = path.join(__dirname, '..');
const REPO = path.join(BACKEND, '..');
const KEY_MARKER = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');

/** .dockerignore pattern -> RegExp, for the subset of syntax these files use. */
function dockerIgnoreMatcher(file) {
  const patterns = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  // Exceptions (!pattern) would need real precedence handling; keep the files simple.
  expect(patterns.some((p) => p.startsWith('!'))).toBe(false);
  const regexes = patterns.map((p) => {
    const body = p
      .replace(/^\/+/, '')
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '\u0000')
      .replace(/\*\*/g, '\u0001')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/\u0000/g, '(?:.*/)?')
      .replace(/\u0001/g, '.*');
    // A matching directory excludes everything beneath it.
    return new RegExp(`^${body}(?:/.*)?$`);
  });
  return (relPath) => regexes.some((r) => r.test(relPath));
}

const backendIgnored = dockerIgnoreMatcher(path.join(BACKEND, '.dockerignore'));
const rootIgnored = dockerIgnoreMatcher(path.join(REPO, '.dockerignore'));

const KEY_PATHS = [
  'jobblo-23453-firebase-adminsdk-fbsvc-0000000000.json',
  'config/other-firebase-adminsdk-abc.json',
  'firebase-service-account.json',
  'secrets/google-service-account.json',
  'certs/key.pem',
  'certs/key.p12',
];
const NEEDED_PATHS = ['package.json', 'package-lock.json', 'server.js', 'config/passport.js', 'Dockerfile'];

describe('Docker build context excludes credentials', () => {
  it.each(KEY_PATHS)('backend/.dockerignore excludes %s', (p) => {
    expect(backendIgnored(p)).toBe(true);
  });

  it.each(KEY_PATHS)('root .dockerignore excludes backend/%s', (p) => {
    expect(rootIgnored(`backend/${p}`)).toBe(true);
  });

  it.each(NEEDED_PATHS)('still sends %s to the build', (p) => {
    expect(backendIgnored(p)).toBe(false);
  });

  it('every key-bearing file on disk under backend/ is excluded', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        const rel = path.relative(BACKEND, abs).split(path.sep).join('/');
        if (backendIgnored(rel)) continue;
        if (entry.isDirectory()) {
          if (entry.name !== '.git') walk(abs);
          continue;
        }
        if (fs.statSync(abs).size > 2 * 1024 * 1024) continue;
        if (/adminsdk|service-account/i.test(entry.name) || fs.readFileSync(abs, 'latin1').includes(KEY_MARKER)) {
          offenders.push(rel);
        }
      }
    };
    walk(BACKEND);
    expect(offenders).toEqual([]);
  });
});

describe('Dockerfile', () => {
  const dockerfile = fs.readFileSync(path.join(BACKEND, 'Dockerfile'), 'utf8');

  it('declares no secrets through ENV or ARG and copies no credential file', () => {
    const instructions = dockerfile.replace(/^\s*#.*$/gm, '');
    expect(instructions).not.toMatch(/^\s*(ENV|ARG)\s+\S*(KEY|SECRET|CREDENTIAL|PASSWORD|TOKEN)/im);
    expect(instructions).not.toMatch(/adminsdk|service-account|GOOGLE_APPLICATION_CREDENTIALS=/i);
  });

  // Run the Dockerfile's own guard command against fake build contexts.
  const guard = dockerfile.match(/RUN (if grep[\s\S]*?fi)\s*$/m)[1].replace(/\\\r?\n/g, ' ');
  const runGuard = (files) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-'));
    try {
      for (const [name, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        fs.writeFileSync(path.join(dir, name), content);
      }
      return spawnSync('sh', ['-c', guard], { cwd: dir, encoding: 'utf8' }).status;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };

  it('fails the build when a private key is in the context', () => {
    expect(runGuard({ 'package.json': '{}', 'leaked.json': `{"private_key":"${KEY_MARKER}\\nfake"}` })).toBe(1);
  });

  it('passes for a clean context, including the Dockerfile itself and node_modules fixtures', () => {
    expect(
      runGuard({
        'package.json': '{}',
        Dockerfile: dockerfile,
        'node_modules/some-lib/test/key.pem': `${KEY_MARKER}\nfake`,
      })
    ).toBe(0);
  });
});

describe('Git and CI', () => {
  const git = (...args) => spawnSync('git', args, { cwd: REPO, encoding: 'utf8' });

  it('no credential file or private key is tracked', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' });
    expect(tracked.split('\n').filter((f) => /adminsdk|service-account|\.pem$|\.p12$/i.test(f))).toEqual([]);
    const grep = git('grep', '-lI', '-e', KEY_MARKER);
    expect(grep.stdout.trim()).toBe('');
  });

  it('Git ignores Firebase service-account files anywhere in the repo', () => {
    expect(git('check-ignore', '-q', 'backend/x-firebase-adminsdk-y.json').status).toBe(0);
  });

  it('CI builds no Docker image and uploads no backend artifacts', () => {
    const workflows = path.join(REPO, '.github', 'workflows');
    for (const f of fs.readdirSync(workflows)) {
      const yml = fs.readFileSync(path.join(workflows, f), 'utf8');
      expect(yml).not.toMatch(/docker\s+(build|push)|docker\/build-push-action|upload-artifact/i);
    }
  });
});

describe('Firebase Admin runtime credentials', () => {
  const ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ENV };
    jest.resetModules();
  });

  it('initialises from a service-account file named by GOOGLE_APPLICATION_CREDENTIALS', async () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-'));
    const file = path.join(dir, 'fake-sa.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        type: 'service_account',
        project_id: 'fake-project',
        private_key_id: 'fake',
        private_key: privateKey,
        client_email: 'fake@fake-project.iam.gserviceaccount.com',
        client_id: '1',
      })
    );
    process.env.GOOGLE_APPLICATION_CREDENTIALS = file;
    process.env.FIREBASE_PROJECT_ID = 'fake-project';
    const { getApps, deleteApp } = require('firebase-admin/app');
    const { getFirebaseMessaging } = require('../services/firebaseAdmin');
    try {
      const messaging = getFirebaseMessaging();
      expect(typeof messaging.sendEachForMulticast).toBe('function');
      expect(getApps()[0].options.projectId).toBe('fake-project');
      expect(getFirebaseMessaging()).toBe(messaging); // one app, reused
    } finally {
      await Promise.all(getApps().map(deleteApp));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('missing credentials are reported and push delivery fails safely', async () => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.FIREBASE_CONFIG;
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.doMock('firebase-admin/messaging', () => ({
      getMessaging: () => ({
        sendEachForMulticast: jest.fn().mockRejectedValue(new Error('Could not load the default credentials')),
      }),
    }));
    const PushToken = require('../models/PushToken');
    PushToken.find.mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve([{ token: 't1' }]) }),
    });
    const { deliverPush } = require('../services/pushNotifications');

    // The whole FCM call failed: deliverPush throws so the push queue retries it.
    await expect(deliverPush('u1', { title: 'Hei', body: 'x' })).rejects.toThrow(/credentials/);
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/credentials are missing/));
    expect(error).toHaveBeenCalledWith('FCM push delivery failed:', expect.any(String));
    const { getApps, deleteApp } = require('firebase-admin/app');
    await Promise.all(getApps().map(deleteApp));
  });

  it('push delivery is unchanged: sends to active tokens and deactivates dead ones', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/run/secrets/firebase.json';
    const send = jest.fn().mockResolvedValue({
      failureCount: 1,
      successCount: 1,
      responses: [{}, { error: { code: 'messaging/registration-token-not-registered' } }],
    });
    jest.doMock('firebase-admin/app', () => ({
      applicationDefault: jest.fn(() => ({})),
      getApps: () => [],
      initializeApp: jest.fn(() => ({})),
    }));
    jest.doMock('firebase-admin/messaging', () => ({ getMessaging: () => ({ sendEachForMulticast: send }) }));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const PushToken = require('../models/PushToken');
    PushToken.find.mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve([{ token: 'ok' }, { token: 'dead' }]) }),
    });
    const { deliverPush } = require('../services/pushNotifications');

    await deliverPush('u1', { title: 'Ny melding', body: 'Hei', data: { chatId: 7 } });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['ok', 'dead'],
        notification: { title: 'Ny melding', body: 'Hei' },
        data: { chatId: '7' },
      })
    );
    expect(PushToken.updateMany).toHaveBeenCalledWith(
      { token: { $in: ['dead'] } },
      { $set: { active: false } }
    );
  });

  it('sendPushToUser queues the push instead of sending inline (in-process without Redis)', async () => {
    jest.doMock('../services/queue', () => ({ enqueue: jest.fn().mockResolvedValue({ id: null, inline: true }) }));
    const { enqueue } = require('../services/queue');
    const { sendPushToUser } = require('../services/pushNotifications');
    await expect(sendPushToUser('u1', { title: 'Hei' })).resolves.toEqual({ id: null, inline: true });
    expect(enqueue).toHaveBeenCalledWith('push', 'send', { userId: 'u1', message: { title: 'Hei' } });
  });
});
