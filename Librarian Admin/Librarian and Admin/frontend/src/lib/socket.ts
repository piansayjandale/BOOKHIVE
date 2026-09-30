import { publishActivity } from "./live";
import { BACKEND_URL } from "./config";

export type SocketCallback = (data: any) => void;

class DashboardSocketService {
  private socket: any = null;
  private borrowListeners: Set<SocketCallback> = new Set();
  private bookAddedListeners: Set<SocketCallback> = new Set();
  private returnListeners: Set<SocketCallback> = new Set();
  private cancelListeners: Set<SocketCallback> = new Set();
  private notificationListeners: Set<SocketCallback> = new Set();
  private telemetryListeners: Set<SocketCallback> = new Set();
  private catalogListeners: Set<SocketCallback> = new Set();
  private userMutationListeners: Set<SocketCallback> = new Set();
  private connectionListeners: Set<(connected: boolean) => void> = new Set();

  private activeRooms: Set<string> = new Set();
  private isConnected: boolean = false;
  private reconnectTimeout: any = null;
  private reconnectDelay: number = 1000;
  private readonly maxReconnectDelay: number = 16000;
  private isDestroyed: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.activeRooms.add("room:circulation-desk");
      this.init();
      this.setupVisibilityListener();
    }
  }

  private init() {
    if (typeof window === "undefined" || this.isDestroyed) return;

    try {
      const io = (window as any).io;
      const backendUrl = BACKEND_URL;

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
          this.rejoinRooms();
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
        this.rejoinRooms();
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
    const handleTransactionUpdated = (data: any) => this.routeIncomingEvent("transaction:updated", data);
    const handleBookReturned = (data: any) => this.routeIncomingEvent("book:returned", data);
    const handleTelemetryUpdated = (data: any) => this.routeIncomingEvent("telemetry:updated", data);
    const handleCatalogUpdated = (data: any) => this.routeIncomingEvent("catalog:updated", data);
    const handleUserMutated = (data: any) => this.routeIncomingEvent("user:mutated", data);
    const handleSearchQuery = (data: any) => this.routeIncomingEvent("search:query", data);

    socket.on("borrow:request", handleIncomingRequest);
    socket.on("reservation:request", handleIncomingRequest);
    socket.on("notification:new", handleGenericNotification);
    socket.on("reservation:cancelled", handleCancelledRequest);
    socket.on("transaction:cancelled", handleCancelledRequest);
    socket.on("RESERVATION_CANCELLED", handleCancelledRequest);
    socket.on("transaction:updated", handleTransactionUpdated);
    socket.on("transaction:decided", handleTransactionDecided);
    socket.on("transaction:returned", handleBookReturned);
    socket.on("book:returned", handleBookReturned);
    socket.on("telemetry:updated", handleTelemetryUpdated);
    socket.on("catalog:updated", handleCatalogUpdated);
    socket.on("user:mutated", handleUserMutated);
    socket.on("search:query", handleSearchQuery);

    socket.on("book:added", (data: any) => {
      this.routeIncomingEvent("book:added", data);
    });
  }

  private routeIncomingEvent(eventName: string, eventData: any) {
    console.log(`[DashboardSocket] Routing event: ${eventName}`, eventData);

    const isBorrow = (eventData?.type || eventData?.action) !== "Reservation";
    const verb = isBorrow ? "borrow" : "reserve";

    // 1. Direct Return Events or Decided/Updated with status 'Returned'
    const isReturned =
      eventName === "book:returned" ||
      eventName === "transaction:returned" ||
      ((eventName === "transaction:decided" || eventName === "transaction:updated") &&
        String(eventData?.status || "").toLowerCase() === "returned");

    if (isReturned) {
      publishActivity({
        id: `act-${Date.now()}`,
        timestamp: "Just now",
        message: `${eventData?.studentName || "Student"} returned '${eventData?.resourceTitle || eventData?.title || "Book"}'`,
        level: "success",
      });
      const payload = { ...eventData, status: "Returned", eventName: "book:returned" };
      this.returnListeners.forEach((cb) => cb(payload));
      this.borrowListeners.forEach((cb) => cb(payload));
      this.notificationListeners.forEach((cb) => cb(payload));
      return;
    }

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
      ((eventName === "transaction:updated" || eventName === "transaction:decided") &&
        String(eventData?.status || "").toLowerCase() === "cancelled")
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
    } else if (eventName === "transaction:decided" || eventName === "transaction:updated") {
      this.notificationListeners.forEach((cb) => cb({ ...eventData, eventName }));
      this.borrowListeners.forEach((cb) => cb(eventData));
      if (String(eventData?.status || "").toLowerCase() === "declined") {
        this.cancelListeners.forEach((cb) => cb(eventData));
      }
    } else if (eventName === "book:added") {
      this.bookAddedListeners.forEach((cb) => cb(eventData));
      this.catalogListeners.forEach((cb) => cb(eventData));
    } else if (eventName === "catalog:updated") {
      this.catalogListeners.forEach((cb) => cb(eventData));
    } else if (eventName === "user:mutated") {
      this.userMutationListeners.forEach((cb) => cb(eventData));
    } else if (eventName === "telemetry:updated" || eventName === "search:query") {
      this.telemetryListeners.forEach((cb) => cb(eventData));
    }
  }

  private emitEvent(eventName: string, data: any) {
    if (!this.socket) return;
    try {
      if (typeof this.socket.emit === "function") {
        this.socket.emit(eventName, data);
      } else if (typeof this.socket.send === "function" && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send("42" + JSON.stringify([eventName, data]));
      }
    } catch (e) {
      console.warn(`[DashboardSocket] Failed to emit event ${eventName}:`, e);
    }
  }

  public joinRoom(roomName: string) {
    this.activeRooms.add(roomName);
    this.emitEvent("join:room", roomName);
  }

  public leaveRoom(roomName: string) {
    this.activeRooms.delete(roomName);
    this.emitEvent("leave:room", roomName);
  }

  private rejoinRooms() {
    this.activeRooms.forEach((room) => {
      this.emitEvent("join:room", room);
    });
  }

  public subscribeToTelemetry(cb: SocketCallback) {
    this.telemetryListeners.add(cb);
    return () => {
      this.telemetryListeners.delete(cb);
    };
  }

  public subscribeToCatalog(cb: SocketCallback) {
    this.catalogListeners.add(cb);
    return () => {
      this.catalogListeners.delete(cb);
    };
  }

  public subscribeToUserMutation(cb: SocketCallback) {
    this.userMutationListeners.add(cb);
    return () => {
      this.userMutationListeners.delete(cb);
    };
  }

  public subscribeToBorrowRequest(cb: SocketCallback) {
    this.borrowListeners.add(cb);
    return () => {
      this.borrowListeners.delete(cb);
    };
  }

  public subscribeToReturn(cb: SocketCallback) {
    this.returnListeners.add(cb);
    return () => {
      this.returnListeners.delete(cb);
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
    this.emitEvent("book:added", bookData);
  }

  public publishBorrowRequest(borrowData: any) {
    this.emitEvent("borrow:request", borrowData);
  }

  public publishBookReturned(returnData: any) {
    this.emitEvent("book:returned", returnData);
    this.emitEvent("transaction:returned", returnData);
  }

  public emitSearchQuery(searchData: any) {
    this.emitEvent("search:query", searchData);
  }

  public getConnected(): boolean {
    return this.isConnected;
  }
}

export const dashboardSocket = new DashboardSocketService();
export default dashboardSocket;
