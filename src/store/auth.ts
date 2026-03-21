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
    setToken(token: string, remember: boolean) {
      if (remember) {
        Cookies.set('accessToken', token, { expires: 7 });
      } else {
        Cookies.set('accessToken', token);
      }
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
        this.logout();
      } finally {
        this.loading = false;
      }
    },

    logout() {
      Cookies.remove('accessToken');
      this.user = null;
    },
  },
});
