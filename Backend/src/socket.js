import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import { isAllowedOrigin } from "./config/cors.js";

let io = null;

export const ROOMS = {
  SUPER_ADMIN_TELEMETRY: "room:super-admin-telemetry",
  CIRCULATION_DESK: "room:circulation-desk",
  CATALOG_UPDATES: "room:catalog-updates",
  userNotifications: (userId) => `room:user-notifications:${userId}`,
};

export function initSocketServer(httpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked socket origin: ${origin}`));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  // Authentication Middleware for Handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, env.jwtSecret);
        socket.user = decoded;
      } catch (err) {
        // Allow unauthenticated/guest clients for public catalog updates
        socket.user = null;
      }
    }
    return next();
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id} (User: ${socket.user?.email || "Guest"})`);

    // Auto-join rooms based on user token role if present
    if (socket.user) {
      const role = String(socket.user.role || "").toUpperCase();
      if (role.includes("SUPER_ADMIN")) {
        socket.join(ROOMS.SUPER_ADMIN_TELEMETRY);
        socket.join(ROOMS.CIRCULATION_DESK);
        socket.join(ROOMS.CATALOG_UPDATES);
      } else if (role.includes("ADMIN")) {
        socket.join(ROOMS.SUPER_ADMIN_TELEMETRY);
        socket.join(ROOMS.CIRCULATION_DESK);
        socket.join(ROOMS.CATALOG_UPDATES);
      } else if (role.includes("LIBRARIAN")) {
        socket.join(ROOMS.CIRCULATION_DESK);
        socket.join(ROOMS.CATALOG_UPDATES);
      }

      if (socket.user.sub || socket.user.id) {
        const uid = socket.user.sub || socket.user.id;
        socket.join(ROOMS.userNotifications(uid));
      }
    }

    // Room subscription handler
    socket.on("join:room", (roomName) => {
      if (typeof roomName === "string" && roomName.trim()) {
        socket.join(roomName.trim());
        console.log(`[Socket.io] Socket ${socket.id} joined room: ${roomName}`);
      }
    });

    socket.on("leave:room", (roomName) => {
      if (typeof roomName === "string" && roomName.trim()) {
        socket.leave(roomName.trim());
        console.log(`[Socket.io] Socket ${socket.id} left room: ${roomName}`);
      }
    });

    // Client-side search query telemetry broadcast
    socket.on("search:query", (searchData) => {
      console.log("[Socket.io] Search event received:", searchData?.query);
      broadcastTelemetryUpdate("search:query", searchData);
    });

    // Client-side book added event
    socket.on("book:added", (bookData) => {
      console.log("[Socket.io] Received book:added event:", bookData?.title);
      emitBookAdded(bookData);
    });

    // Client-side borrow request event
    socket.on("borrow:request", (borrowData) => {
      console.log("[Socket.io] Received borrow:request event:", borrowData?.resourceTitle || borrowData?.title);
      emitBorrowRequest(borrowData);
    });

    // Client-side reservation cancelled event
    socket.on("reservation:cancelled", (cancelData) => {
      console.log("[Socket.io] Received reservation:cancelled event:", cancelData?.resourceTitle || cancelData?.title);
      emitReservationCancelled(cancelData);
    });

    // Client-side real-time return events
    socket.on("book:returned", (returnData) => {
      console.log("[Socket.io] Received book:returned event:", returnData?.id || returnData?.resourceTitle);
      emitBookReturned(returnData);
    });

    socket.on("transaction:returned", (returnData) => {
      console.log("[Socket.io] Received transaction:returned event:", returnData?.id || returnData?.resourceTitle);
      emitBookReturned(returnData);
    });

    socket.on("transaction:decided", (decideData) => {
      console.log("[Socket.io] Received transaction:decided event:", decideData?.id, decideData?.status);
      emitTransactionDecided(decideData);
    });

    socket.on("transaction:picked-up", (pickupData) => {
      console.log("[Socket.io] Received transaction:picked-up event:", pickupData?.id || pickupData?.resourceTitle);
      emitTransactionPickedUp(pickupData);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.io] Client disconnected (${socket.id}): ${reason}`);
    });
  });

  return io;
}

export function getIO() {
  return io;
}

// ── Room-Targeted Broadcast Helpers ───────────────────────────────────────────

export function broadcastTelemetryUpdate(eventName, payload) {
  if (!io) return;
  io.to(ROOMS.SUPER_ADMIN_TELEMETRY).emit(eventName, payload);
  // Fallback broadcast to all connected clients for telemetry sync
  io.emit(eventName, payload);
}

export function broadcastCirculationQueue(eventName, payload) {
  if (!io) return;
  io.emit(eventName, payload);
}

export function broadcastCatalogUpdate(eventName, payload) {
  if (!io) return;
  io.emit(eventName, payload);
}

export function sendUserNotification(userId, notificationPayload) {
  if (!io || !userId) return;
  io.to(ROOMS.userNotifications(userId)).emit("student:notification", notificationPayload);
  io.to(ROOMS.userNotifications(userId)).emit("loan:status-changed", notificationPayload);
  // Fallback broadcast for mobile clients that haven't bound to specific user rooms
  io.emit("student:notification", notificationPayload);
}

// ── Backwards-Compatible Global Event Emitters ────────────────────────────────

export function emitBookAdded(book) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting book:added for title:", book?.title);
    io.emit("book:added", book);
  }
}

export function emitBorrowRequest(rawTransaction) {
  if (io && rawTransaction) {
    const base = rawTransaction?.payload && typeof rawTransaction.payload === "object"
      ? { ...rawTransaction, ...rawTransaction.payload }
      : rawTransaction;
    if (!base.id && !base.transactionId && !base.resourceTitle && !base.title) {
      return;
    }
    const rawType = String(base.type || base.action || "Borrow").trim();
    const normalizedType =
      rawType.toLowerCase() === "reservation" || rawType.toLowerCase() === "reserve"
        ? "Reservation"
        : "Borrow";
    const transaction = {
      ...base,
      type: normalizedType,
      status: base.status || "Pending",
      resourceTitle: base.resourceTitle || base.title || "Book",
    };
    console.log("[Socket.io Broadcast] Emitting borrow:request for transaction:", transaction?.id || transaction?.resourceTitle);
    io.emit("borrow:request", transaction);
    io.emit("notification:new", transaction);
  }
}

export function emitReservationRequest(rawTransaction) {
  if (io && rawTransaction) {
    const base = rawTransaction?.payload && typeof rawTransaction.payload === "object"
      ? { ...rawTransaction, ...rawTransaction.payload }
      : rawTransaction;
    if (!base.id && !base.transactionId && !base.resourceTitle && !base.title) {
      return;
    }
    const transaction = {
      ...base,
      type: "Reservation",
      status: base.status || "Pending",
      resourceTitle: base.resourceTitle || base.title || "Book",
    };
    console.log("[Socket.io Broadcast] Emitting reservation:request for transaction:", transaction?.id || transaction?.resourceTitle);
    io.emit("reservation:request", transaction);
    io.emit("notification:new", transaction);
  }
}

export function emitBookReturned(transaction) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting book:returned for transaction:", transaction?.id || transaction?.resourceTitle);
    const payload = {
      ...transaction,
      status: "Returned",
      type: transaction?.type || "Borrow",
      returnedAt: transaction?.returnedAt || transaction?.decidedAt || new Date().toISOString(),
    };
    io.emit("book:returned", payload);
    io.emit("transaction:returned", payload);
    io.emit("transaction:updated", payload);
    if (payload.studentId) {
      sendUserNotification(payload.studentId, payload);
    }
  }
}

export function emitTransactionDecided(transaction) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting transaction:decided for transaction:", transaction?.id, "Status:", transaction?.status);
    io.emit("transaction:decided", transaction);
    io.emit("transaction:updated", transaction);
    io.emit("student:notification", transaction);

    if (transaction?.status === "Returned") {
      io.emit("book:returned", transaction);
      io.emit("transaction:returned", transaction);
    }

    if (transaction.studentId) {
      sendUserNotification(transaction.studentId, transaction);
    }
  }
}

export function emitTransactionUpdated(transaction) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting transaction:updated for transaction:", transaction?.id);
    io.emit("transaction:updated", transaction);

    if (transaction?.status === "Returned") {
      io.emit("book:returned", transaction);
      io.emit("transaction:returned", transaction);
    }
  }
}

export function emitTransactionPickedUp(transaction) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting transaction:picked-up for transaction:", transaction?.id || transaction?.resourceTitle);
    const payload = {
      ...transaction,
      isPickedUp: true,
      pickedUpAt: transaction?.pickedUpAt || new Date().toISOString(),
    };
    io.emit("transaction:picked-up", payload);
    io.emit("transaction:updated", payload);
    io.emit("student:notification", {
      ...payload,
      title: "Book Picked Up",
      message: `You have successfully picked up "${payload.resourceTitle || payload.title || 'your book'}". Due date: ${payload.dueDate ? new Date(payload.dueDate).toLocaleDateString() : '7 days'}.`,
    });
    if (payload.userId || payload.studentId) {
      sendUserNotification(payload.userId || payload.studentId, payload);
    }
  }
}

export function emitReservationCancelled(transaction) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting reservation:cancelled for transaction:", transaction?.id);
    io.emit("reservation:cancelled", transaction);
    io.emit("transaction:cancelled", transaction);
    io.emit("RESERVATION_CANCELLED", transaction);
    io.emit("transaction:updated", transaction);
    io.emit("notification:new", {
      ...transaction,
      isCancelled: true,
      title: "Reservation Cancelled",
      message: `Student ${transaction?.studentName || "Student"} cancelled their reservation for '${transaction?.resourceTitle || transaction?.title || "Book"}'`,
    });
    broadcastCirculationQueue("reservation:cancelled", transaction);
  }
}

export function emitReservedBookAvailable(notificationPayload) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting reserved book available for student:", notificationPayload?.studentId, "Title:", notificationPayload?.title);
    io.emit("student:notification", notificationPayload);
    io.emit("reservation:available", notificationPayload);
    io.emit("notification:new", notificationPayload);
    if (notificationPayload.studentId) {
      sendUserNotification(notificationPayload.studentId, notificationPayload);
    }
  }
}

export function emitAnnouncementPublished(announcement) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting announcement:published:", announcement?.title);
    io.emit("announcement:published", announcement);
    io.emit("notification:new", {
      id: `ann-${announcement?.id || Date.now()}`,
      title: announcement?.title,
      body: announcement?.content,
      type: "announcement",
      priority: announcement?.priority,
      author: announcement?.author,
      timestamp: "Just now",
      read: false,
    });
  }
}

export function emitAnnouncementDeleted(id) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting announcement:deleted:", id);
    io.emit("announcement:deleted", { id });
    io.emit("announcement:removed", { id });
    io.emit("announcements:updated", { action: "deleted", id });
    io.emit("notification:new", {
      id: `ann-deleted-${id}`,
      type: "announcement_deleted",
      announcementId: id,
    });
  }
}

export function emitSettingsUpdated(settings) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting settings:updated:", settings);
    io.emit("settings:updated", settings);
    io.emit("system:settings", settings);
  }
}

export function emitMaintenanceUpdated(maintenanceState) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting system:maintenance:", maintenanceState);
    io.emit("system:maintenance", maintenanceState);
    io.emit("maintenance:updated", maintenanceState);
    io.emit("maintenance:status", maintenanceState);
  }
}
