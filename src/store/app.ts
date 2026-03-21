import { defineStore } from 'pinia';
import api from '@/api';

export const useAppStore = defineStore('app', {
  state: () => ({
    count: 0,
    loading: false,
    errorMessage: null,
    backendStatus: 'unknown',
  }),

  getters: {
    doubleCount: (state) => state.count * 2,
  },

  actions: {
    increment() {
      this.count++;
    },

    async checkBackend() {
      this.loading = true;
      try {
        const response = await api.get('/'); // Health Check endpoint
        this.backendStatus = response.status === 200 ? 'online' : 'error';
      } catch (error) {
        this.backendStatus = 'offline';
        console.error('Backend check failed', error);
      } finally {
        this.loading = false;
      }
    },
  },
});
