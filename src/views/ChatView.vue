<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import api from '@/api';
import { toast } from 'vue-sonner';

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
let typingTimeout: any = null;

onMounted(async () => {
  chatStore.setupSocket();
  await chatStore.fetchRooms();
});

watch(() => authStore.user?._id, async (newId) => {
  if (newId) {
    const reqResponse = await api.get(`/friend-requests?toUserId=${newId}`);
    chatStore.friendRequests = reqResponse.data.data || reqResponse.data;
  }
}, { immediate: true });

onUnmounted(() => {
  chatStore.cleanupSocket();
});

// Watch for typing
watch(messageText, () => {
  if (chatStore.activeRoomId) {
    if (!typingTimeout) {
      chatStore.sendTyping(chatStore.activeRoomId, true);
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      chatStore.sendTyping(chatStore.activeRoomId!, false);
      typingTimeout = null;
    }, 2000);
  }
});

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = 0;
  }
};

// Auto-scroll on new messages
watch(() => chatStore.messages.length, () => {
  scrollToBottom();
});

const selectRoom = async (roomId: string) => {
  console.log('🏘️ Selecting Room:', roomId);
  chatStore.activeRoomId = roomId;
  await chatStore.fetchMessages(roomId);
  console.log('📚 Loaded messages for room:', roomId, chatStore.messages.length);
  scrollToBottom();
  
  // Mark last message as read
  if (chatStore.messages.length > 0) {
    const lastMsg = chatStore.messages[0];
    chatStore.markAsRead(lastMsg._id);
  }
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
    toast.success('Friend request sent!');
  } catch (err) {
    toast.error('Failed to send request.');
  }
};

const handleAccept = async (requestId: string) => {
  try {
    await chatStore.handleFriendRequest(requestId, 'accepted');
    // Refresh requests
    chatStore.friendRequests = chatStore.friendRequests.filter(r => r._id !== requestId);
    toast.success('Friend request accepted');
  } catch (err) {
    toast.error('Failed to accept request');
  }
};

const handleSendMessage = async () => {
  if (!messageText.value.trim() || !chatStore.activeRoomId) return;
  const text = messageText.value;
  const replyToId = chatStore.replyTo?._id;
  
  messageText.value = '';
  if (typingTimeout) {
    clearTimeout(typingTimeout);
    chatStore.sendTyping(chatStore.activeRoomId, false);
    typingTimeout = null;
  }
  
  await chatStore.sendMessage(chatStore.activeRoomId, text, replyToId);
  scrollToBottom();
};

const getRoomName = (room: any) => {
  if (!room) return 'Loading...';
  if (room.name) return room.name;
  return `Chat Room`;
};

const getOtherUserId = (room: any) => {
  return room.participantIds?.find((id: string) => id !== authStore.user?._id) || '';
};

const getMessageById = (id: string) => {
  return chatStore.messages.find(m => m._id === id);
};

const sortedMessages = computed(() => {
  return [...chatStore.messages].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
});

const typingText = computed(() => {
  if (chatStore.currentTypingUsers.length === 0) return '';
  return `Someone is typing...`;
});

const pendingRequests = computed(() => 
  chatStore.friendRequests.filter(r => r.status === 'pending')
);

const loadMoreObserver = ref<IntersectionObserver | null>(null);
const sentinel = ref<HTMLElement | null>(null);

onMounted(() => {
  chatStore.setupSocket(); // Ensure socket is setup as it was previously
  chatStore.fetchRooms();

  loadMoreObserver.value = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !chatStore.loading && chatStore.activeRoomId && chatStore.messages.length >= 20) {
      console.log('🔄 Reached top, loading more messages...');
      chatStore.fetchMessages(chatStore.activeRoomId, true);
    }
  }, { threshold: 0.1 });
  
  if (sentinel.value) {
    loadMoreObserver.value.observe(sentinel.value);
  }
});

