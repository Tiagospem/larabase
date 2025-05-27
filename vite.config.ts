import fs from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron/simple';
import pkg from './package.json';
import path from 'path';

const nativeNodeModules = [
	'ssh2',
	'ssh2-streams',
	'bcrypt',
	'ioredis',
	'mysql2',
	'dockerode'
];

export default defineConfig(({ command }) => {
	fs.rmSync('dist-electron', { recursive: true, force: true });

	const isServe = command === 'serve';
	const isBuild = command === 'build';
	const sourcemap = isServe || !!process.env.VSCODE_DEBUG;

	return {
		plugins: [
			vue(),
			electron({
				main: {
					entry: 'electron/main/index.ts',
					onstart({ startup }) {
						startup();
					},
					vite: {
						build: {
							sourcemap,
							minify: isBuild,
							outDir: 'dist-electron/main',
							rollupOptions: {
								external: [
									...Object.keys(
										'dependencies' in pkg
											? pkg.dependencies
											: {}
									),
									...nativeNodeModules,
									/^node:.*/
								]
							}
						},
						optimizeDeps: {
							exclude: nativeNodeModules
						}
					}
				},
				preload: {
					input: 'electron/preload/index.ts',
					vite: {
						build: {
							sourcemap: sourcemap ? 'inline' : undefined, // #332
							minify: isBuild,
							outDir: 'dist-electron/preload',
							rollupOptions: {
								external: [
									...Object.keys(
										'dependencies' in pkg
											? pkg.dependencies
											: {}
									),
									...nativeNodeModules,
									/^node:.*/
								]
							}
						},
						optimizeDeps: {
							exclude: nativeNodeModules
						}
					}
				},
				renderer: {}
			})
		],
		server:
			process.env.VSCODE_DEBUG &&
			(() => {
				const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL);
				return {
					host: url.hostname,
					port: +url.port
				};
			})(),
		clearScreen: false,
		resolve: {
			alias: {
				'@': path.resolve(__dirname, 'src'),
				'@/store': path.resolve(__dirname, 'src/store'),
				'@/types': path.resolve(__dirname, 'src/types')
			}
		},
		build: {
			rollupOptions: {
				external: [...nativeNodeModules, /^node:.*/]
			}
		},
		optimizeDeps: {
			exclude: nativeNodeModules,
			include: ['monaco-editor']
		},
		define: {
			'process.env.NODE_ENV': JSON.stringify(
				process.env.NODE_ENV || 'development'
			)
		}
	};
});
