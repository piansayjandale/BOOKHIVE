import { publishActivity } from "./live";

export type SocketCallback = (data: any) => void;

class DashboardSocketService {
  private socket: any = null;
  private borrowListeners: Set<SocketCallback> = new Set();
  private bookAddedListeners: Set<SocketCallback> = new Set();
  private cancelListeners: Set<SocketCallback> = new Set();
  private notificationListeners: Set<SocketCallback> = new Set();
  private connectionListeners: Set<(connected: boolean) => void> = new Set();

  private isConnected: boolean = false;
  private reconnectTimeout: any = null;
  private reconnectDelay: number = 1000;
  private readonly maxReconnectDelay: number = 16000;
  private isDestroyed: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.init();
      this.setupVisibilityListener();
    }
  }

  private init() {
    if (typeof window === "undefined" || this.isDestroyed) return;

    try {
      const io = (window as any).io;
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      if (io) {
        this.socket = io(backendUrl, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
        });

        this.socket.on("connect", () => {
          console.log("[DashboardSocket] Connected to Express Socket.io backend via io client");
          this.setConnected(true);
        });

        this.socket.on("disconnect", (reason: string) => {
          console.log(`[DashboardSocket] Disconnected (${reason})`);
          this.setConnected(false);
        });

        this.socket.on("connect_error", (err: any) => {
          console.warn("[DashboardSocket] Connect error:", err?.message || err);
          this.setConnected(false);
        });

        this.attachEventHandlers(this.socket);
      } else {
        // Resilient Engine.IO v4 WebSocket implementation
        this.connectNativeWebSocket(backendUrl);
      }
    } catch (e) {
      console.warn("[DashboardSocket] Backend socket initialization warning:", e);
      this.scheduleReconnect();
    }
  }

  private connectNativeWebSocket(backendUrl: string) {
    if (this.isDestroyed) return;

    try {
      const wsUrl = backendUrl.replace(/^http/, "ws");
      const ws = new WebSocket(`${wsUrl}/socket.io/?EIO=4&transport=websocket`);

      ws.onopen = () => {
        console.log("[DashboardSocket] Native WebSocket transport connected");
        // Send Engine.IO connect to default namespace '/'
        try {
          ws.send("40");
        } catch (err) {
          console.warn("[DashboardSocket] Failed to send handshake:", err);
        }
        this.setConnected(true);
        this.reconnectDelay = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const str = event.data.toString();

          // Engine.IO Heartbeat PING ('2') -> reply with PONG ('3')
          if (str === "2") {
            ws.send("3");
            return;
          }

          // Engine.IO Handshake response packet
          if (str.startsWith("0")) {
            // Send namespace connect packet '40'
            ws.send("40");
            return;
          }

          // Engine.IO Message ('42' prefix for Socket.IO event)
          if (str.startsWith("42")) {
            const payload = JSON.parse(str.substring(2));
            const eventName = payload[0];
            const eventData = payload[1];

            this.routeIncomingEvent(eventName, eventData);
          }
        } catch (e) {
          // Ignore invalid packet parses
        }
      };

      ws.onerror = (e) => {
        console.warn("[DashboardSocket] WebSocket transport error, degrading gracefully");
        this.setConnected(false);
      };

      ws.onclose = (event) => {
        console.log(`[DashboardSocket] WebSocket transport closed (code: ${event.code})`);
        this.setConnected(false);
        this.scheduleReconnect();
      };

      this.socket = ws;
    } catch (error) {
      console.warn("[DashboardSocket] Native WebSocket offline:", error);
      this.setConnected(false);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isDestroyed) return;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log(`[DashboardSocket] Attempting reconnection (delay: ${this.reconnectDelay}ms)...`);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.init();
    }, this.reconnectDelay);
  }

  private setConnected(connected: boolean) {
    this.isConnected = connected;
    this.connectionListeners.forEach((cb) => {
      try {
        cb(connected);
      } catch (err) {
        console.warn("[DashboardSocket] Connection listener error:", err);
      }
    });
  }

  private setupVisibilityListener() {
    if (typeof document === "undefined") return;

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        if (!this.isConnected) {
          console.log("[DashboardSocket] Page became visible, reconnecting socket...");
          this.reconnectDelay = 1000;
          this.init();
        }
      }
    });
  }

  private attachEventHandlers(socket: any) {
    const handleIncomingRequest = (data: any) => this.routeIncomingEvent("borrow:request", data);
    const handleCancelledRequest = (data: any) => this.routeIncomingEvent("reservation:cancelled", data);
    const handleGenericNotification = (data: any) => this.routeIncomingEvent("notification:new", data);
    const handleTransactionDecided = (data: any) => this.routeIncomingEvent("transaction:decided", data);

    socket.on("borrow:request", handleIncomingRequest);
    socket.on("reservation:request", handleIncomingRequest);
    socket.on("notification:new", handleGenericNotification);
    socket.on("reservation:cancelled", handleCancelledRequest);
    socket.on("transaction:cancelled", handleCancelledRequest);
    socket.on("RESERVATION_CANCELLED", handleCancelledRequest);
    socket.on("transaction:updated", handleCancelledRequest);
    socket.on("transaction:decided", handleTransactionDecided);

    socket.on("book:added", (data: any) => {
      this.routeIncomingEvent("book:added", data);
    });
  }

  private routeIncomingEvent(eventName: string, eventData: any) {
    console.log(`[DashboardSocket] Routing event: ${eventName}`, eventData);

    const isBorrow = (eventData?.type || eventData?.action) !== "Reservation";
    const verb = isBorrow ? "borrow" : "reserve";

    if (eventName === "borrow:request" || eventName === "reservation:request") {
      publishActivity({
        id: `act-${Date.now()}`,
        timestamp: "Just now",
        message: `${eventData?.studentName || "Student"} submitted ${verb} request for '${eventData?.resourceTitle || eventData?.title || "Book"}'`,
        level: "warning",
      });
      this.borrowListeners.forEach((cb) => cb(eventData));
      this.notificationListeners.forEach((cb) => cb({ ...eventData, eventName }));
    } else if (
      eventName === "reservation:cancelled" ||
      eventName === "transaction:cancelled" ||
      eventName === "RESERVATION_CANCELLED" ||
      eventName === "transaction:updated"
    ) {
      publishActivity({
        id: `act-${Date.now()}`,
        timestamp: "Just now",
        message: `Student ${eventData?.studentName || "Student"} cancelled reservation for '${eventData?.resourceTitle || eventData?.title || "Book"}'`,
        level: "warning",
      });
      this.cancelListeners.forEach((cb) => cb(eventData));
      this.borrowListeners.forEach((cb) => cb(eventData));
      this.notificationListeners.forEach((cb) => cb({ ...eventData, eventName, isCancelled: true }));
    } else if (eventName === "notification:new") {
      this.notificationListeners.forEach((cb) => cb({ ...eventData, eventName }));
      this.borrowListeners.forEach((cb) => cb(eventData));
    } else if (eventName === "transaction:decided") {
      this.notificationListeners.forEach((cb) => cb({ ...eventData, eventName }));
      this.cancelListeners.forEach((cb) => cb(eventData));
    } else if (eventName === "book:added") {
      this.bookAddedListeners.forEach((cb) => cb(eventData));
    }
  }

  public subscribeToBorrowRequest(cb: SocketCallback) {
    this.borrowListeners.add(cb);
    return () => {
      this.borrowListeners.delete(cb);
    };
  }

  public subscribeToCancelRequest(cb: SocketCallback) {
    this.cancelListeners.add(cb);
    return () => {
      this.cancelListeners.delete(cb);
    };
  }

  public subscribeToNotification(cb: SocketCallback) {
    this.notificationListeners.add(cb);
    return () => {
      this.notificationListeners.delete(cb);
    };
  }

  public subscribeToBookAdded(cb: SocketCallback) {
    this.bookAddedListeners.add(cb);
    return () => {
      this.bookAddedListeners.delete(cb);
    };
  }

  public subscribeToConnection(cb: (connected: boolean) => void) {
    this.connectionListeners.add(cb);
    cb(this.isConnected);
    return () => {
      this.connectionListeners.delete(cb);
    };
  }

  public publishBookAdded(bookData: any) {
    if (this.socket && typeof this.socket.emit === "function") {
      this.socket.emit("book:added", bookData);
    }
  }

  public publishBorrowRequest(borrowData: any) {
    if (this.socket && typeof this.socket.emit === "function") {
      this.socket.emit("borrow:request", borrowData);
    }
  }

  public getConnected(): boolean {
    return this.isConnected;
  }
}

export const dashboardSocket = new DashboardSocketService();
export default dashboardSocket;
