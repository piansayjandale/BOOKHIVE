import { pool } from "../db/pool.js";
import { emitReservationCancelled, emitBorrowRequest } from "../socket.js";
import { eventDispatcher } from "./event-dispatcher.js";
import { adminModel } from "../models/admin.model.js";

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
   * Activates a 24-hour (1 day) pickup timer for a pending reservation when a copy becomes available.
   */
  async activateReservationHold(transactionId, hours = 24) {
    try {
      const query = `
        UPDATE transactions
        SET 
          available_at = NOW(),
          expires_at = NOW() + ($2 || ' hours')::interval
        WHERE id::text = $1 AND type = 'Reservation' AND status = 'Pending'
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
   * Finds the next waiting student in the waitlist for a book and starts their 24h timer.
   */
  async promoteNextReservation(isbn, title) {
    try {
      const query = `
        SELECT id, isbn, resource_title AS "resourceTitle", student_name AS "studentName", student_id AS "studentId"
        FROM transactions
        WHERE type = 'Reservation'
          AND status = 'Pending'
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
        console.log(`[ReservationTimer] Promoting next waitlisted student ${nextTx.studentName} for '${nextTx.resourceTitle}'`);
        return await this.activateReservationHold(nextTx.id, 24);
      } else {
        console.log(`[ReservationTimer] No further waitlisted reservations for '${title || isbn}'. Copy released to circulation.`);
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
        WHERE type = 'Reservation'
          AND status = 'Pending'
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
          WHERE id = $1 AND status = 'Pending'
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
   * Starts the continuous background scheduler.
   */
  startReservationTimerService(intervalMs = 30000) {
    console.log(`\x1b[36m[ReservationTimer] Automated 1-day reservation expiration monitor active (interval: ${intervalMs / 1000}s).\x1b[0m`);
    
    // Initial check on boot
    void this.checkAndVoidExpiredReservations();

    // Recurring polling timer
    const interval = setInterval(() => {
      void this.checkAndVoidExpiredReservations();
    }, intervalMs);

    if (interval.unref) {
      interval.unref();
    }

    return interval;
  }
};
