<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore, type Video, type User } from '@/store/auth';
import { socketService } from '@/services/socket';
import api from '@/api';

const route = useRoute();
const authStore = useAuthStore();

const user = ref<User | null>(null);
const loading = ref(true);
const error = ref('');

// Add Video Modal
const showAddVideo = ref(false);
const videoUrl = ref('');
const videoTitle = ref('');
const addingVideo = ref(false);

// Video Player
const activeVideo = ref<Video | null>(null);

const isMyProfile = computed(() => {
  return route.params.id === 'me' || route.params.id === authStore.user?._id;
});

const fetchProfile = async () => {
  loading.value = true;
  error.value = '';
  const id = route.params.id === 'me' ? 'me' : route.params.id;
  
  try {
    const response = await api.get(`/users/${id}`);
    user.value = response.data;
  } catch (err: any) {
    console.error('Fetch profile error:', err);
    error.value = 'Failed to load profile. This user might not exist.';
  } finally {
    loading.value = false;
  }
};

const handleAddVideo = async () => {
  if (!videoUrl.value) return;
  
  addingVideo.value = true;
  try {
    const response = await api.post('/videos', {
      url: videoUrl.value,
      title: videoTitle.value || 'Untitled Video'
    });
    
    // Add to local list if it's my profile
    if (user.value && (user.value._id === authStore.user?._id || route.params.id === 'me')) {
      if (!user.value.videos) user.value.videos = [];
      user.value.videos.unshift(response.data);
    }
    
    showAddVideo.value = false;
    videoUrl.value = '';
    videoTitle.value = '';
  } catch (err: any) {
    alert('Failed to add video. Please check the URL.');
  } finally {
    addingVideo.value = false;
  }
};

const getStreamUrl = (videoId: string) => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3030';
  return `${baseUrl}/videos/${videoId}/stream`;
};

const playVideo = (video: Video) => {
  activeVideo.value = video;
};

const closePlayer = () => {
  activeVideo.value = null;
};

const setupSocket = () => {
  socketService.on('videos created', (video: Video) => {
    if (user.value && video.userId === user.value._id) {
      if (!user.value.videos) user.value.videos = [];
      // Avoid duplicates
      if (!user.value.videos.some(v => v._id === video._id)) {
        user.value.videos.unshift(video);
      }
    }
  });

  socketService.on('videos removed', (video: Video) => {
    if (user.value && video.userId === user.value._id) {
      user.value.videos = user.value.videos?.filter(v => v._id !== video._id);
    }
  });
};

onMounted(() => {
  fetchProfile();
  setupSocket();
});

onUnmounted(() => {
  socketService.off('videos created');
  socketService.off('videos removed');
});

// Refetch if ID changes (e.g. navigating between profiles)
watch(() => route.params.id, () => {
  fetchProfile();
});
</script>

