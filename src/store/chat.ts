import { defineStore } from 'pinia';
import api from '@/api';
import { socketService } from '@/services/socket';

export interface Message {
  _id: string;
  roomId: string;
  text: string;
  userId: string;
  createdAt: string;
  replyToId?: string;
  readBy?: string[];
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
    typingUsers: {} as { [roomId: string]: string[] },
    replyTo: null as Message | null,
  }),

  getters: {
    filteredRooms: (state) => {
      if (!state.searchQuery) return state.rooms;
      return state.rooms.filter(room => 
        room.name?.toLowerCase().includes(state.searchQuery.toLowerCase())
      );
    },
    activeRoom: (state) => state.rooms.find(r => r._id === state.activeRoomId),
    currentTypingUsers: (state) => state.activeRoomId ? state.typingUsers[state.activeRoomId] || [] : [],
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

    async sendMessage(roomId: string, text: string, replyToId?: string) {
      try {
        const payload: any = { roomId, text };
        if (replyToId) payload.replyToId = replyToId;
        await api.post('/messages', payload);
        this.replyTo = null; // Clear reply after send
      } catch (err) {
        console.error('Send message error:', err);
      }
    },

    async markAsRead(messageId: string) {
      try {
        await api.patch(`/messages/${messageId}`, { readBy: [] });
      } catch (err) {
        console.error('Mark as read error:', err);
      }
    },

    sendTyping(roomId: string, isTyping: boolean) {
      const event = isTyping ? 'typing' : 'stopTyping';
      socketService.emit(`messages ${event}`, { roomId });
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
        await api.post('/friend-requests', { toUserId });
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
      if (this.activeRoomId === message.roomId) {
        this.messages.push(message);
        // If I'm viewing this room, marks as read automatically
        this.markAsRead(message._id);
      }
      // Update room's last message
      const room = this.rooms.find(r => r._id === message.roomId);
      if (room) room.lastMessageId = message._id;
    },

    updateMessage(message: Message) {
       const idx = this.messages.findIndex(m => m._id === message._id);
       if (idx !== -1) {
         this.messages[idx] = message;
       }
    },

    handleTyping(data: { roomId: string, userId: string }, isTyping: boolean) {
      if (!this.typingUsers[data.roomId]) this.typingUsers[data.roomId] = [];
      const users = this.typingUsers[data.roomId];
      if (isTyping) {
        if (!users.includes(data.userId)) users.push(data.userId);
      } else {
        this.typingUsers[data.roomId] = users.filter(id => id !== data.userId);
      }
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
      socketService.on('messages patched', (msg: Message) => this.updateMessage(msg));
      socketService.on('messages typing', (data: any) => this.handleTyping(data, true));
      socketService.on('messages stopTyping', (data: any) => this.handleTyping(data, false));
      
      socketService.on('rooms created', (room: Room) => this.addRoom(room));
      socketService.on('friend-requests created', (req: FriendRequest) => this.addFriendRequest(req));
      socketService.on('friend-requests patched', (req: FriendRequest) => this.updateFriendRequest(req));
    },

    cleanupSocket() {
      socketService.disconnect();
    }
  },
});
