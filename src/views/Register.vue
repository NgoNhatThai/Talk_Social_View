<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import api from '@/api';

const router = useRouter();
const authStore = useAuthStore();

const phoneNumber = ref('');
const username = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');

const loading = ref(false);
const errorMsg = ref('');

const handleRegister = async () => {
  if (!phoneNumber.value || !password.value || !username.value) {
    errorMsg.value = 'Please fill in all mandatory fields.';
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMsg.value = 'Passwords do not match.';
    return;
  }

  loading.value = true;
  errorMsg.value = '';

  try {
    // 1. Call Register API
    await api.post('/users', {
      phoneNumber: phoneNumber.value,
      username: username.value,
      email: email.value,
      password: password.value,
    });

    // 2. Call Login API automatically
    const loginResponse = await api.post('/authentication', {
      strategy: 'local',
      phoneNumber: phoneNumber.value,
      password: password.value,
    });

    const { accessToken, user } = loginResponse.data;
    
    // Save token to cookie (default remember)
    authStore.setToken(accessToken, true);
    authStore.setUser(user);

    // Redirect to chats
    router.push('/chats');
  } catch (err: any) {
    if (err.response?.status === 409) {
      errorMsg.value = 'Phone number already exists.';
    } else {
      errorMsg.value = err.response?.data?.message || 'Registration failed.';
    }
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
        <p>Create your account</p>
      </div>

      <form @submit.prevent="handleRegister" class="auth-form">
        <div class="form-grid">
          <div class="form-group">
            <label>Username</label>
            <input 
              v-model="username" 
              type="text" 
              placeholder="e.g. John Doe" 
              required 
            />
          </div>

          <div class="form-group">
            <label>Phone Number</label>
            <input 
              v-model="phoneNumber" 
              type="text" 
              placeholder="09xxx..." 
              required 
            />
          </div>
        </div>

        <div class="form-group">
          <label>Email (Optional)</label>
          <input 
            v-model="email" 
            type="email" 
            placeholder="john@example.com" 
          />
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Password</label>
            <input 
              v-model="password" 
              type="password" 
              placeholder="••••••••" 
              required 
            />
          </div>

          <div class="form-group">
            <label>Confirm Password</label>
            <input 
              v-model="confirmPassword" 
              type="password" 
              placeholder="••••••••" 
              required 
            />
          </div>
        </div>

        <div v-if="errorMsg" class="error-banner">
          {{ errorMsg }}
        </div>

        <button type="submit" class="btn btn-primary w-full" :disabled="loading">
          {{ loading ? 'Creating Account...' : 'Get Started' }}
        </button>

        <div class="auth-footer">
          Already have an account? 
          <router-link to="/login" class="link-text">Sign In Instead</router-link>
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
  max-width: 550px;
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

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
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
