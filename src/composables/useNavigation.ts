import { useRouter } from 'vue-router';
import { useConnectionsStore } from '@/store/connections';

export function useNavigation() {
	const router = useRouter();
	const connectionsStore = useConnectionsStore();

	const goToMainPage = async () => {
		connectionsStore.resetState();
		await connectionsStore.loadConnections(null);
		await router.push('/');
	};

	return {
		goToMainPage
	};
}