onUnmounted(() => {
  loadMoreObserver.value?.disconnect();
  chatStore.cleanupSocket();
});
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
            
            <router-link :to="`/profile/${getOtherUserId(room)}`" class="profile-link-small" @click.stop>
              👤
            </router-link>
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
          <div class="header-info">
            <h2>{{ getRoomName(chatStore.activeRoom) }}</h2>
            <span class="status" v-if="!typingText">Online</span>
            <span class="typing-indicator" v-else>{{ typingText }}</span>
          </div>
        </div>

        <div class="messages-container" ref="messagesContainer">
          <div 
            v-for="msg in sortedMessages" 
            :key="msg._id" 
            class="message-wrapper"
            :class="{ 'my-message': String(msg.senderId || msg.userId) === String(authStore.user?._id) }"
          >
            <!-- Reply Quoted Message -->
            <div v-if="msg.replyToId" class="reply-quote">
               <div class="quote-line"></div>
               <div class="quote-content">
                  <span class="quote-user">Replying to:</span>
                  <p>{{ getMessageById(msg.replyToId)?.text || 'Message deleted' }}</p>
               </div>
            </div>

            <div class="message-bubble-container">
              <div class="message-bubble">
                <p>{{ msg.text }}</p>
                <div class="message-meta">
                  <span class="timestamp">{{ new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
                  <span v-if="String(msg.senderId || msg.userId) === String(authStore.user?._id) && (msg.readBy?.length ?? 0) > 1" class="read-status">✓✓</span>
                </div>
              </div>
              <button class="reply-btn-inline" @click="chatStore.setReplyTo(msg)">↩</button>
            </div>
          </div>
          <div ref="sentinel" style="height: 1px;"></div>
        </div>

        <!-- Reply Preview Area -->
        <div v-if="chatStore.replyTo" class="reply-preview">
          <div class="reply-info">
            <span class="reply-label">Replying to message</span>
            <p>{{ chatStore.replyTo.text }}</p>
          </div>
          <button class="close-reply" @click="chatStore.setReplyTo(null)">×</button>
        </div>

        <div class="chat-input-area">
          <form @submit.prevent="handleSendMessage">
            <input type="text" v-model="messageText" placeholder="Type a message..." @focus="chatStore.markAsRead(sortedMessages[sortedMessages.length-1]?._id)" />
            <button type="submit" class="btn btn-primary" :disabled="!messageText.trim()">Send</button>
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
            <router-link :to="`/profile/${searchResult._id}`" class="user-info">
              <strong>{{ searchResult.username }}</strong>
              <span>{{ searchResult.phoneNumber }}</span>
            </router-link>
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
  width: 100%;
  padding: 1.5rem 2rem;
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
  max-width: 170px; /* Reduced to make room for profile-link */
}

.profile-link-small {
  margin-left: auto;
  padding: 0.5rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  text-decoration: none;
  font-size: 1rem;
  transition: var(--transition);
  opacity: 0.5;
}

.profile-link-small:hover {
  background: rgba(255, 255, 255, 0.1);
  opacity: 1;
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

.typing-indicator {
  font-size: 0.85rem;
  color: var(--primary-color);
  font-style: italic;
  font-weight: 500;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;
  display: flex;
  flex-direction: column-reverse; /* NEWEST at bottom naturally */
  gap: 1.5rem;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message-bubble-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.my-message .message-bubble-container {
  flex-direction: row-reverse;
}

.message-bubble {
  max-width: 80%;
  padding: 1rem 1.25rem;
  border-radius: 20px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  position: relative;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.my-message {
  align-items: flex-end;
}

.my-message .message-bubble {
  background: var(--primary-color);
  color: #ffffff;
  border: none;
  border-bottom-right-radius: 4px;
}

.my-message .message-bubble p {
  color: #ffffff;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  justify-content: flex-end;
}

.timestamp {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.my-message .timestamp {
  color: rgba(255, 255, 255, 0.7);
}

.read-status {
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Reply Quote */
.reply-quote {
  display: flex;
  gap: 0.75rem;
  margin-bottom: -0.25rem;
  padding: 0 1rem;
  opacity: 0.8;
}

.my-message .reply-quote {
  flex-direction: row-reverse;
}

.quote-line {
  width: 3px;
  background: var(--primary-color);
  border-radius: 99px;
  opacity: 0.5;
}

.quote-content {
  background: rgba(255, 255, 255, 0.05);
  padding: 0.5rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
}

.quote-user {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.reply-btn-inline {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.25rem;
  cursor: pointer;
  opacity: 0;
  transition: var(--transition);
  padding: 0.5rem;
}

.message-wrapper:hover .reply-btn-inline {
  opacity: 0.6;
}

.reply-btn-inline:hover {
  opacity: 1 !important;
  color: var(--primary-color);
}

/* Reply Preview */
.reply-preview {
  padding: 1rem 2rem;
  background: rgba(0, 0, 0, 0.15);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  animation: slideUp 0.3s ease-out;
}

.reply-info {
  border-left: 3px solid var(--primary-color);
  padding-left: 1rem;
}

.reply-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--primary-color);
}

.close-reply {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.5rem;
  cursor: pointer;
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

/* Hide Scrollbars */
.sidebar-content::-webkit-scrollbar,
.messages-container::-webkit-scrollbar {
  display: none;
}

.sidebar-content,
.messages-container {
  -ms-overflow-style: none;
  scrollbar-width: none;
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
