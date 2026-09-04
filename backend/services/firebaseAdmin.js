const { applicationDefault, getApps, initializeApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

let warnedMissingCredentials = false;

function getFirebaseMessaging() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_CONFIG) {
    if (!warnedMissingCredentials) {
      console.error(
        'Firebase Admin credentials are missing: set GOOGLE_APPLICATION_CREDENTIALS or configure ADC.'
      );
      warnedMissingCredentials = true;
    }
  }

  const app =
    getApps()[0] ||
    initializeApp({
      credential: applicationDefault(),
      ...(process.env.FIREBASE_PROJECT_ID ? { projectId: process.env.FIREBASE_PROJECT_ID } : {}),
    });
  return getMessaging(app);
}

module.exports = { getFirebaseMessaging };
