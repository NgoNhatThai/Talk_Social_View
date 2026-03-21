<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import api from '@/api';

const chatStore = useChatStore();
const authStore = useAuthStore();

// Sidebar state
const activeTab = ref<'rooms' | 'requests'>('rooms');

// Modal state
const showAddFriend = ref(false);
const searchPhone = ref('');
const searchResult = ref<any>(null);
const searchLoading = ref(false);
const searchError = ref('');

// Chat Room state
const messageText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);

onMounted(async () => {
  chatStore.setupSocket();
  await chatStore.fetchRooms();
  // Fetch pending friend requests
  const reqResponse = await api.get(`/friend-requests?toUserId=${authStore.user?._id}`);
  chatStore.friendRequests = reqResponse.data.data || reqResponse.data;
});

onUnmounted(() => {
  chatStore.cleanupSocket();
});

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const selectRoom = async (roomId: string) => {
  chatStore.activeRoomId = roomId;
  await chatStore.fetchMessages(roomId);
  scrollToBottom();
};

const handleSearchUser = async () => {
  searchLoading.value = true;
  searchError.value = '';
  searchResult.value = null;
  
  try {
    const user = await chatStore.findUserByPhone(searchPhone.value);
    if (user) {
      if (user._id === authStore.user?._id) {
        searchError.value = "You can't add yourself.";
      } else {
        searchResult.value = user;
      }
    } else {
      searchError.value = 'User not found.';
    }
  } catch (err) {
    searchError.value = 'Search failed.';
  } finally {
    searchLoading.value = false;
  }
};

const handleSendRequest = async () => {
  if (!searchResult.value) return;
  try {
    await chatStore.sendFriendRequest(searchResult.value._id);
    showAddFriend.value = false;
    alert('Friend request sent!');
  } catch (err) {
    alert('Failed to send request.');
  }
};

const handleAccept = async (requestId: string) => {
  await chatStore.handleFriendRequest(requestId, 'accepted');
  // Refresh requests
  chatStore.friendRequests = chatStore.friendRequests.filter(r => r._id !== requestId);
};

const handleSendMessage = async () => {
  if (!messageText.value.trim() || !chatStore.activeRoomId) return;
  const text = messageText.value;
  messageText.value = '';
  await chatStore.sendMessage(chatStore.activeRoomId, text);
};

const getRoomName = (room: any) => {
  if (room.name) return room.name;
  // Fallback to participant usernames if available
  return `Chat ${room._id.substring(0, 5)}`;
};

const sortedMessages = computed(() => {
  return [...chatStore.messages].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
});

const pendingRequests = computed(() => 
  chatStore.friendRequests.filter(r => r.status === 'pending')
);
</script>

