<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import api from '@/api';

const router = useRouter();
const authStore = useAuthStore();

const phoneNumber = ref('');
const password = ref('');
const rememberMe = ref(true);
const loading = ref(false);
const errorMsg = ref('');

const handleLogin = async () => {
  if (!phoneNumber.value || !password.value) {
    errorMsg.value = 'Please fill in all fields.';
    return;
  }

  loading.value = true;
  errorMsg.value = '';

  try {
    const response = await api.post('/authentication', {
      strategy: 'local',
      phoneNumber: phoneNumber.value,
      password: password.value,
    });

    const { accessToken, user } = response.data;
    
    // Save token to cookie (with rememberMe logic)
    authStore.setToken(accessToken, rememberMe.value);
    authStore.setUser(user);

    // Redirect to chats
    router.push('/chats');
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message || 'Login failed. Please check your credentials.';
    console.error('Login error:', err);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="auth-container fade-in">
    <div class="auth-card glass-card">
      <div class="auth-header">
        <h1>TALK.<span class="gradient-text">SOCIAL</span></h1>
        <p>Sign in to your account</p>
      </div>

      <form @submit.prevent="handleLogin" class="auth-form">
        <div class="form-group">
          <label>Phone Number</label>
          <input 
            v-model="phoneNumber" 
            type="text" 
            placeholder="09xxx..." 
            required 
          />
        </div>

        <div class="form-group">
          <label>Password</label>
          <input 
            v-model="password" 
            type="password" 
            placeholder="••••••••" 
            required 
          />
        </div>

        <div class="form-options">
          <label class="checkbox-container">
            <input type="checkbox" v-model="rememberMe" />
            <span class="checkmark"></span>
            Keep me logged in
          </label>
        </div>

        <div v-if="errorMsg" class="error-banner">
          {{ errorMsg }}
        </div>

        <button type="submit" class="btn btn-primary w-full" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>

        <div class="auth-footer">
          Don't have an account? 
          <router-link to="/register" class="link-text">Create Account</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-container {
  min-height: calc(100vh - 200px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.auth-card {
  width: 100%;
  max-width: 450px;
  padding: 3rem;
  border-radius: 32px;
  animation: slideUp 0.6s ease-out;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

.auth-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.auth-header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.auth-header p {
  color: var(--text-secondary);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-weight: 500;
  margin-left: 0.25rem;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.checkbox-container {
  display: flex;
  align-items: center;
  cursor: pointer;
  gap: 0.5rem;
  user-select: none;
}

.checkmark {
  width: 18px;
  height: 18px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  position: relative;
  transition: var(--transition);
}

input[type="checkbox"] {
  display: none;
}

input[type="checkbox"]:checked + .checkmark {
  background: var(--primary-color);
  border-color: var(--primary-color);
}

input[type="checkbox"]:checked + .checkmark::after {
  content: '✓';
  color: white;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
}

.error-banner {
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-radius: 12px;
  font-size: 0.875rem;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.w-full {
  width: 100%;
  justify-content: center;
  padding: 1rem;
}

.auth-footer {
  text-align: center;
  font-size: 0.9rem;
  margin-top: 1rem;
  color: var(--text-secondary);
}

.link-text {
  color: var(--primary-color);
  font-weight: 600;
  text-decoration: none;
  margin-left: 0.25rem;
}

.link-text:hover {
  text-decoration: underline;
}

.gradient-text {
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