<template>
  <div class="profile-view fade-in">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading profile...</p>
    </div>

    <div v-else-if="error" class="error-state card">
      <h2>Oops!</h2>
      <p>{{ error }}</p>
      <router-link to="/" class="btn btn-primary">Go Home</router-link>
    </div>

    <div v-else-if="user" class="profile-container">
      <!-- Profile Header -->
      <section class="profile-header card">
        <div class="profile-bg-accent"></div>
        <div class="profile-info-wrapper">
          <div class="avatar-large">{{ user.username?.charAt(0) || 'U' }}</div>
          <div class="profile-text">
            <h1>{{ user.username }}</h1>
            <p class="phone-number">{{ user.phoneNumber }}</p>
            <div class="badges">
              <span class="badge" v-if="isMyProfile">My Profile</span>
              <span class="badge success">Active</span>
            </div>
          </div>
          <div class="profile-actions" v-if="isMyProfile">
            <button class="btn btn-primary" @click="showAddVideo = true">
              <span class="icon">+</span> Add Video
            </button>
          </div>
        </div>
      </section>

      <!-- Video Gallery -->
      <section class="video-gallery">
        <div class="section-header">
          <h2>Videos <span class="count">{{ user.videos?.length || 0 }}</span></h2>
        </div>

        <div v-if="user.videos && user.videos.length > 0" class="video-grid">
          <div 
            v-for="video in user.videos" 
            :key="video._id" 
            class="video-card card"
            @click="playVideo(video)"
          >
            <div class="video-thumbnail">
              <div class="play-overlay">
                <span class="play-icon">▶</span>
              </div>
              <div class="thumbnail-placeholder">
                <span class="movie-icon">🎬</span>
              </div>
            </div>
            <div class="video-info">
              <h3>{{ video.title }}</h3>
              <p class="timestamp">{{ new Date(video.createdAt).toLocaleDateString() }}</p>
            </div>
          </div>
        </div>

        <div v-else class="empty-videos card">
          <div class="empty-icon">🎥</div>
          <h3>No videos yet</h3>
          <p v-if="isMyProfile">Share your first video with the community!</p>
          <p v-else>This user hasn't uploaded any videos yet.</p>
          <button v-if="isMyProfile" class="btn btn-ghost" @click="showAddVideo = true">
            Add your first video
          </button>
        </div>
      </section>
    </div>

    <!-- Add Video Modal -->
    <div v-if="showAddVideo" class="modal-overlay" @click.self="showAddVideo = false">
      <div class="modal-content card fade-in">
        <h2>Add Global Video</h2>
        <p>Paste a direct video URL (mp4, webm, etc.) to share it on your profile.</p>
        
        <div class="form-group">
          <label>Video Title</label>
          <input 
            type="text" 
            v-model="videoTitle" 
            placeholder="Cool summer vlog..." 
          />
        </div>

        <div class="form-group">
          <label>Video URL</label>
          <input 
            type="url" 
            v-model="videoUrl" 
            placeholder="https://example.com/video.mp4" 
            required
          />
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showAddVideo = false">Cancel</button>
          <button 
            class="btn btn-primary" 
            @click="handleAddVideo" 
            :disabled="addingVideo || !videoUrl"
          >
            {{ addingVideo ? 'Adding...' : 'Add Video' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Video Player Overlay -->
    <div v-if="activeVideo" class="video-player-overlay" @click.self="closePlayer">
      <div class="player-container fade-in">
        <div class="player-header">
          <h3>{{ activeVideo.title }}</h3>
          <button class="close-btn" @click="closePlayer">×</button>
        </div>
        <div class="video-wrapper">
          <video 
            controls 
            autoplay 
            class="main-video"
            :src="getStreamUrl(activeVideo._id)"
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <div class="player-footer">
          <p>Playing from secure stream</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-view {
  max-width: 1000px;
  margin: 0 auto;
  padding-bottom: 5rem;
}

.loading-state, .error-state {
  text-align: center;
  padding: 5rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid var(--border-color);
  border-top: 4px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Profile Header */
.profile-header {
  position: relative;
  overflow: hidden;
  margin-bottom: 3rem;
  padding: 0;
}

.profile-bg-accent {
  height: 120px;
  background: var(--accent-gradient);
  opacity: 0.3;
}

.profile-info-wrapper {
  padding: 0 2.5rem 2.5rem;
  margin-top: -50px;
  display: flex;
  align-items: flex-end;
  gap: 2rem;
}

.avatar-large {
  width: 120px;
  height: 120px;
  background: var(--accent-gradient);
  border-radius: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3.5rem;
  font-weight: 800;
  color: white;
  border: 6px solid var(--bg-color);
  box-shadow: var(--shadow-lg);
}

.profile-text {
  flex: 1;
}

.profile-text h1 {
  font-size: 2.25rem;
  margin-bottom: 0.25rem;
}

.phone-number {
  font-size: 1.1rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.badges {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.badge {
  padding: 0.25rem 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 99px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge.success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

/* Video Gallery */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.count {
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.2rem 0.6rem;
  border-radius: 8px;
  margin-left: 0.5rem;
  vertical-align: middle;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.video-card {
  padding: 0;
  overflow: hidden;
  cursor: pointer;
}

.video-thumbnail {
  aspect-ratio: 16/9;
  background: #000;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumbnail-placeholder {
  font-size: 3rem;
  opacity: 0.3;
}

.play-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: var(--transition);
  z-index: 1;
}

.video-card:hover .play-overlay {
  opacity: 1;
}

.play-icon {
  width: 60px;
  height: 60px;
  background: white;
  color: var(--primary-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  transform: scale(0.8);
  transition: var(--transition);
}

.video-card:hover .play-icon {
  transform: scale(1);
}

.video-info {
  padding: 1.25rem;
}

.video-info h3 {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timestamp {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.empty-videos {
  text-align: center;
  padding: 4rem 2rem;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
  opacity: 0.2;
}

/* Modals & Overlays */
.modal-overlay, .video-player-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  width: 100%;
  max-width: 500px;
}

.form-group {
  margin: 1.5rem 0;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
}

/* Video Player */
.player-container {
  width: 100%;
  max-width: 1000px;
  background: #000;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.player-header {
  padding: 1rem 1.5rem;
  background: #111;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.close-btn {
  background: transparent;
  border: none;
  color: white;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.6;
  transition: var(--transition);
}

.close-btn:hover {
  opacity: 1;
}

.video-wrapper {
  background: #000;
  aspect-ratio: 16/9;
  display: flex;
}

.main-video {
  width: 100%;
  height: 100%;
}

.player-footer {
  padding: 1rem 1.5rem;
  background: #111;
  color: #666;
  font-size: 0.8rem;
  text-align: center;
}

@media (max-width: 768px) {
  .profile-info-wrapper {
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-top: -60px;
  }
}
</style>
