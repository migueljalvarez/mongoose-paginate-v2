'use strict';

module.exports = {
  root: true,
  parser: 'babel-eslint',
  extends: ['eslint:recommended', 'plugin:node/recommended'],
  env: {
    es6: true,
    node: true,
    mocha: true,
  },
  parserOptions: {
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'node/no-unsupported-features/es-syntax': [
      'error',
      {
        ignores: ['modules'],
      },
    ],
  },
  overrides: [
    {
      files: '**/__mocks__/*.js',
      rules: {
        'node/no-unpublished-require': 'off',
      },
    },
  ],
};
