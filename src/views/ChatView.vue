<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import api from '@/api';
import { toast } from 'vue-sonner';
import { uploadToCloudinary } from '@/services/cloudinary';
import {
  Image as ImageIcon,
  Paperclip as PaperclipIcon,
  Download as DownloadIcon,
  CornerUpLeft as ReplyIcon,
  MessageSquare as MessageSquareIcon,
  Plus as PlusIcon,
  Search as SearchIcon,
  X as XIcon,
  File as FileIcon,
  Send as SendIcon,
  UserPlus as UserPlusIcon
} from 'lucide-vue-next';

const chatStore = useChatStore();
const authStore = useAuthStore();

// UI Refs
const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const previewImage = ref<string | null>(null);
const showAddFriend = ref(false);
const activeTab = ref<'rooms' | 'requests'>('rooms');
const searchPhone = ref('');
const searchResult = ref<any>(null);
const searchLoading = ref(false);
const searchError = ref('');

// Chat Room state
const messageText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
let typingTimeout: any = null;

watch(() => authStore.user?._id, async (newId) => {
  if (newId) {
    const reqResponse = await api.get(`/friend-requests?toUserId=${newId}`);
    chatStore.friendRequests = reqResponse.data.data || reqResponse.data;
  }
}, { immediate: true });

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
  const room = chatStore.rooms.find(r => r._id === roomId);
  if (room && room.lastMessageId && isRoomUnread(room)) {
    chatStore.markAsRead(room.lastMessageId);
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

const triggerFileInput = (type: 'image' | 'file') => {
  if (fileInput.value) {
    fileInput.value.setAttribute('accept', type === 'image' ? 'image/*' : '*/*');
    fileInput.value.click();
  }
};

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file || !chatStore.activeRoomId) return;

  uploading.value = true;
  try {
    const isImage = file.type.startsWith('image/');
    const type: 'image' | 'file' = isImage ? 'image' : 'file';
    
    toast.promise(uploadToCloudinary(file), {
      loading: `Uploading ${type}...`,
      success: async (result: any) => {
        await chatStore.sendMessage(chatStore.activeRoomId!, result.secure_url, undefined, type);
        uploading.value = false;
        scrollToBottom();
        return 'Sent successfully';
      },
      error: (err: any) => {
        uploading.value = false;
        return `Upload failed: ${err.message}`;
      }
    });
  } catch (err: any) {
    console.error('File drop error:', err);
    uploading.value = false;
  } finally {
    target.value = ''; // Reset input
  }
};

const handleSendMessage = async (type: 'text' | 'image' | 'file' = 'text') => {
  if (!messageText.value.trim() || !chatStore.activeRoomId) return;
  const text = messageText.value;
  const replyToId = chatStore.replyTo?._id;
  
  messageText.value = '';
  if (typingTimeout) {
    clearTimeout(typingTimeout);
    chatStore.sendTyping(chatStore.activeRoomId, false);
    typingTimeout = null;
  }
  
  await chatStore.sendMessage(chatStore.activeRoomId, text, replyToId, type);
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
  return `Typing ...`;
});

const isRoomUnread = (room: any) => {
  if (room._id === chatStore.activeRoomId) return false;
  if (!room.lastMessageId || !authStore.user?._id) return false;
  return String(room.lastMessageSenderId) !== String(authStore.user._id) && 
         !room.lastMessageReadBy?.includes(authStore.user._id);
};

