module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    es2020: true,
    jest: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'eslint-config-prettier',
  ],
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'react-refresh',
    'prettier',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'off', // Allow console for development
    'no-debugger': 'error',
    'semi': 'off', // Handled by prettier
    'quotes': 'off', // Handled by prettier
    'indent': 'off', // Handled by prettier
    'max-len': 'off', // Handled by prettier
    'no-unused-vars': 'off', // Use TypeScript version
    'react/react-in-jsx-scope': 'off', // React 17+
    'react/prop-types': 'off', // Using TypeScript
    'react-refresh/only-export-components': 'warn',
    'prettier/prettier': 'error',
  },
};