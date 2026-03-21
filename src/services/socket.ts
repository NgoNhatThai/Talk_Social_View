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
      console.log('Connected to Socket.io');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from Socket.io');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string) {
    this.socket?.off(event);
  }

  emit(event: string, data: any) {
    this.socket?.emit(event, data);
  }
}

export const socketService = new SocketService();
