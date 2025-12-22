module.exports = {
  env: {
    node: true,
    jest: true,
    es6: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['prettier'],
  extends: [
    'eslint:recommended',
    'prettier',
  ],
  rules: {
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'off', // Allow console for development
    'no-debugger': 'error',
    'no-duplicate-imports': 'off',
    'no-unused-expressions': 'off',
    'prefer-template': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'comma-dangle': ['error', 'always-multiline'],
    'semi': ['error', 'always'],
    'quotes': ['error', 'single', { 'avoidEscape': true }],
    'indent': 'off', // Handled by prettier
    'max-len': 'off', // Handled by prettier
    'no-trailing-spaces': 'off', // Handled by prettier
    'eol-last': 'off', // Handled by prettier
    'no-unused-vars': 'off', // Allow unused vars in development
    'no-case-declarations': 'off', // Allow declarations in case blocks
  },
};