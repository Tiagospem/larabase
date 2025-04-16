const js = require('@eslint/js');
const globals = require('globals');
const vue = require('eslint-plugin-vue');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'public/**',
      '.git/**',
      '*.log',
      '*.lock'
    ]
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021
      }
    }
  },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  prettierConfig,
  {
    plugins: {
      prettier: prettierPlugin
    },
    files: ['**/*.js', '**/*.vue'],
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'vue/no-multiple-template-root': 'off',
      'space-before-function-paren': ['error', 'always'],
      'vue/html-self-closing': ['error', {
        html: {
          void: 'always',
          normal: 'always',
          component: 'always'
        }
      }],
      'vue/max-attributes-per-line': ['error', {
        singleline: { max: 3 },
        multiline: { max: 1 }
      }],
      'prettier/prettier': 'error'
    }
  }
]; 