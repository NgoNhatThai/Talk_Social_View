import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3030';

class SocketService {
  public socket: Socket | null = null;

  connect() {
    const token = Cookies.get('accessToken');
    if (!token) return;

    this.socket = io(SOCKET_URL, {
      auth: {
        strategy: 'jwt',
        accessToken: token,
      },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to Socket.io with ID:', this.socket?.id);
    });

    this.socket.onAny((event, ...args) => {
      console.log(`🌐 Global Socket Event: "${event}"`, args);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Socket.io. Reason:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('⚠️ Socket connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Manually disconnecting socket...');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.socket) {
      console.warn(`Attempted to listen to event "${event}" but socket is not connected.`);
    }
    this.socket?.on(event, (...args: any[]) => {
      console.log(`📩 Received socket event: "${event}"`, args);
      // Automatically unwrap data if it was wrapped by the backend's wrapResult hook
      const unwrappedArgs = args.map(arg => {
        if (arg && typeof arg === 'object' && arg.status && arg.data !== undefined) {
          return arg.data;
        }
        return arg;
      });
      callback(...unwrappedArgs);
    });
  }

  off(event: string) {
    console.log(`🔇 Stopped listening to event: "${event}"`);
    this.socket?.off(event);
  }

  emit(event: string, ...args: any[]) {
    console.log(`📤 Emitting socket event: "${event}"`, ...args);
    this.socket?.emit(event, ...args);
  }
}

export const socketService = new SocketService();
