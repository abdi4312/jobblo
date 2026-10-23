const { spawn } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { parseBool } = require('../config/stripe');

const backendDir = path.resolve(__dirname, '..');
const isolatedPort = '5017';
const isolatedApiUrl = `http://127.0.0.1:${isolatedPort}`;

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

async function preflight() {
  dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });

  let databaseUrl;
  try {
    databaseUrl = new URL(process.env.MONGO_URI);
  } catch {
    throw new Error('MONGO_URI must identify the approved local TEST database.');
  }
  requireThat(
    databaseUrl.protocol === 'mongodb:' &&
      databaseUrl.hostname === '127.0.0.1' &&
      databaseUrl.port === '27017' &&
      databaseUrl.pathname === '/jobblo-dev',
    'Isolated TEST server only allows mongodb://127.0.0.1:27017/jobblo-dev.'
  );
  requireThat(
    /^(?:sk|rk)_test_.+/.test(process.env.STRIPE_TEST_SECRET_KEY || ''),
    'STRIPE_TEST_SECRET_KEY must contain a TEST-only Stripe key.'
  );
  requireThat(
    /^whsec_.+/.test(process.env.STRIPE_TEST_WEBHOOK_SECRET || ''),
    'STRIPE_TEST_WEBHOOK_SECRET must be configured for TEST mode.'
  );

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const config = await require('../models/GlobalConfig').findOne({
    key: 'STRIPE_TEST_MODE',
  }).lean();
  requireThat(parseBool(config?.value), 'The approved local TEST database must have STRIPE_TEST_MODE enabled.');
  await mongoose.disconnect();
}

async function main() {
  await preflight();

  const env = {
    ...process.env,
    MONGO_URI: process.env.MONGO_URI,
    PORT: isolatedPort,
    HOST: '127.0.0.1',
    ENABLE_SCHEDULER: 'false',
    NODE_ENV: 'test',
    VITE_MAIN_URL: isolatedApiUrl,
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
  };
  const server = spawn(process.execPath, ['server.js'], {
    cwd: backendDir,
    env,
    stdio: 'inherit',
  });
  console.log(
    `[isolated-test] launcher PID ${process.pid}; backend PID ${server.pid}; ` +
      `port ${isolatedPort}; database 127.0.0.1/jobblo-dev; Stripe TEST only; scheduler disabled`
  );
  const stop = () => server.kill();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  server.once('error', (error) => {
    console.error('[isolated-test] backend failed to start:', error.message);
    process.exitCode = 1;
  });
  server.once('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

main().catch(async (error) => {
  console.error('[isolated-test] preflight failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error('[isolated-test] database disconnect failed:', disconnectError.message);
  }
  process.exitCode = 1;
});
