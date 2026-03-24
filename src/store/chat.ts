import { defineStore } from 'pinia';
import api from '@/api';
import { socketService } from '@/services/socket';
import { useAuthStore } from './auth';

export interface Message {
  _id: string;
  roomId: string;
  text: string;
  userId: string;
  senderId?: string; // Field to identify the sender
  createdAt: string;
  replyToId?: string;
  readBy?: string[];
  type?: 'text' | 'image' | 'file';
}

export interface Room {
  _id: string;
  participantIds: string[];
  lastMessageId?: string;
  lastMessageAt?: string;
  lastMessageContent?: string;
  lastMessageSenderId?: string;
  lastMessageReadBy?: string[];
  name?: string; // Derived from participants
  participants?: any[];
}

export interface FriendRequest {
  _id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  fromUser: {
    _id: string;
    username: string;
    phoneNumber: string;
    email: string;
  }
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    rooms: [] as Room[],
    messages: [] as Message[],
    friendRequests: [] as FriendRequest[],
    activeRoomId: null as string | null,
    loading: false,
    searchQuery: '',
    hasMore: true,
    typingUsers: {} as { [roomId: string]: { userId: string, username: string }[] },
    replyTo: null as Message | null,
  }),

  getters: {
    filteredRooms: (state) => {
      let filtered = state.rooms;
      if (state.searchQuery) {
        filtered = state.rooms.filter(room => 
          room.name?.toLowerCase().includes(state.searchQuery.toLowerCase())
        );
      }
      return [...filtered].sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA;
      });
    },
    activeRoom: (state) => state.rooms.find(r => r._id === state.activeRoomId),
    currentTypingUsers: (state) => {
      if (!state.activeRoomId) return [];
      const roomIdStr = String(state.activeRoomId);
      return state.typingUsers[roomIdStr] || [];
    },
  },

  actions: {
    async fetchRooms() {
      try {
        const response = await api.get('/rooms');
        this.rooms = response.data.data || response.data;
      } catch (err) {
        console.error('Fetch rooms error:', err);
      }
    },

    async fetchMessages(roomId: string, loadMore: boolean = false) {
      if (!loadMore) {
        this.messages = [];
        this.hasMore = true;
      }
      
      if (!this.hasMore && loadMore) return;
      
      this.loading = true;
      try {
        const limit = 30;
        const skip = loadMore ? this.messages.length : 0;
        const response = await api.get(`/messages?roomId=${roomId}&$limit=${limit}&$skip=${skip}&$sort[createdAt]=-1`);
        const newMessages = response.data.data || response.data;
        
        if (newMessages.length < limit) {
          this.hasMore = false;
        }

        if (loadMore) {
          this.messages = [...this.messages, ...newMessages];
        } else {
          this.messages = newMessages;
        }
      } catch (err) {
        console.error('Fetch messages error:', err);
      } finally {
        this.loading = false;
      }
    },

    async sendMessage(roomId: string, text: string, replyToId?: string, type: 'text' | 'image' | 'file' = 'text') {
      try {
        const payload: any = { roomId, text, type };
        if (replyToId) payload.replyToId = replyToId;
        console.log('📤 Sending message payload:', payload);
        await api.post('/messages', payload);
        this.replyTo = null; // Clear reply after send
      } catch (err) {
        console.error('Send message error:', err);
      }
    },

    async markAsRead(messageId: string) {
      try {
        await api.patch(`/messages/${messageId}`, { isSeen: true });
      } catch (err) {
        console.error('Mark as read error:', err);
      }
    },

    sendTyping(roomId: string, isTyping: boolean) {
      const method = isTyping ? 'typing' : 'stopTyping';
      // Use standard Feathers method call format for custom methods
      socketService.emit(method, 'messages', { roomId });
    },

    setReplyTo(message: Message | null) {
      this.replyTo = message;
    },

    async findUserByPhone(phone: string) {
      try {
        const response = await api.get(`/users?phoneNumber=${phone}`);
        return response.data.data?.[0] || response.data?.[0] || null;
      } catch (err) {
        console.error('Find user error:', err);
      }
    },

    async sendFriendRequest(toUserId: string) {
      try {
        const authStore = useAuthStore();
        const fromUserId = authStore.user?._id;
        console.log(fromUserId);
        await api.post('/friend-requests', { toUserId, fromUserId });
      } catch (err) {
        console.error('Send friend request error:', err);
      }
    },

    async handleFriendRequest(requestId: string, status: 'accepted' | 'rejected') {
      try {
        await api.patch(`/friend-requests/${requestId}`, { status });
      } catch (err) {
        console.error('Handle friend request error:', err);
      }
    },

    // Handlers for Socket events
    addMessage(message: Message) {
      console.log('📬 addMessage called with:', message);
      console.log('Current activeRoomId:', this.activeRoomId);
      
      // Defensive check: ensure both are strings for comparison
      if (String(this.activeRoomId) === String(message.roomId)) {
        console.log('✅ Room match! Pushing message.');
        // Avoid duplicates if any
        if (!this.messages.some(m => m._id === message._id)) {
          this.messages.unshift(message);
        }
        // If I'm viewing this room, marks as read automatically
        this.markAsRead(message._id);
      } else {
        console.warn('❌ Room ID mismatch. Message roomId:', message.roomId, 'ActiveRoomId:', this.activeRoomId);
      }
      
      // Update room's last message and potentially move to top
      const roomIdx = this.rooms.findIndex(r => r._id === message.roomId);
      if (roomIdx !== -1) {
        this.rooms[roomIdx].lastMessageId = message._id;
        this.rooms[roomIdx].lastMessageContent = message.text;
        this.rooms[roomIdx].lastMessageSenderId = message.senderId || message.userId;
        this.rooms[roomIdx].lastMessageReadBy = message.readBy || [];
        this.rooms[roomIdx].lastMessageAt = message.createdAt;

        // Optionally move room to top of list as it has new activity
        const room = this.rooms.splice(roomIdx, 1)[0];
        this.rooms.unshift(room);
      }
    },

    updateMessage(message: Message) {
       const idx = this.messages.findIndex(m => m._id === message._id);
       if (idx !== -1) {
         this.messages[idx] = message;
       }
    },

    handleTyping(data: { roomId: string, userId: string, username: string }, isTyping: boolean) {
      const authStore = useAuthStore();
      // Ignore our own typing events
      if (String(data.userId) === String(authStore.user?._id)) return;

      console.log(`👤 User ${data.username} (${data.userId}) is ${isTyping ? 'typing' : 'stopped typing'} in room ${data.roomId}`);

      const roomIdStr = String(data.roomId);
      const currentUsers = this.typingUsers[roomIdStr] || [];
      let newUsers: { userId: string, username: string }[];

      if (isTyping) {
        newUsers = currentUsers.some(u => u.userId === data.userId) 
          ? currentUsers 
          : [...currentUsers, { userId: data.userId, username: data.username }];
      } else {
        newUsers = currentUsers.filter(u => u.userId !== data.userId);
      }

      // Replace the object with String key to ensure Pinia/Vue reactivity detects the change
      this.typingUsers = {
        ...this.typingUsers,
        [roomIdStr]: newUsers
      };
    },

    addRoom(room: Room) {
      this.rooms.unshift(room);
    },

    updateRoom(room: Room) {
      const idx = this.rooms.findIndex(r => r._id === room._id);
      if (idx !== -1) {
        // Merge the update into existing room
        this.rooms[idx] = { ...this.rooms[idx], ...room };
      }
    },

    addFriendRequest(request: FriendRequest) {
      this.friendRequests.push(request);
    },

    updateFriendRequest(request: FriendRequest) {
      const idx = this.friendRequests.findIndex(r => r._id === request._id);
      if (idx !== -1) {
        this.friendRequests[idx] = request;
      }
    },

    setupSocket() {
      socketService.connect();

      // Explicitly authenticate socket to join channels defined in channels.ts
      const authStore = useAuthStore();
      const token = (authStore as any).accessToken || (authStore as any).token || document.cookie.split('accessToken=')[1]?.split(';')[0];
      
      if (token) {
        console.log('🔑 Authenticating socket...');
        socketService.emit('create', 'authentication', {
          strategy: 'jwt',
          accessToken: token
        });
      }

      socketService.on('messages created', (msg: Message) => {
        console.log('📩 Message received via socket:', msg);
        this.addMessage(msg);
      });
      
      socketService.on('messages patched', (msg: Message) => this.updateMessage(msg));
      socketService.on('messages typing', (data: any) => this.handleTyping(data, true));
      socketService.on('messages stopTyping', (data: any) => this.handleTyping(data, false));
      
      socketService.on('rooms created', (room: Room) => this.addRoom(room));
      socketService.on('rooms patched', (room: Room) => this.updateRoom(room));
      socketService.on('friend-requests created', (req: FriendRequest) => this.addFriendRequest(req));
      socketService.on('friend-requests patched', (req: FriendRequest) => this.updateFriendRequest(req));
      
      socketService.on('authenticated', (result: any) => {
        console.log('🚀 Socket authenticated successfully:', result);
      });
    },

    cleanupSocket() {
      socketService.disconnect();
    }
  },
});
