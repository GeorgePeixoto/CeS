export function normalizePersonName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function createEnrollmentsRepository(db) {
  return {
    findParticipantByPhoneAndNormalizedName(phone, normalizedName) {
      const rows = db
        .prepare(
          'SELECT id, name, phone, email, birth_date, guardian_name, guardian_phone, created_at FROM participants WHERE phone = ? ORDER BY id ASC',
        )
        .all(phone);

      return rows.find((row) => normalizePersonName(row.name) === normalizedName) ?? null;
    },

    createParticipant({ name, phone, email, birthDate, guardianName, guardianPhone }) {
      const result = db
        .prepare(
          `INSERT INTO participants (name, phone, email, birth_date, guardian_name, guardian_phone)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(name, phone, email, birthDate, guardianName, guardianPhone);

      return db
        .prepare(
          'SELECT id, name, phone, email, birth_date, guardian_name, guardian_phone, created_at FROM participants WHERE id = ?',
        )
        .get(Number(result.lastInsertRowid));
    },

    updateParticipantContactAndGuardian(id, { email, guardianName, guardianPhone }) {
      db.prepare(
        `UPDATE participants
         SET email = COALESCE(?, email),
             guardian_name = COALESCE(?, guardian_name),
             guardian_phone = COALESCE(?, guardian_phone)
         WHERE id = ?`,
      ).run(email, guardianName, guardianPhone, id);
    },

    countActiveByActivity(activityId) {
      const row = db
        .prepare("SELECT COUNT(*) AS total FROM enrollments WHERE activity_id = ? AND status <> 'cancelled'")
        .get(activityId);
      return Number(row?.total ?? 0);
    },

    findActiveEnrollment(activityId, participantId) {
      return (
        db
          .prepare(
            "SELECT id, protocol, status FROM enrollments WHERE activity_id = ? AND participant_id = ? AND status <> 'cancelled'",
          )
          .get(activityId, participantId) ?? null
      );
    },

    protocolExists(protocol) {
      const row = db.prepare('SELECT 1 AS found FROM enrollments WHERE protocol = ?').get(protocol);
      return Boolean(row);
    },

    createEnrollment({ activityId, participantId, protocol, status = 'pending', consentAt }) {
      const result = db
        .prepare(
          `INSERT INTO enrollments (activity_id, participant_id, protocol, status, consent_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(activityId, participantId, protocol, status, consentAt);

      return db
        .prepare(
          'SELECT id, activity_id, participant_id, protocol, status, consent_at, created_at FROM enrollments WHERE id = ?',
        )
        .get(Number(result.lastInsertRowid));
    },

    findEnrollmentByProtocolAndPhone(protocol, phone) {
      const row = db
        .prepare(
          `SELECT
            e.protocol,
            e.status,
            p.name AS participant_name,
            a.id AS activity_id,
            a.title AS activity_title,
            a.type AS activity_type,
            a.location AS activity_location,
            a.start_date AS activity_start_date,
            a.end_date AS activity_end_date,
            c.id AS category_id,
            c.name AS category_name
          FROM enrollments e
          JOIN participants p ON p.id = e.participant_id
          JOIN activities a ON a.id = e.activity_id
          JOIN categories c ON c.id = a.category_id
          WHERE e.protocol = ? AND p.phone = ?`,
        )
        .get(protocol, phone);

      if (!row) return null;

      const schedules = db
        .prepare(
          `SELECT id, weekday, start_time, end_time
           FROM activity_schedules
           WHERE activity_id = ?
           ORDER BY weekday ASC, start_time ASC, id ASC`,
        )
        .all(row.activity_id)
        .map((s) => ({
          id: s.id,
          weekday: s.weekday,
          startTime: s.start_time,
          endTime: s.end_time,
        }));

      return {
        protocol: row.protocol,
        status: row.status,
        participantName: row.participant_name,
        activity: {
          id: row.activity_id,
          title: row.activity_title,
          type: row.activity_type,
          category: {
            id: row.category_id,
            name: row.category_name,
          },
          location: row.activity_location,
          startDate: row.activity_start_date,
          endDate: row.activity_end_date,
          schedules,
        },
      };
    },

    // Admin — Inscrições
    findEnrollmentById(id) {
      return (
        db
          .prepare(
            `SELECT
              e.id,
              e.activity_id,
              e.participant_id,
              e.protocol,
              e.status,
              e.consent_at,
              e.created_at,
              e.updated_at,
              a.title AS activity_title,
              a.start_date AS activity_start_date,
              a.end_date AS activity_end_date,
              p.name AS participant_name,
              p.phone AS participant_phone,
              p.email AS participant_email,
              p.birth_date AS participant_birth_date,
              p.guardian_name AS participant_guardian_name,
              p.guardian_phone AS participant_guardian_phone
            FROM enrollments e
            JOIN activities a ON a.id = e.activity_id
            JOIN participants p ON p.id = e.participant_id
            WHERE e.id = ?`,
          )
          .get(id) ?? null
      );
    },

    listAdminEnrollments({ activityId, status } = {}) {
      const conditions = [];
      const params = [];

      if (activityId !== undefined && activityId !== '') {
        const parsedId = Number(activityId);
        if (!Number.isInteger(parsedId) || parsedId <= 0) return [];
        conditions.push('e.activity_id = ?');
        params.push(parsedId);
      }

      if (status !== undefined && status !== '') {
        conditions.push('e.status = ?');
        params.push(String(status).trim());
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      return db
        .prepare(
          `SELECT
            e.id,
            e.activity_id,
            e.participant_id,
            e.protocol,
            e.status,
            e.consent_at,
            e.created_at,
            e.updated_at,
            a.title AS activity_title,
            a.start_date AS activity_start_date,
            a.end_date AS activity_end_date,
            p.name AS participant_name,
            p.phone AS participant_phone,
            p.email AS participant_email,
            p.birth_date AS participant_birth_date,
            p.guardian_name AS participant_guardian_name,
            p.guardian_phone AS participant_guardian_phone
          FROM enrollments e
          JOIN activities a ON a.id = e.activity_id
          JOIN participants p ON p.id = e.participant_id
          ${whereClause}
          ORDER BY e.created_at DESC, e.id DESC`,
        )
        .all(...params);
    },

    updateEnrollmentStatus(id, status) {
      db.prepare(
        `UPDATE enrollments
         SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`,
      ).run(status, id);
      return this.findEnrollmentById(id);
    },

    // Admin — Participantes
    listParticipants() {
      return db
        .prepare(
          `SELECT
            p.id,
            p.name,
            p.phone,
            p.email,
            p.birth_date,
            p.guardian_name,
            p.guardian_phone,
            p.created_at,
            COUNT(e.id) AS total_enrollments,
            SUM(CASE WHEN e.status <> 'cancelled' THEN 1 ELSE 0 END) AS active_enrollments
          FROM participants p
          LEFT JOIN enrollments e ON e.participant_id = p.id
          GROUP BY p.id
          ORDER BY p.name COLLATE NOCASE ASC, p.id ASC`,
        )
        .all();
    },

    findParticipantById(id) {
      return (
        db
          .prepare(
            'SELECT id, name, phone, email, birth_date, guardian_name, guardian_phone, created_at FROM participants WHERE id = ?',
          )
          .get(id) ?? null
      );
    },

    listEnrollmentsByParticipant(participantId) {
      return db
        .prepare(
          `SELECT
            e.id,
            e.protocol,
            e.status,
            e.created_at,
            e.updated_at,
            a.id AS activity_id,
            a.title AS activity_title,
            a.type AS activity_type,
            a.start_date AS activity_start_date,
            a.end_date AS activity_end_date
          FROM enrollments e
          JOIN activities a ON a.id = e.activity_id
          WHERE e.participant_id = ?
          ORDER BY e.created_at DESC, e.id DESC`,
        )
        .all(participantId);
    },

    updateParticipant(id, { name, phone, email, birthDate, guardianName, guardianPhone }) {
      db.prepare(
        `UPDATE participants
         SET name = ?,
             phone = ?,
             email = ?,
             birth_date = ?,
             guardian_name = ?,
             guardian_phone = ?
         WHERE id = ?`,
      ).run(name, phone, email, birthDate, guardianName, guardianPhone, id);

      return this.findParticipantById(id);
    },
  };
}