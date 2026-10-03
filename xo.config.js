/**
 * @import {FlatXoConfig} from 'xo'
 */

/** @type {FlatXoConfig} */
const xoConfig = [
  {
    name: 'default',
    prettier: 'compat',
    rules: {
      complexity: 'off',
      curly: 'off',
      'import-x/order': 'off',
      'jsdoc/check-indentation': 'off',
      'jsdoc/check-line-alignment': 'off',
      'jsdoc/require-asterisk-prefix': 'off',
      'max-lines': 'off',
      'no-shadow': 'off',
      'prefer-arrow-callback': 'off',
      'prefer-object-spread': 'off',
      'require-unicode-regexp': 'off',
      'unicorn/better-dom-traversing': 'off',
      'unicorn/consistent-boolean-name': 'off',
      'unicorn/no-array-sort': 'off',
      'unicorn/prefer-at': 'off',
      'unicorn/prefer-code-point': 'off',
      'unicorn/prefer-continue': 'off',
      'unicorn/prefer-early-return': 'off',
      'unicorn/prefer-includes-over-repeated-comparisons': 'off',
      'unicorn/prefer-simple-condition-first': 'off',
      'unicorn/prefer-ternary': 'off',
      'unicorn/require-array-sort-compare': 'off',
      'unicorn/single-line-block-comment-style': 'off'
    },
    space: true
  },
  // Wrong.
  {ignores: ['**/*.md']},
  {
    files: ['package.json'],
    rules: {
      'package-json/no-orphan-types': 'off',
      'package-json/require-engines': 'off',
      'package-json/sort-files': 'off',
      'package-json/sort-properties': 'off'
    }
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/array-type': ['error', {default: 'generic'}],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-restricted-types': 'off'
    }
  }
]

export default xoConfig
