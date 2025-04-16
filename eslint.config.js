import js from '@eslint/js';
import globals from 'globals';
import vue from 'eslint-plugin-vue';

export default [
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
  {
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
      }]
    }
  }
]; 