type WebSocketListener = (data: any) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<WebSocketListener>> = new Map();
  private reconnectTimeout: any = null;
  private pingInterval: any = null;
  private token: string | null = null;

  connect(token?: string) {
    if (token) this.token = token;
    if (!this.token && typeof localStorage !== 'undefined') {
      this.token = localStorage.getItem('pairly_token');
    }

    // Do not attempt connection if unauthenticated
    if (!this.token) {
      return;
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws?token=${encodeURIComponent(this.token)}`;

    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        if (this.token) {
          this.send('AUTH', { token: this.token });
        }

        // Setup ping interval
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.send('PING', {});
          }
        }, 25000);
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, payload } = message;
          this.emit(type, payload);
        } catch (err) {
          console.debug('[WS] Parse notice:', err);
        }
      };

      this.socket.onclose = (event) => {
        this.cleanup();
        // If auth failed or manually closed, don't continuously reconnect
        const isAuthError = event.code === 4001 || event.code === 4002 || event.code === 4003;
        if (this.token && !isAuthError && event.code !== 1000) {
          this.reconnectTimeout = setTimeout(() => {
            if (this.token) this.connect();
          }, 3000);
        }
      };

      this.socket.onerror = (err) => {
        // WebSocket error event contains generic { isTrusted: true } in browsers
        console.debug('[WS] Socket event:', err);
      };
    } catch (err) {
      console.debug('[WS] Socket initialization notice:', err);
    }
  }

  send(type: string, payload: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
    }
  }

  on(event: string, listener: WebSocketListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  off(event: string, listener: WebSocketListener) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
    }
  }

  private emit(event: string, data: any) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(data);
        } catch (err) {
          console.error(`[WS] Error in event listener for ${event}:`, err);
        }
      });
    }
  }

  disconnect() {
    this.token = null;
    this.cleanup();
    if (this.socket) {
      try {
        this.socket.close(1000, 'User logged out');
      } catch {}
      this.socket = null;
    }
  }

  private cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

export const wsClient = new WebSocketClient();
