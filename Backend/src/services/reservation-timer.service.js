import { pool } from "../db/pool.js";
import {
  emitReservationCancelled,
  emitBorrowRequest,
  emitTransactionUpdated,
  emitTransactionDecided,
  sendUserNotification,
  broadcastCirculationQueue,
} from "../socket.js";
import { eventDispatcher } from "./event-dispatcher.js";
import { adminModel } from "../models/admin.model.js";

const notifiedDueTxMap = new Map();

function warnIfNotOffline(label, error) {
  const errObj = typeof error === "string" ? { message: error } : (error || {});
  const msg = (errObj.message || String(error || "")).toLowerCase();
  const code = errObj.code || "";

  if (
    code !== "DB_OFFLINE" &&
    !msg.includes("offline") &&
    !msg.includes("password authentication failed") &&
    !msg.includes("connect econnrefused") &&
    !msg.includes("does not support ssl")
  ) {
    console.warn(label, errObj.message || error);
  }
}

export const reservationTimerService = {
  /**
   * Automatically converts a reservation into an active Approved Borrow transaction with a 7-day due date.
   */
  async convertReservationToBorrow(transactionId, actorLabel = "System Automation") {
    try {
      const query = `
        UPDATE transactions
        SET 
          type = 'Borrow',
          status = 'Approved',
          requested_at = NOW(),
          due_date = COALESCE(due_date, NOW() + INTERVAL '7 days'),
          decided_at = NOW(),
          available_at = NOW(),
          expires_at = NOW() + INTERVAL '24 hours',
          picked_up_at = NULL,
          comment = CASE 
            WHEN comment IS NULL OR comment = '' THEN 'Automatically converted from reservation to active borrow upon previous copy return. 24-hour pickup timer started.'
            ELSE comment || ' (Auto-converted to Borrow - 24h Pickup Timer)'
          END
        WHERE id::text = $1::text
        RETURNING 
          id,
          user_id AS "userId",
          student_name AS "studentName",
          student_id AS "studentId",
          resource_title AS "resourceTitle",
          isbn,
          department,
          type,
          status,
          requested_at AS "requestedAt",
          due_date AS "dueDate",
          decided_at AS "decidedAt",
          decided_by AS "decidedBy",
          student_id_image AS "studentIdImage",
          comment,
          available_at AS "availableAt",
          expires_at AS "expiresAt",
          picked_up_at AS "pickedUpAt"
      `;

      const { rows } = await pool.query(query, [String(transactionId)]);
      if (rows.length > 0) {
        const tx = rows[0];

        // Notify student and dashboards via WebSocket
        emitTransactionDecided(tx);
        emitTransactionUpdated(tx);
        void adminModel.syncBookAvailability(tx.isbn || tx.resourceTitle);
        void eventDispatcher.dispatchTransactionDecision(tx);

        try {
          await adminModel.addActivityLog(
            `Reservation for '${tx.resourceTitle}' by ${tx.studentName || tx.studentId} automatically converted to active Borrow transaction.`,
            "success",
            actorLabel
          );
          await adminModel.addHistoryLog({
            actor: actorLabel,
            action: "Converted Reservation to Borrow",
            target: tx.studentName || tx.studentId,
            module: "Transactions",
            detail: `'${tx.resourceTitle}' is now an active borrow with due date ${new Date(tx.dueDate).toLocaleDateString()}.`,
          });
        } catch (logErr) {
          // ignore logging error
        }

        return tx;
      }
    } catch (error) {
      warnIfNotOffline("DB convertReservationToBorrow error:", error);
    }
    return null;
  },

  /**
   * Activates a 24-hour (1 day) pickup timer for a pending reservation when a copy becomes available.
   */
  async activateReservationHold(transactionId, hours = 24) {
    try {
      const query = `
        UPDATE transactions
        SET 
          available_at = NOW(),
          expires_at = NOW() + ($2 || ' hours')::interval
        WHERE id::text = $1 AND type = 'Reservation' AND status IN ('Pending', 'Approved')
        RETURNING 
          id,
          user_id AS "userId",
          student_name AS "studentName",
          student_id AS "studentId",
          resource_title AS "resourceTitle",
          isbn,
          department,
          type,
          status,
          requested_at AS "requestedAt",
          available_at AS "availableAt",
          expires_at AS "expiresAt"
      `;

      const { rows } = await pool.query(query, [String(transactionId), String(hours)]);
      if (rows.length > 0) {
        const tx = rows[0];

        // Notify student via eventDispatcher and WebSocket
        emitTransactionUpdated(tx);
        void adminModel.syncBookAvailability(tx.isbn || tx.resourceTitle);
        void eventDispatcher.dispatchReservedBookAvailable(tx, {
          title: tx.resourceTitle,
          isbn: tx.isbn,
          expiresAt: tx.expiresAt,
        });

        try {
          await adminModel.addActivityLog(
            `Copy of '${tx.resourceTitle}' is now ready for pickup by ${tx.studentName || tx.studentId}. 1-day (24h) claim timer started.`,
            "info",
            "System Automation"
          );
        } catch (logErr) {
          // ignore logging error
        }

        return tx;
      }
    } catch (error) {
      warnIfNotOffline("DB activateReservationHold error:", error);
    }
    return null;
  },

  /**
   * Finds the next waiting student in the waitlist for a book and automatically converts their reservation to an active Borrow transaction.
   */
  async promoteNextReservation(isbn, title) {
    try {
      const query = `
        SELECT id, isbn, resource_title AS "resourceTitle", student_name AS "studentName", student_id AS "studentId"
        FROM transactions
        WHERE type = 'Reservation'
          AND status = 'Approved'
          AND (available_at IS NULL OR expires_at <= NOW())
          AND (
            (isbn IS NOT NULL AND isbn != '' AND isbn != 'N/A' AND isbn = $1)
            OR (resource_title IS NOT NULL AND lower(resource_title) = lower($2))
          )
        ORDER BY requested_at ASC
        LIMIT 1
      `;
      const { rows } = await pool.query(query, [isbn || '', title || '']);
      if (rows.length > 0) {
        const nextTx = rows[0];
        console.log(`[ReservationTimer] Converting next waitlisted reservation ${nextTx.id} for '${nextTx.resourceTitle}' to active Borrow for ${nextTx.studentName}`);
        const promoted = await this.convertReservationToBorrow(nextTx.id, "System Automation (Returned Book Promotion)");
        void adminModel.syncBookAvailability(isbn || title);
        return promoted;
      } else {
        console.log(`[ReservationTimer] No further waitlisted reservations for '${title || isbn}'. Copy released to circulation.`);
        void adminModel.syncBookAvailability(isbn || title);
      }
    } catch (error) {
      warnIfNotOffline("DB promoteNextReservation error:", error);
    }
    return null;
  },

  /**
   * Scans for all pending reservations whose 1-day claim window has expired,
   * automatically voids them ('Cancelled'), and promotes the next student in line.
   */
  async checkAndVoidExpiredReservations() {
    try {
      const query = `
        SELECT 
          id,
          user_id AS "userId",
          student_name AS "studentName",
          student_id AS "studentId",
          resource_title AS "resourceTitle",
          isbn,
          department,
          type,
          status,
          available_at AS "availableAt",
          expires_at AS "expiresAt"
        FROM transactions
        WHERE (
          (type = 'Reservation' AND status IN ('Pending', 'Approved'))
          OR (type = 'Borrow' AND status = 'Approved' AND picked_up_at IS NULL)
        )
          AND expires_at IS NOT NULL
          AND expires_at <= NOW()
      `;

      const { rows } = await pool.query(query);
      if (rows.length === 0) return [];

      const voidedList = [];

      for (const tx of rows) {
        const updateSql = `
          UPDATE transactions
          SET 
            status = 'Cancelled',
            comment = 'Voided automatically: 24-hour claim window expired without pickup response.',
            decided_at = NOW()
          WHERE id = $1 AND status IN ('Pending', 'Approved')
          RETURNING 
            id,
            user_id AS "userId",
            student_name AS "studentName",
            student_id AS "studentId",
            resource_title AS "resourceTitle",
            isbn,
            department,
            type,
            status,
            comment,
            decided_at AS "decidedAt"
        `;

        const updateRes = await pool.query(updateSql, [tx.id]);
        if (updateRes.rows.length > 0) {
          const voidedTx = updateRes.rows[0];
          voidedList.push(voidedTx);

          console.log(`\x1b[33m[ReservationTimer] Reservation ${voidedTx.id} for '${voidedTx.resourceTitle}' by student ${voidedTx.studentName} VOIDED (expired 24h timer).\x1b[0m`);

          // Emit real-time WebSocket cancellation event
          emitReservationCancelled(voidedTx);
          void adminModel.syncBookAvailability(voidedTx.isbn || voidedTx.resourceTitle);
          void eventDispatcher.dispatchReservationCancelled(voidedTx);

          try {
            await adminModel.addActivityLog(
              `Reservation for '${voidedTx.resourceTitle}' by ${voidedTx.studentName} automatically voided (1-day claim timer expired).`,
              "warning",
              "System Automation"
            );
            await adminModel.addHistoryLog({
              actor: "System Automation",
              action: "Voided Expired Reservation",
              target: voidedTx.studentName || voidedTx.studentId,
              module: "Reservations",
              detail: `Hold for '${voidedTx.resourceTitle}' was voided after 24 hours without student response.`,
            });
          } catch (logErr) {
            // ignore
          }

          // Advance queue: offer copy to next waitlisted student
          void this.promoteNextReservation(voidedTx.isbn, voidedTx.resourceTitle);
        }
      }

      return voidedList;
    } catch (error) {
      warnIfNotOffline("DB checkAndVoidExpiredReservations error:", error);
      return [];
    }
  },

  /**
   * Scans for all active borrowed books whose due date is reached (today or overdue),
   * and dispatches real-time due return reminders to students.
   */
  async checkAndNotifyDueTransactions() {
    try {
      const query = `
        SELECT 
          t.id,
          t.user_id AS "userId",
          t.student_name AS "studentName",
          t.student_id AS "studentId",
          t.resource_title AS "resourceTitle",
          t.isbn,
          t.department,
          t.type,
          t.status,
          t.requested_at AS "requestedAt",
          t.due_date AS "dueDate",
          t.picked_up_at AS "pickedUpAt"
        FROM transactions t
        WHERE (t.type::text = 'Borrow' OR t.type IS NULL)
          AND t.status::text IN ('Approved', 'On Loan', 'Picked Up')
          AND t.due_date IS NOT NULL
          AND t.due_date::date <= CURRENT_DATE
      `;

      const { rows } = await pool.query(query);
      if (!rows || rows.length === 0) return [];

      const todayStr = new Date().toISOString().split("T")[0];

      for (const tx of rows) {
        const cacheKey = `due-${tx.id}-${todayStr}`;
        if (!notifiedDueTxMap.has(cacheKey)) {
          notifiedDueTxMap.set(cacheKey, true);

          const txDueStr = tx.dueDate ? new Date(tx.dueDate).toISOString().split("T")[0] : todayStr;
          const isToday = txDueStr === todayStr;

          const title = isToday ? "Book Due for Return" : "Book Overdue for Return";
          const message = isToday
            ? `'${tx.resourceTitle}' is due for return today (${txDueStr}). Please return it to the library to avoid overdue penalties.`
            : `'${tx.resourceTitle}' is overdue for return (was due on ${txDueStr}). Please return it to the library immediately.`;

          if (tx.studentId) {
            sendUserNotification(tx.studentId, {
              event_type: "BOOK_DUE_REMINDER",
              id: tx.id,
              entity_id: tx.id,
              studentId: tx.studentId,
              title,
              message,
              body: message,
              dueDate: tx.dueDate,
              transaction: tx,
              timestamp: new Date().toISOString(),
            });
          }

          broadcastCirculationQueue("transaction:due", {
            event_type: "BOOK_DUE_REMINDER",
            transaction: tx,
            title,
            message,
          });
        }
      }
    } catch (err) {
      warnIfNotOffline("checkAndNotifyDueTransactions error:", err);
    }
  },

  /**
   * Starts the continuous background scheduler.
   */
  startReservationTimerService(intervalMs = 30000) {
    console.log(`\x1b[36m[ReservationTimer] Automated 1-day reservation expiration monitor active (interval: ${intervalMs / 1000}s).\x1b[0m`);
    
    // Initial check on boot
    void this.checkAndVoidExpiredReservations();
    void this.checkAndNotifyDueTransactions();

    // Recurring polling timer
    const interval = setInterval(() => {
      void this.checkAndVoidExpiredReservations();
      void this.checkAndNotifyDueTransactions();
    }, intervalMs);

    if (interval.unref) {
      interval.unref();
    }

    return interval;
  }
};
