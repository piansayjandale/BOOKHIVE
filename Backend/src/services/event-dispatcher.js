import {
  getIO,
  broadcastTelemetryUpdate,
  broadcastCirculationQueue,
  broadcastCatalogUpdate,
  sendUserNotification,
} from "../socket.js";
import { superAdminModel } from "../models/super-admin.model.js";

/**
 * Normalized Event Dispatcher for BookHive Ecosystem
 */
export const eventDispatcher = {
  /**
   * Dispatches a student borrow or reservation request
   */
  async dispatchBorrowRequest(transaction) {
    try {
      const payload = {
        event_type: "BORROW_REQUEST",
        entity_id: transaction.id,
        actor_id: transaction.studentId || transaction.userId,
        payload: transaction,
        timestamp: new Date().toISOString(),
      };

      // 1. Broadcast to Circulation Desk queue
      broadcastCirculationQueue("borrow:request", payload);
      broadcastCirculationQueue("reservation:request", payload);

      // 2. Broadcast updated Super Admin telemetry & counters
      await this.dispatchTelemetryRefresh();
    } catch (err) {
      console.warn("[EventDispatcher] dispatchBorrowRequest warning:", err.message);
    }
  },

  /**
   * Dispatches a cancelled reservation
   */
  async dispatchReservationCancelled(transaction) {
    try {
      const payload = {
        event_type: "RESERVATION_CANCELLED",
        entity_id: transaction.id,
        actor_id: transaction.studentId,
        payload: transaction,
        timestamp: new Date().toISOString(),
      };

      broadcastCirculationQueue("reservation:cancelled", payload);
      broadcastCirculationQueue("transaction:cancelled", payload);
      await this.dispatchTelemetryRefresh();
    } catch (err) {
      console.warn("[EventDispatcher] dispatchReservationCancelled warning:", err.message);
    }
  },

  /**
   * Dispatches a loan approval, decline, or return transaction decision
   */
  async dispatchTransactionDecision(transaction) {
    try {
      const payload = {
        event_type: `TRANSACTION_${String(transaction.status || "").toUpperCase()}`,
        entity_id: transaction.id,
        actor_id: transaction.studentId,
        payload: transaction,
        timestamp: new Date().toISOString(),
      };

      // 1. Send targeted notification to specific student
      if (transaction.studentId) {
        sendUserNotification(transaction.studentId, {
          title: `Loan Request ${transaction.status}`,
          message: `Your request for "${transaction.resourceTitle || "Book"}" has been ${transaction.status.toLowerCase()}.`,
          transaction,
        });
      }

      // 2. Broadcast to Circulation Desk & general channels
      broadcastCirculationQueue("transaction:decided", payload);
      broadcastCirculationQueue("transaction:updated", payload);

      // 3. Broadcast updated Super Admin telemetry & counters
      await this.dispatchTelemetryRefresh();
    } catch (err) {
      console.warn("[EventDispatcher] dispatchTransactionDecision warning:", err.message);
    }
  },

  /**
   * Dispatches catalog changes (book added, updated, archived, pruned)
   */
  async dispatchCatalogMutation(action, bookData) {
    try {
      const payload = {
        event_type: `CATALOG_${action.toUpperCase()}`,
        entity_id: bookData?.id,
        payload: bookData,
        timestamp: new Date().toISOString(),
      };

      // Broadcast to catalog update subscribers (Student search caches, Admin catalog view)
      broadcastCatalogUpdate("catalog:updated", payload);
      if (action === "added") {
        broadcastCatalogUpdate("book:added", bookData);
      } else if (action === "archived") {
        broadcastCatalogUpdate("book:archived", bookData);
      }

      await this.dispatchTelemetryRefresh();
    } catch (err) {
      console.warn("[EventDispatcher] dispatchCatalogMutation warning:", err.message);
    }
  },

  /**
   * Dispatches user account mutations (registration, role change, deactivation)
   */
  async dispatchUserMutation(action, userData) {
    try {
      const payload = {
        event_type: `USER_${action.toUpperCase()}`,
        entity_id: userData?.id,
        payload: userData,
        timestamp: new Date().toISOString(),
      };

      broadcastTelemetryUpdate("user:mutated", payload);
      await this.dispatchTelemetryRefresh();
    } catch (err) {
      console.warn("[EventDispatcher] dispatchUserMutation warning:", err.message);
    }
  },

  /**
   * Dispatches search execution event (for AI Search telemetry counter)
   */
  async dispatchSearchEvent(queryData) {
    try {
      const payload = {
        event_type: "SEARCH_EXECUTED",
        payload: queryData,
        timestamp: new Date().toISOString(),
      };

      broadcastTelemetryUpdate("search:query", payload);
    } catch (err) {
      console.warn("[EventDispatcher] dispatchSearchEvent warning:", err.message);
    }
  },

  /**
   * Dispatches live Super Admin vitals & telemetry refresh
   */
  async dispatchTelemetryRefresh() {
    try {
      const vitalsData = await superAdminModel.getDashboardVitals();
      broadcastTelemetryUpdate("telemetry:updated", vitalsData);
    } catch (err) {
      console.warn("[EventDispatcher] dispatchTelemetryRefresh warning:", err.message);
    }
  },
};
