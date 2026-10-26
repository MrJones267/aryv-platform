module.exports = {
  root: true,
  // The previous config extended only eslint:recommended with no parser, so
  // every .ts/.tsx file failed with "'import' and 'export' may appear only
  // with sourceType: module" — `npm run lint` reported errors on all 218
  // source files and never actually linted anything.
  extends: ['@react-native'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    es6: true,
    jest: true,
  },
  ignorePatterns: [
    'node_modules/',
    'android/',
    'ios/',
    'src/_problematic_files/',
    '*.config.js',
  ],
  rules: {
    'prefer-const': 'error',
    'no-var': 'error',
    'no-debugger': 'error',
    // TypeScript already catches undefined/unused identifiers with better
    // fidelity than the base rules, which misfire on type-only references.
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // Off deliberately, not by accident. Since lint had never run, enabling
    // @react-native's Prettier rule reported ~18k formatting violations across
    // every file at once. Formatting belongs in its own `prettier --write`
    // commit so it does not bury real diffs; turn this back on afterwards.
    'prettier/prettier': 'off',

    // Kept as an error. It caught a real defect: ChatList called useState
    // inside a render helper, and its scroll handler was never wired to the
    // FlatList, so the scroll-to-bottom button could never appear.
    'react-hooks/rules-of-hooks': 'error',

    // Warn, which is this rule's upstream default severity — @react-native
    // raises it to error.
    //
    // All 70 occurrences were triaged individually rather than fixed in bulk.
    // None is a stale-closure bug: 14 are mount-only loads whose functions
    // close over route params or nothing at all, and the rest already list
    // every changing value the function reads, so behaviour is correct and the
    // rule only wants the function itself in the array.
    //
    // Satisfying it means wrapping ~50 component functions in useCallback and
    // *moving* each declaration above the effect that uses it, because a
    // function in a dependency array is evaluated during render and hits the
    // temporal dead zone otherwise. That is a structural edit to 50 files with
    // no component tests covering them — real risk, no behavioural gain.
    //
    // Revisit when those screens have tests, or fix opportunistically when
    // touching a file for another reason. New code should satisfy it.
    'react-hooks/exhaustive-deps': 'warn',
  },
};
