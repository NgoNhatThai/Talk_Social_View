import api from '@/api';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
}

export const userService = {
  async getProfile(userId: string): Promise<UserProfile> {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  async register(data: any) {
    const response = await api.post('/users', data);
    return response.data;
  },

  async login(credentials: any) {
    const response = await api.post('/authentication', credentials);
    return response.data;
  },
};

export const healthService = {
  async check(): Promise<boolean> {
    try {
      const response = await api.get('/');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  },
};
