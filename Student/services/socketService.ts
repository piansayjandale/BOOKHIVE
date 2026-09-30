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
  private returnListeners: Set<SocketCallback> = new Set();
  private catalogListeners: Set<SocketCallback> = new Set();
  private announcementListeners: Set<SocketCallback> = new Set();
  private activeRooms: Set<string> = new Set();
  private isConnected: boolean = false;
  private reconnectTimer: any = null;

  constructor() {
    this.connect();
  }

  public connect() {
    if (this.socket) return;

    try {
      const io = (globalThis as any).io || null;

      if (io) {
        this.socket = io(API_URL, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
        });

        this.socket.on("connect", () => {
          console.log("[SocketService] Connected to BookHive Real-time Socket Gateway via io client");
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

        this.socket.on("book:returned", (data: any) => {
          console.log("[SocketService] Received book:returned event:", data);
          this.notifyBookReturned(data);
          this.notifyTransactionDecided(data);
        });

        this.socket.on("transaction:returned", (data: any) => {
          console.log("[SocketService] Received transaction:returned event:", data);
          this.notifyBookReturned(data);
          this.notifyTransactionDecided(data);
        });

        this.socket.on("transaction:decided", (data: any) => {
          console.log("[SocketService] Received transaction:decided event:", data);
          if (String(data?.status || "").toLowerCase() === "returned") {
            this.notifyBookReturned(data);
          }
          this.notifyTransactionDecided(data);
        });

        this.socket.on("transaction:updated", (data: any) => {
          console.log("[SocketService] Received transaction:updated event:", data);
          if (String(data?.status || "").toLowerCase() === "returned") {
            this.notifyBookReturned(data);
          }
          this.notifyTransactionDecided(data);
        });

        this.socket.on("borrow:decided", (data: any) => {
          console.log("[SocketService] Received borrow:decided event:", data);
          if (String(data?.status || "").toLowerCase() === "returned") {
            this.notifyBookReturned(data);
          }
          this.notifyTransactionDecided(data);
        });

        this.socket.on("student:notification", (data: any) => {
          console.log("[SocketService] Received student:notification event:", data);
          if (String(data?.status || "").toLowerCase() === "returned") {
            this.notifyBookReturned(data);
          }
          this.notifyTransactionDecided(data);
        });

        this.socket.on("loan:status-changed", (data: any) => {
          console.log("[SocketService] Received loan:status-changed event:", data);
          if (String(data?.status || "").toLowerCase() === "returned") {
            this.notifyBookReturned(data);
          }
          this.notifyTransactionDecided(data);
        });

        this.socket.on("announcement:published", (data: any) => {
          console.log("[SocketService] Received announcement:published event:", data?.title);
          this.notifyAnnouncementPublished(data);
        });

        this.socket.on("disconnect", () => {
          console.log("[SocketService] Socket disconnected");
          this.isConnected = false;
        });
      } else {
        // High-fidelity native WebSocket implementation for React Native / Expo
        this.connectNativeWebSocket();
      }
    } catch (err) {
      console.warn("[SocketService] Failed to initialize Socket.io, degrading gracefully:", err);
      this.connectNativeWebSocket();
    }
  }

  private connectNativeWebSocket() {
    try {
      const baseUrl = String(API_URL);
      const wsUrl = baseUrl.replace(/^http/, "ws");
      const ws = new WebSocket(`${wsUrl}/socket.io/?EIO=4&transport=websocket`);

      ws.onopen = () => {
        console.log("[SocketService] Native WebSocket Connected, sending Engine.IO namespace connect");
        try {
          // Socket.IO v4 Connect packet to default namespace '/'
          ws.send("40");
        } catch (e) {}
        this.isConnected = true;
        this.rejoinRooms();
      };

      ws.onmessage = (event) => {
        try {
          const dataStr = event.data.toString();

          // Engine.IO Heartbeat PING ('2') -> reply with PONG ('3')
          if (dataStr === "2") {
            ws.send("3");
            return;
          }

          // Engine.IO Handshake response ('0{...}') -> send CONNECT ('40')
          if (dataStr.startsWith("0")) {
            ws.send("40");
            return;
          }

          // Engine.IO Message ('42' prefix for Socket.IO event)
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
              eventName === "book:returned" ||
              eventName === "transaction:returned" ||
              ((eventName === "transaction:decided" ||
                eventName === "transaction:updated" ||
                eventName === "loan:status-changed" ||
                eventName === "borrow:decided" ||
                eventName === "student:notification") &&
                String(eventData?.status || "").toLowerCase() === "returned")
            ) {
              this.notifyBookReturned(eventData);
              this.notifyTransactionDecided(eventData);
            } else if (
              eventName === "transaction:decided" ||
              eventName === "transaction:updated" ||
              eventName === "borrow:decided" ||
              eventName === "student:notification" ||
              eventName === "loan:status-changed"
            ) {
              this.notifyTransactionDecided(eventData);
            } else if (eventName === "announcement:published") {
              this.notifyAnnouncementPublished(eventData);
            }
          }
        } catch (e) {
          // Ignore unparseable frames
        }
      };

      ws.onerror = (e) => {
        console.log("[SocketService] WebSocket error, will attempt reconnection...");
        this.isConnected = false;
        this.scheduleReconnect();
      };

      ws.onclose = () => {
        console.log("[SocketService] WebSocket closed, scheduling reconnection...");
        this.isConnected = false;
        this.scheduleReconnect();
      };

      this.socket = ws;
    } catch (error) {
      console.log("[SocketService] Offline fallback active:", error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isConnected) {
        this.socket = null;
        this.connect();
      }
    }, 2500);
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
      console.warn(`[SocketService] Failed to emit event ${eventName}:`, e);
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

  public joinUserRoom(userId: string) {
    if (!userId) return;
    const roomName = `room:user-notifications:${userId}`;
    this.joinRoom(roomName);
  }

  private rejoinRooms() {
    this.activeRooms.forEach((room) => {
      this.emitEvent("join:room", room);
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

  public subscribeToReturn(callback: SocketCallback) {
    this.returnListeners.add(callback);
    return () => {
      this.returnListeners.delete(callback);
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

  public notifyBookReturned(data: any) {
    this.returnListeners.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.warn("[SocketService] Listener error:", e);
      }
    });
  }

  public subscribeToAnnouncementPublished(callback: SocketCallback) {
    this.announcementListeners.add(callback);
    return () => {
      this.announcementListeners.delete(callback);
    };
  }

  public notifyAnnouncementPublished(data: any) {
    this.announcementListeners.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.warn("[SocketService] Listener error:", e);
      }
    });
  }

  public emitBorrowRequest(borrowData: any) {
    this.emitEvent("borrow:request", borrowData);
  }

  public emitReservationCancelled(cancelData: any) {
    this.emitEvent("reservation:cancelled", cancelData);
  }

  public emitBookAdded(bookData: any) {
    this.emitEvent("book:added", bookData);
  }

  public emitBookReturned(returnData: any) {
    this.emitEvent("book:returned", returnData);
    this.emitEvent("transaction:returned", returnData);
  }

  public emitSearchQuery(searchQuery: string, extraData: any = {}) {
    this.emitEvent("search:query", { query: searchQuery, ...extraData });
  }

  public getConnected(): boolean {
    return this.isConnected;
  }
}

export const socketService = new SocketService();
export default socketService;
