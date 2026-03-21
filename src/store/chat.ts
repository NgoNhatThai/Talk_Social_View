import { defineStore } from 'pinia';
import api from '@/api';
import { socketService } from '@/services/socket';

export interface Message {
  _id: string;
  roomId: string;
  text: string;
  userId: string;
  createdAt: string;
}

export interface Room {
  _id: string;
  participantIds: string[];
  lastMessageId?: string;
  name?: string; // Derived from participants
  participants?: any[];
}

export interface FriendRequest {
  _id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    rooms: [] as Room[],
    messages: [] as Message[],
    friendRequests: [] as FriendRequest[],
    activeRoomId: null as string | null,
    loading: false,
    searchQuery: '',
  }),

  getters: {
    filteredRooms: (state) => {
      if (!state.searchQuery) return state.rooms;
      return state.rooms.filter(room => 
        room.name?.toLowerCase().includes(state.searchQuery.toLowerCase())
      );
    },
    activeRoom: (state) => state.rooms.find(r => r._id === state.activeRoomId),
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

    async fetchMessages(roomId: string) {
      try {
        const response = await api.get(`/messages?roomId=${roomId}`);
        this.messages = response.data.data || response.data;
      } catch (err) {
        console.error('Fetch messages error:', err);
      }
    },

    async sendMessage(roomId: string, text: string) {
      try {
        await api.post('/messages', { roomId, text });
      } catch (err) {
        console.error('Send message error:', err);
      }
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
        await api.post('/friend-requests', { toUserId });
      } catch (err) {
        console.error('Send friend request error:', err);
      }
    },

    async handleFriendRequest(requestId: string, status: 'accepted' | 'rejected') {
      try {
        await api.patch(`/friend-requests/${requestId}`, { status });
        // After accepting, we usually wait for 'rooms created' socket event
      } catch (err) {
        console.error('Handle friend request error:', err);
      }
    },

    // Handlers for Socket events
    addMessage(message: Message) {
      if (this.activeRoomId === message.roomId) {
        this.messages.push(message);
      }
      // Update room's last message
      const room = this.rooms.find(r => r._id === message.roomId);
      if (room) room.lastMessageId = message._id;
    },

    addRoom(room: Room) {
      this.rooms.unshift(room);
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
      socketService.on('messages created', (msg: Message) => this.addMessage(msg));
      socketService.on('rooms created', (room: Room) => this.addRoom(room));
      socketService.on('friend-requests created', (req: FriendRequest) => this.addFriendRequest(req));
      socketService.on('friend-requests patched', (req: FriendRequest) => this.updateFriendRequest(req));
    },

    cleanupSocket() {
      socketService.disconnect();
    }
  },
});
