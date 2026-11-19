export function createReportsRepository(db) {
  return {
    getSummary({ from = null, to = null, categoryId = null } = {}) {
      const conditions = ["a.status IN ('published', 'cancelled')"];
      const params = [];

      if (from) {
        conditions.push('a.start_date >= ?');
        params.push(from);
      }

      if (to) {
        conditions.push('a.start_date <= ?');
        params.push(to);
      }

      if (categoryId !== null && categoryId !== undefined) {
        conditions.push('a.category_id = ?');
        params.push(categoryId);
      }

      const whereClause = conditions.join(' AND ');

      const activityRows = db
        .prepare(
          `SELECT
            a.id,
            a.title,
            a.capacity,
            c.name AS category_name,
            COALESCE(enr.enrolled, 0) AS enrolled,
            COALESCE(enr.confirmed, 0) AS confirmed,
            COALESCE(att.total_records, 0) AS attendance_total,
            COALESCE(att.present_records, 0) AS attendance_present
          FROM activities a
          JOIN categories c ON c.id = a.category_id
          LEFT JOIN (
            SELECT
              activity_id,
              SUM(CASE WHEN status <> 'cancelled' THEN 1 ELSE 0 END) AS enrolled,
              SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed
            FROM enrollments
            GROUP BY activity_id
          ) enr ON enr.activity_id = a.id
          LEFT JOIN (
            SELECT
              e.activity_id,
              COUNT(att.id) AS total_records,
              SUM(CASE WHEN att.present = 1 THEN 1 ELSE 0 END) AS present_records
            FROM attendance att
            JOIN enrollments e ON e.id = att.enrollment_id
            GROUP BY e.activity_id
          ) att ON att.activity_id = a.id
          WHERE ${whereClause}
          ORDER BY a.start_date ASC, a.id ASC`,
        )
        .all(...params);

      const distinctParticipantsRow = db
        .prepare(
          `SELECT COUNT(DISTINCT e.participant_id) AS total
           FROM enrollments e
           JOIN activities a ON a.id = e.activity_id
           WHERE ${whereClause}
             AND e.status <> 'cancelled'`,
        )
        .get(...params);

      const categoryMap = new Map();

      const byActivity = activityRows.map((row) => {
        const capacity = Number(row.capacity);
        const enrolled = Number(row.enrolled ?? 0);
        const confirmed = Number(row.confirmed ?? 0);
        const attendanceTotal = Number(row.attendance_total ?? 0);
        const attendancePresent = Number(row.attendance_present ?? 0);

        const occupancy = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
        const attendanceRate =
          attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : null;

        categoryMap.set(
          row.category_name,
          (categoryMap.get(row.category_name) ?? 0) + enrolled,
        );

        return {
          id: row.id,
          title: row.title,
          category: row.category_name,
          capacity,
          enrolled,
          confirmed,
          occupancy,
          attendanceRate,
        };
      });

      const byCategory = [...categoryMap.entries()].map(([category, enrolled]) => ({
        category,
        enrolled,
      }));

      const activitiesCount = byActivity.length;
      const enrollmentsTotal = byActivity.reduce((sum, item) => sum + item.enrolled, 0);
      const participantsTotal = Number(distinctParticipantsRow?.total ?? 0);

      const avgOccupancy =
        activitiesCount > 0
          ? Math.round(byActivity.reduce((sum, item) => sum + item.occupancy, 0) / activitiesCount)
          : 0;

      const withAttendance = byActivity.filter((item) => item.attendanceRate !== null);
      const avgAttendance =
        withAttendance.length > 0
          ? Math.round(
              withAttendance.reduce((sum, item) => sum + item.attendanceRate, 0) /
                withAttendance.length,
            )
          : null;

      return {
        totals: {
          activities: activitiesCount,
          enrollments: enrollmentsTotal,
          participants: participantsTotal,
          avgOccupancy,
          avgAttendance,
        },
        byActivity,
        byCategory,
      };
    },
  };
}