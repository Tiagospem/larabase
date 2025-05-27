let isConfigured = false;

export function configureMonaco() {
	if (isConfigured) return;

	(self as any).MonacoEnvironment = {
		getWorker: function () {
			const workerCode = `
				class MonacoWorker {
					constructor() {
						this.messageId = 0;
						this.pendingRequests = new Map();
					}

					handleMessage(e) {
						const { id, method, args } = e.data;
						
						try {
							switch (method) {
								case 'validate':
									this.postMessage({ id, result: [] });
									break;
								case 'format':
									this.postMessage({ id, result: args[0] || '' });
									break;
								case 'doHover':
									this.postMessage({ id, result: null });
									break;
								case 'provideCompletionItems':
									this.postMessage({ id, result: { suggestions: [] } });
									break;
								default:
									this.postMessage({ id, result: null });
							}
						} catch (error) {
							this.postMessage({ id, error: error.message });
						}
					}

					postMessage(message) {
						self.postMessage(message);
					}
				}

				const worker = new MonacoWorker();
				
				self.addEventListener('message', (e) => {
					worker.handleMessage(e);
				});

				self.postMessage({ type: 'ready' });
			`;

			const blob = new Blob([workerCode], {
				type: 'application/javascript'
			});
			return new Worker(URL.createObjectURL(blob));
		}
	};

	isConfigured = true;
}
