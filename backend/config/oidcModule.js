/**
 * The single bridge between this CommonJS codebase and `openid-client`, which is
 * ESM-only from v6.
 *
 * It exists as its own module for two reasons. It keeps the `await import()` in one
 * place, so if the library ever ships CommonJS again — or is swapped for another — one
 * file changes. And it gives the test suite a normal CommonJS module boundary to stand
 * in for: Jest is configured with `transform: {}`, so a native dynamic `import()`
 * inside a larger module bypasses the module registry entirely and the real library
 * gets loaded, network calls and all.
 */

let modulePromise = null;

/** The `openid-client` namespace, imported once and memoised. */
function load() {
  if (!modulePromise) {
    modulePromise = import('openid-client');
  }
  return modulePromise;
}

module.exports = { load };
