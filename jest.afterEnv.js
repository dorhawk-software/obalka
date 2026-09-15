/* eslint-env jest, node */
// Fails the test that rendered a Text iOS would clip (see jest.setup.js and
// `__tests__/helpers/textAudit.tsx`). A hook rather than a throw inside render: a throw there would
// land in whatever error boundary the screen has, and the test could pass without its text.
afterEach(() => {
  const found = [...(global.__iosTextClipping ?? [])];
  global.__iosTextClipping?.clear();
  if (found.length > 0) {
    throw new Error(
      'A Text in this test is clipped on iOS (model: src/theme/inkClipping.ts):\n  ' +
        found.join('\n  '),
    );
  }
});
