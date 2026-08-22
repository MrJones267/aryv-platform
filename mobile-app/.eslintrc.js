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
  },
};
