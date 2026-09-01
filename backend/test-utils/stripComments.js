/**
 * Remove comments from source before asserting on it.
 *
 * Several regression tests in this suite work by reading a file and asserting that a
 * dangerous call is *absent* — `Subscription.create`, `iduraCallback`, an authorize
 * URL. The fix for each of those bugs came with a comment explaining what used to be
 * there, and that comment necessarily quotes the forbidden identifier. Without this
 * helper those tests fail on their own documentation, which teaches everyone to
 * delete the explanation.
 *
 * Not a parser: it does not understand comment markers inside string literals. That is
 * fine for asserting on absence, and a real parser would be a dependency for nothing.
 */
function stripComments(source) {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

module.exports = { stripComments };