const formatLastMessageTime = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

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
          <div class="search-box">
            <SearchIcon :size="18" class="search-icon" />
            <input type="text" v-model="chatStore.searchQuery" placeholder="Search friends..." />
          </div>
          <button class="add-btn" @click="showAddFriend = true" title="Add friend">
            <UserPlusIcon :size="20" />
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
            :class="{ active: chatStore.activeRoomId === room._id, 'is-unread': isRoomUnread(room) }"
            @click="selectRoom(room._id)"
          >
            <div class="avatar-circle">{{ getRoomName(room).charAt(0) }}</div>
            <div class="room-info">
              <div class="name-time">
                <span class="room-name">{{ getRoomName(room) }}</span>
                <span class="room-time">{{ formatLastMessageTime(room.lastMessageAt) }}</span>
              </div>
              <div class="snippet-unread">
                <span class="last-message">{{ room.lastMessageContent || 'No messages yet...' }}</span>
                <div v-if="isRoomUnread(room)" class="unread-dot"></div>
              </div>
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
              <span>Request from: {{ req.fromUser?.username?.substring(0, 8) }}...</span>
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
            <span class="status">Online</span>
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
              <div class="message-bubble" :class="{ 'is-media': msg.type === 'image' || (msg.text.startsWith('https://res.cloudinary.com') && /\.(jpg|jpeg|png|webp|gif)$/i.test(msg.text)) }">
                <!-- Cloudinary Image Special Handling -->
                <div v-if="msg.type === 'image' || (msg.text.startsWith('https://res.cloudinary.com') && /\.(jpg|jpeg|png|webp|gif)$/i.test(msg.text))" class="message-image-container">
                  <div class="message-image" @click="previewImage = msg.text">
                    <img :src="msg.text" alt="Image attachment" loading="lazy" />
                  </div>
                  <a :href="msg.text" target="_blank" download class="download-btn-overlay" title="Download Image">
                    <DownloadIcon :size="16" />
                  </a>
                </div>

                <!-- Cloudinary File or Generic File Handling -->
                <div v-else-if="msg.type === 'file' || msg.text.startsWith('https://res.cloudinary.com')" class="message-file">
                   <div class="file-content-row">
                     <FileIcon :size="20" class="file-icon" />
                     <div class="file-info-compact">
                       <span class="file-name-short">{{ msg.text.split('/').pop()?.substring(0, 15) || 'File' }}...</span>
                     </div>
                     <div class="file-actions-compact">
                       <a :href="msg.text" target="_blank" download class="icon-action-btn" title="Download">
                         <DownloadIcon :size="16" />
                       </a>
                     </div>
                   </div>
                </div>

                <!-- Regular Text -->
                <p v-else>{{ msg.text }}</p>
                <div class="message-meta">
                  <span class="timestamp">{{ new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
                  <span v-if="String(msg.senderId || msg.userId) === String(authStore.user?._id) && (msg.readBy?.length ?? 0) > 1" class="read-status">✓✓</span>
                </div>
              </div>
              <button class="reply-btn-inline" @click="chatStore.setReplyTo(msg)">
                <ReplyIcon :size="14" />
              </button>
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
          <button class="close-reply" @click="chatStore.setReplyTo(null)">
            <XIcon :size="18" />
          </button>
        </div>

        <div v-if="typingText" class="typing-status-inline">
          {{ typingText }}
        </div>

        <div class="chat-input-area">
          <!-- Hidden File Input -->
          <input 
            type="file" 
            ref="fileInput" 
            style="display: none" 
            @change="handleFileChange" 
          />

          <form @submit.prevent="() => handleSendMessage()">
            <div class="input-actions-left">
              <button 
                type="button" 
                class="icon-btn" 
                @click="triggerFileInput('image')" 
                title="Send Image"
                :disabled="uploading"
              >
                <ImageIcon :size="20" />
              </button>
              <button 
                type="button" 
                class="icon-btn" 
                @click="triggerFileInput('file')" 
                title="Send File"
                :disabled="uploading"
              >
                <PaperclipIcon :size="20" />
              </button>
            </div>
            
            <input 
              type="text" 
              v-model="messageText" 
              :placeholder="uploading ? 'Uploading...' : 'Type a message...'" 
              @focus="chatStore.markAsRead(sortedMessages[sortedMessages.length-1]?._id)" 
              :disabled="uploading"
            />
            
            <button type="submit" class="btn btn-primary" :disabled="!messageText.trim() || uploading">
              <SendIcon v-if="!uploading" :size="18" />
              <span v-else>...</span>
            </button>
          </form>
        </div>
      </template>
      <div v-else class="chat-placeholder">
        <div class="placeholder-icon">
          <MessageSquareIcon :size="64" />
        </div>
        <h3>Select a chat to start messaging</h3>
        <p>Or find a friend using the + button.</p>
      </div>
    </div>

    <!-- Image Preview Modal -->
    <div v-if="previewImage" class="modal-overlay image-preview-overlay" @click="previewImage = null">
      <div class="preview-content fade-in" @click.stop>
        <img :src="previewImage" alt="Full Preview" />
        <button class="close-preview" @click="previewImage = null">
          <XIcon :size="32" />
        </button>
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
              <router-link :to="`/profile/${searchResult._id}`" class="user-details">
                <strong>{{ searchResult.username }}</strong>
                <span>{{ searchResult.phoneNumber }}</span>
              </router-link>
            </div>
            <button class="add-btn-icon" @click="handleSendRequest" title="Add Friend">+</button>
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
  flex: 1;
  overflow: hidden;
}

.name-time {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.room-name {
  font-weight: 700;
  font-size: 1.05rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.room-time {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.snippet-unread {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.last-message {
  font-size: 0.85rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.unread-dot {
  width: 10px;
  height: 10px;
  background: var(--primary-color);
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 10px var(--primary-color);
}

.room-item.is-unread .room-name {
  color: #fff;
}

.room-item.is-unread .last-message {
  color: #fff;
  font-weight: 600;
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

.chat-input-area form {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.input-actions-left {
  display: flex;
  gap: 0.25rem;
}

.icon-btn {
  background: transparent;
  border: none;
  font-size: 1.4rem;
  color: white;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 12px;
  transition: var(--transition);
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.message-bubble.is-media {
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  position: relative;
}

.message-image-container {
  position: relative;
}

.download-btn-overlay {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-size: 1rem;
  opacity: 0;
  transition: var(--transition);
}

.message-image-container:hover .download-btn-overlay {
  opacity: 1;
}

.sidebar-header {
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-box {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  opacity: 0.5;
  pointer-events: none;
}

.search-box input {
  width: 100%;
  padding: 0.75rem 0.75rem 0.75rem 2.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: white;
  font-size: 0.9rem;
  transition: var(--transition);
}

.search-box input:focus {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--primary-color);
  outline: none;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
}

.add-btn {
  width: 42px;
  height: 42px;
  background: var(--accent-gradient);
  border: none;
  border-radius: 12px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition);
  box-shadow: var(--shadow-md);
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  filter: brightness(1.1);
}

.sidebar-tabs {
  display: flex;
  padding: 0 1.5rem;
  margin-bottom: 1rem;
  gap: 0.5rem;
}

.tab-btn {
  flex: 1;
  padding: 0.6rem;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-radius: 10px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
}

.tab-btn.active {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);
}

.message-image {
  max-width: 300px;
  max-height: 400px;
  overflow: hidden;
  border-radius: 12px;
  cursor: pointer;
  transition: var(--transition);
}

.message-image:hover {
  opacity: 0.9;
}

.message-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.message-file {
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  min-width: 200px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.file-content-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.file-icon {
  color: var(--primary-color);
}

.file-info-compact {
  flex: 1;
  overflow: hidden;
}

.file-name-short {
  font-weight: 600;
  font-size: 0.85rem;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.file-actions-compact {
  display: flex;
  align-items: center;
}

.icon-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  text-decoration: none;
  transition: var(--transition);
}

.icon-action-btn:hover {
  background: var(--primary-color);
}

/* Image Preview Modal */
.image-preview-overlay {
  background: rgba(0, 0, 0, 0.95) !important;
}

.preview-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
}

.preview-content img {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.5);
}

.close-preview {
  position: absolute;
  top: -40px;
  right: -40px;
  background: transparent;
  border: none;
  color: white;
  font-size: 3rem;
  cursor: pointer;
}

.status {
  font-size: 0.85rem;
  color: #22c55e;
  font-weight: 600;
}

.typing-status-inline {
  padding: 0.25rem 2rem;
  font-size: 1rem;
  color: var(--primary-color);
  font-style: italic;
  opacity: 0.8;
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
  max-width: 500px; /* Increased width */
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
  gap: 1.25rem;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  margin-bottom: 1.5rem;
  border: 1px solid var(--border-color);
}

.user-info {
  flex: 1;
}

.user-details {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  gap: 0.25rem;
}

.user-details strong {
  font-size: 1.1rem;
}

.user-details span {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.add-btn-icon {
  background: transparent;
  border: none;
  font-size: 2.5rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.5rem;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  transition: var(--transition);
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-btn-icon:hover {
  transform: scale(1.2);
  filter: brightness(1.2);
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
