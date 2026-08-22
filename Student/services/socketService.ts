import { API_URL } from "../data/authService";

type BookAddedCallback = (book: any) => void;
type BorrowRequestCallback = (borrowData: any) => void;
type TransactionDecidedCallback = (txData: any) => void;
type SocketCallback = (data: any) => void;

class SocketService {
  private socket: any = null;
  private bookAddedListeners: Set<BookAddedCallback> = new Set();
  private borrowListeners: Set<BorrowRequestCallback> = new Set();
  private transactionDecidedListeners: Set<TransactionDecidedCallback> = new Set();
  private catalogListeners: Set<SocketCallback> = new Set();
  private activeRooms: Set<string> = new Set();
  private isConnected: boolean = false;

  constructor() {
    this.connect();
  }

  public connect() {
    if (this.socket) return;

    try {
      // Dynamic import or check global socket.io client compatible with Expo Snack
      const io = (globalThis as any).io || null;

      if (io) {
        this.socket = io(API_URL, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 5,
        });

        this.socket.on("connect", () => {
          console.log("[SocketService] Connected to BookHive Real-time Socket Gateway");
          this.isConnected = true;
          this.rejoinRooms();
        });

        this.socket.on("book:added", (book: any) => {
          console.log("[SocketService] Received book:added event:", book?.title);
          this.notifyBookAdded(book);
        });

        this.socket.on("catalog:updated", (data: any) => {
          console.log("[SocketService] Received catalog:updated event:", data);
          this.notifyCatalogUpdated(data);
        });

        this.socket.on("borrow:request", (data: any) => {
          console.log("[SocketService] Received borrow:request event:", data);
          this.notifyBorrowRequest(data);
        });

        this.socket.on("transaction:decided", (data: any) => {
          console.log("[SocketService] Received transaction:decided event:", data);
          this.notifyTransactionDecided(data);
        });

        this.socket.on("transaction:updated", (data: any) => {
          console.log("[SocketService] Received transaction:updated event:", data);
          this.notifyTransactionDecided(data);
        });

        this.socket.on("borrow:decided", (data: any) => {
          console.log("[SocketService] Received borrow:decided event:", data);
          this.notifyTransactionDecided(data);
        });

        this.socket.on("student:notification", (data: any) => {
          console.log("[SocketService] Received student:notification event:", data);
          this.notifyTransactionDecided(data);
        });

        this.socket.on("loan:status-changed", (data: any) => {
          console.log("[SocketService] Received loan:status-changed event:", data);
          this.notifyTransactionDecided(data);
        });

        this.socket.on("disconnect", () => {
          console.log("[SocketService] Socket disconnected");
          this.isConnected = false;
        });
      } else {
        // Fallback using standard native WebSocket for Expo Snack / Web environment
        this.connectNativeWebSocket();
      }
    } catch (err) {
      console.warn("[SocketService] Failed to initialize Socket.io, degrading gracefully:", err);
    }
  }

  private connectNativeWebSocket() {
    try {
      const wsUrl = API_URL.replace(/^http/, "ws");
      const ws = new WebSocket(`${wsUrl}/socket.io/?EIO=4&transport=websocket`);

      ws.onopen = () => {
        console.log("[SocketService] Native WebSocket Connected");
        this.isConnected = true;
        this.rejoinRooms();
      };

      ws.onmessage = (event) => {
        try {
          // Parse socket.io engine message frame
          const dataStr = event.data.toString();
          if (dataStr.startsWith("42")) {
            const payload = JSON.parse(dataStr.substring(2));
            const eventName = payload[0];
            const eventData = payload[1];

            if (eventName === "book:added") {
              this.notifyBookAdded(eventData);
            } else if (eventName === "catalog:updated") {
              this.notifyCatalogUpdated(eventData);
            } else if (eventName === "borrow:request" || eventName === "reservation:request") {
              this.notifyBorrowRequest(eventData);
            } else if (
              eventName === "transaction:decided" ||
              eventName === "transaction:updated" ||
              eventName === "borrow:decided" ||
              eventName === "student:notification" ||
              eventName === "loan:status-changed"
            ) {
              this.notifyTransactionDecided(eventData);
            }
          }
        } catch (e) {
          // Silent catch for invalid frame format
        }
      };

      ws.onerror = (e) => {
        console.log("[SocketService] WebSocket offline, running in cached mode.");
      };

      this.socket = ws;
    } catch (error) {
      console.log("[SocketService] Offline fallback active.");
    }
  }

  public joinRoom(roomName: string) {
    this.activeRooms.add(roomName);
    if (this.socket && typeof this.socket.emit === "function") {
      this.socket.emit("join:room", roomName);
    }
  }

  public joinUserRoom(userId: string) {
    if (!userId) return;
    const roomName = `room:user-notifications:${userId}`;
    this.joinRoom(roomName);
  }

  private rejoinRooms() {
    this.activeRooms.forEach((room) => {
      if (this.socket && typeof this.socket.emit === "function") {
        this.socket.emit("join:room", room);
      }
    });
  }

  public subscribeToBookAdded(callback: BookAddedCallback) {
    this.bookAddedListeners.add(callback);
    return () => {
      this.bookAddedListeners.delete(callback);
    };
  }

  public subscribeToCatalogUpdates(callback: SocketCallback) {
    this.catalogListeners.add(callback);
    return () => {
      this.catalogListeners.delete(callback);
    };
  }

  public subscribeToBorrowRequest(callback: BorrowRequestCallback) {
    this.borrowListeners.add(callback);
    return () => {
      this.borrowListeners.delete(callback);
    };
  }

  public subscribeToTransactionDecided(callback: TransactionDecidedCallback) {
    this.transactionDecidedListeners.add(callback);
    return () => {
      this.transactionDecidedListeners.delete(callback);
    };
  }

  public notifyBookAdded(book: any) {
    this.bookAddedListeners.forEach((cb) => {
      try {
        cb(book);
      } catch (e) {
        console.warn("[SocketService] Listener error:", e);
      }
    });
  }

  public notifyCatalogUpdated(data: any) {
    this.catalogListeners.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.warn("[SocketService] Listener error:", e);
      }
    });
  }

  public notifyBorrowRequest(data: any) {
    this.borrowListeners.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.warn("[SocketService] Listener error:", e);
      }
    });
  }

  public notifyTransactionDecided(data: any) {
    this.transactionDecidedListeners.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.warn("[SocketService] Listener error:", e);
      }
    });
  }

  public emitBorrowRequest(borrowData: any) {
    if (this.socket && typeof this.socket.emit === "function") {
      this.socket.emit("borrow:request", borrowData);
    }
  }

  public emitReservationCancelled(cancelData: any) {
    if (this.socket && typeof this.socket.emit === "function") {
      this.socket.emit("reservation:cancelled", cancelData);
    }
  }

  public emitBookAdded(bookData: any) {
    if (this.socket && typeof this.socket.emit === "function") {
      this.socket.emit("book:added", bookData);
    }
  }

  public emitSearchQuery(searchQuery: string, extraData: any = {}) {
    if (this.socket && typeof this.socket.emit === "function") {
      this.socket.emit("search:query", { query: searchQuery, ...extraData });
    }
  }
}

export const socketService = new SocketService();
export default socketService;
