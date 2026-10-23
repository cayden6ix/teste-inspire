import { useSyncExternalStore } from 'react';
import { useAuthStore } from '@/stores/authStore';

function subscribeHydration(listener: () => void) {
  return useAuthStore.persist.onFinishHydration(listener);
}

function isHydrated() {
  return useAuthStore.persist.hasHydrated();
}

/** A sessao persistida (localStorage) ja foi restaurada? Antes disso o token ainda e `null`. */
export function useAuthHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, isHydrated, () => false);
}
