import { defineStore } from 'pinia';
import Cookies from 'js-cookie';
import api from '@/api';

export interface Video {
  _id: string;
  title: string;
  url: string;
  userId: string;
  createdAt: string;
}

export interface User {
  _id: string;
  phoneNumber: string;
  username?: string;
  email?: string;
  videos?: Video[];
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    loading: false,
    error: null as string | null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
  },

  actions: {
    setTokens(accessToken: string, refreshToken: string, remember: boolean) {
      const options = remember ? { expires: 7 } : {};
      Cookies.set('accessToken', accessToken, options);
      // Refresh token usually has a longer expiration, e.g., 3 days as per doc
      Cookies.set('refreshToken', refreshToken, { expires: 3 });
    },

    setUser(user: User | null) {
      this.user = user;
    },

    async fetchProfile() {
      const token = Cookies.get('accessToken');
      if (!token) return;

      this.loading = true;
      try {
        const response = await api.get('/users/me');
        this.user = response.data;
      } catch (err: any) {
        console.error('Fetch profile failed', err);
        // If 401, the interceptor will handle refresh. 
        // We only logout if everything fails.
      } finally {
        this.loading = false;
      }
    },

    async refresh() {
      const refreshToken = Cookies.get('refreshToken');
      if (!refreshToken) throw new Error('No refresh token available');

      try {
        const response = await api.post('/refresh-token', { refreshToken });
        const { accessToken: newAccess, refreshToken: newRefresh, user } = response.data;
        
        // Update cookies
        this.setTokens(newAccess, newRefresh, true);
        if (user) this.setUser(user);
        
        return newAccess;
      } catch (err) {
        this.logout();
        throw err;
      }
    },

    logout() {
      Cookies.remove('accessToken');
      Cookies.remove('refreshToken');
      this.user = null;
      window.location.href = '/login?expired=true';
    },
  },
});
