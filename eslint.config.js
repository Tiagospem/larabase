import js from '@eslint/js';
import globals from 'globals';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import vue from 'eslint-plugin-vue';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
	{
		ignores: [
			'dist/**',
			'dist-electron/**',
			'dist-electron/main/**',
			'dist-electron/preload/**',
			'node_modules/**',
			'.vscode/**',
			'.idea/**',
			'coverage/**',
			'build/**',
			'*.min.js',
			'release/**',
			'src/components/**/*.vue',
			'src/views/**/*.vue',
			'src/App.vue'
			// '*.vue', // Uncomment to lint .vue files after fixing template parsing
		]
	},

	js.configs.recommended,

	// Plugin to remove unused imports/vars in JS files
	{
		plugins: {
			'unused-imports': unusedImports
		},
		rules: {
			// disable core rule to allow plugin to handle it
			'no-unused-vars': 'off',
			'no-throw-literal': 'off',
			'unused-imports/no-unused-imports': 'error',
			'unused-imports/no-unused-vars': [
				'warn',
				{
					vars: 'all',
					varsIgnorePattern: '^_',
					args: 'after-used',
					argsIgnorePattern: '^_'
				}
			]
		}
	},

	{
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.node,
				...globals.browser,
				console: true,
				setTimeout: true,
				clearTimeout: true,
				setInterval: true,
				clearInterval: true,
				process: true,
				global: true,
				setImmediate: true,
				window: true,
				document: true,
				require: true,
				Buffer: true,
				AbortController: true,
				AbortSignal: true,
				performance: true
			}
		}
	},

	{
		files: ['**/*.vue'],
		plugins: { vue },
		languageOptions: {
			parser: vue.configs['vue3-recommended'].parser,
			parserOptions: {
				parser: typescriptParser,
				ecmaVersion: 'latest',
				sourceType: 'module',
				extraFileExtensions: ['.vue'],
				ecmaFeatures: { jsx: true }
			}
		},
		processor: vue.processors['.vue'],
		rules: {
			...vue.configs['vue3-recommended'].rules,
			'vue/multi-word-component-names': 'off',
			'vue/require-default-prop': 'off',
			'vue/no-v-html': 'off',
			'vue/attributes-order': 'off',
			'vue/no-lone-template': 'off',
			'vue/this-in-template': 'off'
		}
	},

	{
		files: ['**/*.ts', '**/*.tsx'],
		plugins: {
			'@typescript-eslint': typescript,
			'unused-imports': unusedImports
		},
		languageOptions: {
			parser: typescriptParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				ecmaFeatures: { jsx: true }
			}
		},
		rules: {
			...typescript.configs.recommended.rules,
			'@typescript-eslint/no-explicit-any': 'warn',
			// disable core and TS unused-vars rules
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'unused-imports/no-unused-imports': 'error',
			'unused-imports/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			],
			'no-undef': 'off',
			'@typescript-eslint/no-unsafe-function-type': 'off',
			'@typescript-eslint/no-empty-object-type': 'off',
			'@typescript-eslint/no-unused-expressions': 'off'
		}
	},

	{
		files: ['electron/**/*.ts', 'dist-electron/**/*.{js,mjs}'],
		rules: {
			'no-console': 'off',
			'no-undef': 'off'
		}
	},

	{
		rules: {
			'no-console':
				process.env.NODE_ENV === 'production' ? 'warn' : 'off',
			'no-debugger':
				process.env.NODE_ENV === 'production' ? 'warn' : 'off',
			'no-empty': 'warn',
			'no-case-declarations': 'off',
			'no-cond-assign': 'warn',
			'no-useless-escape': 'warn',
			// remove no-unused-vars to avoid duplicate warnings
			// 'no-unused-vars': 'warn',
			'no-prototype-builtins': 'warn',
			'no-control-regex': 'off',
			'no-redeclare': 'warn',
			'no-fallthrough': 'warn',
			'no-misleading-character-class': 'warn',
			'no-unreachable': 'warn'
		}
	}
];
