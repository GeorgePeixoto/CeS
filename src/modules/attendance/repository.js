import { transaction } from '../../db/connection.js';

export function createAttendanceRepository(db) {
  return {
    listRecordedDates(activityId) {
      const rows = db
        .prepare(
          `SELECT DISTINCT att.session_date
           FROM attendance att
           JOIN enrollments e ON e.id = att.enrollment_id
           WHERE e.activity_id = ?`,
        )
        .all(activityId);

      return new Set(rows.map((r) => r.session_date));
    },

    countPendingEnrollments(activityId) {
      const row = db
        .prepare("SELECT COUNT(*) AS total FROM enrollments WHERE activity_id = ? AND status = 'pending'")
        .get(activityId);
      return Number(row?.total ?? 0);
    },

    listConfirmedRosterForDate(activityId, sessionDate) {
      const rows = db
        .prepare(
          `SELECT
            e.id AS enrollment_id,
            e.protocol,
            p.id AS participant_id,
            p.name AS participant_name,
            p.phone AS participant_phone,
            att.present AS present
          FROM enrollments e
          JOIN participants p ON p.id = e.participant_id
          LEFT JOIN attendance att
            ON att.enrollment_id = e.id
           AND att.session_date = ?
          WHERE e.activity_id = ?
            AND e.status = 'confirmed'
          ORDER BY p.name COLLATE NOCASE ASC, e.id ASC`,
        )
        .all(sessionDate, activityId);

      return rows.map((row) => ({
        enrollmentId: row.enrollment_id,
        protocol: row.protocol,
        participant: {
          id: row.participant_id,
          name: row.participant_name,
          phone: row.participant_phone,
        },
        present: row.present === null || row.present === undefined ? null : Boolean(row.present),
      }));
    },

    listConfirmedEnrollmentIds(activityId) {
      const rows = db
        .prepare("SELECT id FROM enrollments WHERE activity_id = ? AND status = 'confirmed'")
        .all(activityId);
      return new Set(rows.map((r) => r.id));
    },

    saveAttendanceBatch(sessionDate, records) {
      transaction(db, () => {
        const upsert = db.prepare(
          `INSERT INTO attendance (enrollment_id, session_date, present, recorded_at)
           VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           ON CONFLICT (enrollment_id, session_date)
           DO UPDATE SET
             present = excluded.present,
             recorded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        );

        for (const record of records) {
          upsert.run(record.enrollmentId, sessionDate, record.present ? 1 : 0);
        }
      });
    },
  };
}