export default function enhancePath() {
	const platform = process.platform;
	const sep = platform === 'win32' ? ';' : ':';
	const envPath = process.env.PATH || '';

	const config = {
		darwin: {
			additional: [
				'/usr/local/bin',
				'/opt/homebrew/bin',
				'/Applications/Docker.app/Contents/Resources/bin'
			],
			defaults: [
				'/usr/local/bin',
				'/usr/bin',
				'/bin',
				'/usr/sbin',
				'/sbin',
				'/opt/homebrew/bin',
				'/Applications/Docker.app/Contents/Resources/bin'
			]
		},
		linux: {
			additional: ['/usr/bin', '/usr/local/bin', '/snap/bin'],
			defaults: [
				'/usr/local/bin',
				'/usr/bin',
				'/bin',
				'/usr/sbin',
				'/sbin',
				'/snap/bin'
			]
		},
		win32: {
			additional: [
				'C:\\Program Files\\Docker\\Docker\\resources\\bin',
				'C:\\Program Files\\Docker Desktop\\resources\\bin'
			],
			defaults: [
				'C:\\Windows\\System32',
				'C:\\Windows',
				'C:\\Program Files\\Docker\\Docker\\resources\\bin',
				'C:\\Program Files\\Docker Desktop\\resources\\bin'
			]
		}
	};

	const { additional, defaults } = config[platform] || config.linux;

	let parts = envPath ? envPath.split(sep) : [];

	if (envPath) {
		additional.forEach((p) => {
			if (!parts.includes(p)) parts.unshift(p);
		});

		process.env.PATH = parts.join(sep);

		console.log(`Enhanced PATH for Docker detection: ${process.env.PATH}`);
	} else {
		process.env.PATH = defaults.join(sep);

		console.warn(
			`PATH environment variable not found, some features might not work correctly`
		);

		console.log(`Set default PATH for ${platform}: ${process.env.PATH}`);
	}

	console.log(`Electron running on platform: ${platform}`);
	console.log(`Node.js version: ${process.version}`);
	console.log(`Electron version: ${process.versions.electron}`);
}
