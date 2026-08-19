import { Server as SocketIOServer } from "socket.io";

let io = null;

export function initSocketServer(httpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Allow client to publish book:added directly if using socket payload
    socket.on("book:added", (bookData) => {
      console.log("[Socket.io] Received book:added event:", bookData?.title);
      socket.broadcast.emit("book:added", bookData);
    });

    // Allow client to publish borrow:request directly if using socket payload
    socket.on("borrow:request", (borrowData) => {
      console.log("[Socket.io] Received borrow:request event:", borrowData?.resourceTitle || borrowData?.title);
      socket.broadcast.emit("borrow:request", borrowData);
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

export function emitBookAdded(book) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting book:added for title:", book?.title);
    io.emit("book:added", book);
  }
}

export function emitBorrowRequest(transaction) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting borrow:request for transaction:", transaction?.id || transaction?.resourceTitle);
    io.emit("borrow:request", transaction);
    io.emit("reservation:request", transaction);
    io.emit("notification:new", transaction);
  }
}

export function emitReservationRequest(transaction) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting reservation:request for transaction:", transaction?.id || transaction?.resourceTitle);
    io.emit("reservation:request", transaction);
    io.emit("borrow:request", transaction);
    io.emit("notification:new", transaction);
  }
}

export function emitTransactionDecided(transaction) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting transaction:decided for transaction:", transaction?.id, "Status:", transaction?.status);
    io.emit("transaction:decided", transaction);
    io.emit("transaction:updated", transaction);
    io.emit("borrow:decided", transaction);
    io.emit("student:notification", transaction);
  }
}

export function emitTransactionUpdated(transaction) {
  if (io) {
    console.log("[Socket.io Broadcast] Emitting transaction:updated for transaction:", transaction?.id);
    io.emit("transaction:updated", transaction);
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
  }
}


