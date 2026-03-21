<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';

const authStore = useAuthStore();
const router = useRouter();

onMounted(async () => {
  await authStore.fetchProfile();
});

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};
</script>

<template>
  <div class="app-container">
    <header>
      <router-link to="/" class="logo">TALK SOCIAL</router-link>
      <nav>
        <router-link to="/" class="nav-link">Home</router-link>
        <router-link to="/about" class="nav-link">About</router-link>
        
        <template v-if="authStore.user">
          <div class="user-profile">
            <span class="username">{{ authStore.user.username }}</span>
            <button @click="handleLogout" class="btn btn-ghost btn-xs">Logout</button>
          </div>
        </template>
        <template v-else>
          <router-link to="/login" class="nav-link">Sign In</router-link>
          <router-link to="/register" class="btn btn-primary btn-sm">Join Free</router-link>
        </template>
        
        <a href="http://localhost:3030" target="_blank" class="nav-link backend-link">API ↗</a>
      </nav>
    </header>

    <main>
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>

    <footer>
      <p>&copy; 2026 Talk Social. Powered by Vue 3 & Vite.</p>
    </footer>
  </div>
</template>

<style>
@import './assets/styles/main.css';

nav {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.nav-link {
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 500;
  transition: var(--transition);
  font-size: 0.95rem;
}

.nav-link:hover, .router-link-active {
  color: var(--text-primary);
}

.router-link-active:not(.btn) {
  position: relative;
}

.router-link-active:not(.btn)::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--accent-gradient);
  border-radius: 99px;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.btn-xs {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border-radius: 6px;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.25rem 0.5rem 0.25rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.username {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--primary-color);
}

.backend-link {
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.backend-link:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--primary-color);
}

footer {
  padding: 3rem 2rem;
  text-align: center;
  border-top: 1px solid var(--border-color);
  margin-top: 4rem;
  background: rgba(0, 0, 0, 0.2);
}

/* Route Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