<template>
  <div class="chat-view fade-in">
    <!-- Sidebar -->
    <div class="sidebar glass-card">
      <div class="sidebar-header">
        <div class="search-bar">
          <input type="text" placeholder="Search chats..." v-model="chatStore.searchQuery" />
        </div>
        <button class="btn btn-primary add-friend-btn" @click="showAddFriend = true">
          <span class="icon">+</span>
        </button>
      </div>

      <div class="sidebar-tabs">
        <button :class="{ active: activeTab === 'rooms' }" @click="activeTab = 'rooms'">
          Chats ({{ chatStore.rooms.length }})
        </button>
        <button :class="{ active: activeTab === 'requests' }" @click="activeTab = 'requests'">
          Requests ({{ pendingRequests.length }})
        </button>
      </div>

      <div class="sidebar-content">
        <!-- Rooms List -->
        <div v-if="activeTab === 'rooms'" class="rooms-list">
          <div 
            v-for="room in chatStore.filteredRooms" 
            :key="room._id" 
            class="room-item" 
            :class="{ active: chatStore.activeRoomId === room._id }"
            @click="selectRoom(room._id)"
          >
            <div class="avatar-circle">{{ getRoomName(room).charAt(0) }}</div>
            <div class="room-info">
              <span class="room-name">{{ getRoomName(room) }}</span>
              <span class="last-message">Click to view messages...</span>
            </div>
          </div>
          <div v-if="chatStore.rooms.length === 0" class="empty-state">
            No chats yet. Add a friend to start!
          </div>
        </div>

        <!-- Requests List -->
        <div v-else class="requests-list">
          <div v-for="req in pendingRequests" :key="req._id" class="request-item">
            <div class="req-info">
              <span>Request from: {{ req.fromUserId.substring(0, 8) }}...</span>
            </div>
            <div class="req-actions">
              <button class="btn btn-xs btn-primary" @click="handleAccept(req._id)">Accept</button>
              <button class="btn btn-xs btn-ghost" @click="chatStore.handleFriendRequest(req._id, 'rejected')">Deny</button>
            </div>
          </div>
          <div v-if="pendingRequests.length === 0" class="empty-state">
            No pending requests.
          </div>
        </div>
      </div>
    </div>

    <!-- Main Chat Area -->
    <div class="chat-main glass-card">
      <template v-if="chatStore.activeRoomId">
        <div class="chat-header">
          <h2>{{ getRoomName(chatStore.activeRoom) }}</h2>
          <span class="status">Online</span>
        </div>

        <div class="messages-container" ref="messagesContainer">
          <div 
            v-for="msg in sortedMessages" 
            :key="msg._id" 
            class="message-wrapper"
            :class="{ 'my-message': msg.userId === authStore.user?._id }"
          >
            <div class="message-bubble">
              <p>{{ msg.text }}</p>
              <span class="timestamp">{{ new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
            </div>
          </div>
        </div>

        <div class="chat-input-area">
          <form @submit.prevent="handleSendMessage">
            <input type="text" v-model="messageText" placeholder="Type a message..." />
            <button type="submit" class="btn btn-primary">Send</button>
          </form>
        </div>
      </template>
      <div v-else class="chat-placeholder">
        <div class="placeholder-icon">💬</div>
        <h3>Select a chat to start messaging</h3>
        <p>Or find a friend using the + button.</p>
      </div>
    </div>

    <!-- Add Friend Modal -->
    <div v-if="showAddFriend" class="modal-overlay" @click.self="showAddFriend = false">
      <div class="modal-content glass-card fade-in">
        <h3>Add Friend</h3>
        <p>Find someone by their phone number</p>
        
        <div class="search-input-group">
          <input type="text" v-model="searchPhone" placeholder="09xxx..." @keyup.enter="handleSearchUser" />
          <button class="btn btn-primary" @click="handleSearchUser" :disabled="searchLoading">
            {{ searchLoading ? '...' : 'Search' }}
          </button>
        </div>

        <div v-if="searchError" class="search-error">{{ searchError }}</div>

        <div v-if="searchResult" class="search-result">
          <div class="user-card">
            <div class="avatar-circle large">{{ searchResult.username.charAt(0) }}</div>
            <div class="user-info">
              <strong>{{ searchResult.username }}</strong>
              <span>{{ searchResult.phoneNumber }}</span>
            </div>
            <button class="btn btn-primary" @click="handleSendRequest">Add</button>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showAddFriend = false">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 1.5rem;
  height: calc(100vh - 160px);
  max-width: 1400px;
  margin: 0 auto;
}

/* Sidebar */
.sidebar {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 24px;
}

.sidebar-header {
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.search-bar {
  flex: 1;
}

.add-friend-btn {
  width: 42px;
  height: 42px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.sidebar-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-tabs button {
  background: transparent;
  border: none;
  padding: 1rem;
  color: var(--text-secondary);
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.sidebar-tabs button.active {
  color: var(--primary-color);
  border-bottom: 2px solid var(--primary-color);
  background: rgba(255, 255, 255, 0.05);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
}

.room-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  cursor: pointer;
  transition: var(--transition);
  border-bottom: 1px solid var(--border-color);
}

.room-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.room-item.active {
  background: rgba(99, 102, 241, 0.1);
  border-left: 4px solid var(--primary-color);
}

.avatar-circle {
  width: 48px;
  height: 48px;
  background: var(--accent-gradient);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
}

.avatar-circle.large {
  width: 64px;
  height: 64px;
  font-size: 1.5rem;
}

.room-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.room-name {
  font-weight: 700;
  font-size: 1.05rem;
}

.last-message {
  font-size: 0.85rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

/* Requests List */
.request-item {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.req-info {
  margin-bottom: 0.75rem;
  font-weight: 500;
}

.req-actions {
  display: flex;
  gap: 0.5rem;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: var(--text-secondary);
}

/* Chat Main Area */
.chat-main {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 24px;
  position: relative;
}

.chat-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--border-color);
  background: rgba(0, 0, 0, 0.1);
}

.status {
  font-size: 0.85rem;
  color: #22c55e;
  font-weight: 600;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
}

.message-bubble {
  max-width: 70%;
  padding: 1rem 1.25rem;
  border-radius: 20px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  position: relative;
}

.my-message {
  align-items: flex-end;
}

.my-message .message-bubble {
  background: var(--primary-color);
  color: white;
  border: none;
  border-bottom-right-radius: 4px;
}

.my-message .timestamp {
  color: rgba(255, 255, 255, 0.7);
}

.timestamp {
  font-size: 0.7rem;
  color: var(--text-secondary);
  display: block;
  margin-top: 0.5rem;
}

.chat-input-area {
  padding: 1.5rem 2rem;
  border-top: 1px solid var(--border-color);
  background: rgba(0, 0, 0, 0.1);
}

.chat-input-area form {
  display: flex;
  gap: 1rem;
}

.chat-input-area input {
  flex: 1;
}

/* Placeholder */
.chat-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.placeholder-icon {
  font-size: 5rem;
  margin-bottom: 1.5rem;
  opacity: 0.3;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  width: 100%;
  max-width: 400px;
  padding: 2.5rem;
  border-radius: 32px;
}

.search-input-group {
  display: flex;
  gap: 0.5rem;
  margin: 1.5rem 0;
}

.search-error {
  color: #ef4444;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  margin-bottom: 1.5rem;
  border: 1px solid var(--border-color);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 900px) {
  .chat-view {
    grid-template-columns: 1fr;
  }
  .sidebar {
    display: none; /* In a real app we'd have a mobile view toggle */
  }
}
</style>
