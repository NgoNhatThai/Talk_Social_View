<script setup lang="ts">
import { useAppStore } from '@/store/app';
import { useAuthStore } from '@/store/auth';
import { onMounted } from 'vue';

const store = useAppStore();
const authStore = useAuthStore();

onMounted(() => {
  store.checkBackend();
});
</script>

<template>
  <div class="container fade-in">
    <section class="hero">
      <h1>Welcome to <span class="gradient-text">TALK SOCIAL</span></h1>
      <p>A high-performance codebase integrated with your local backend at port 3030.</p>
      
      <div v-if="authStore.user" style="margin-top: 2rem;">
        <router-link to="/chats" class="btn btn-primary" style="font-size: 1.1rem; padding: 0.75rem 2rem; border-radius: 99px;">
          Go to Chats
        </router-link>
      </div>

      <div class="status-badge" :class="store.backendStatus">
        Backend Status: {{ store.backendStatus.toUpperCase() }}
      </div>
    </section>

    <div class="grid">
      <div class="card">
        <h3>Backend Integration</h3>
        <p>Connected to <code>http://localhost:3030</code>. Try checking the health endpoint or fetching data.</p>
        <button class="btn btn-primary" @click="store.checkBackend" :disabled="store.loading">
          {{ store.loading ? 'Checking...' : 'Check Status' }}
        </button>
      </div>

      <div class="card">
        <h3>State Management</h3>
        <p>Using Pinia for robust state handling. Current count: <strong>{{ store.count }}</strong></p>
        <button class="btn btn-ghost" @click="store.increment">Increment Count</button>
      </div>

      <div class="card">
        <h3>Modern Styling</h3>
        <p>Vanilla CSS optimized for beauty. Glassmorphism, gradients, and subtle animations included.</p>
        <router-link to="/about" class="btn btn-ghost">Learn More →</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero {
  text-align: center;
  margin-bottom: 4rem;
  padding-top: 2rem;
}

.gradient-text {
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.status-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 99px;
  font-size: 0.875rem;
  font-weight: 700;
  margin-top: 1.5rem;
  border: 1px solid var(--border-color);
}

.status-badge.online {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border-color: rgba(34, 197, 94, 0.2);
}

.status-badge.offline {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.2);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

h3 {
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.card p {
  margin-bottom: 1.5rem;
}
</style>
