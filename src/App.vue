<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { Toaster } from 'vue-sonner';
import { LogOutIcon } from 'lucide-vue-next';

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
            <router-link to="/profile/me" class="username-link">
              <span class="avatar-sm">{{ authStore.user.username?.charAt(0) || 'U' }}</span>
              <span class="username">{{ authStore.user.username }}</span>
            </router-link>
            <button @click="handleLogout" class="btn" style="padding: 0.5rem;">Logout</button>
          </div>
        </template>
        <template v-else>
          <router-link to="/login" class="nav-link">Sign In</router-link>
          <router-link to="/register" class="btn btn-primary btn-sm">Join Free</router-link>
        </template>
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

    <Toaster position="top-right" richColors />
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
  background: transparent;
  border-radius: 12px;
  border: none;
}

.username-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  transition: var(--transition);
}

.username-link:hover .username {
  color: var(--secondary-color);
}

.avatar-sm {
  width: 28px;
  height: 28px;
  background: var(--accent-gradient);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
  color: white;
}

.username {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
  transition: var(--transition);
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
