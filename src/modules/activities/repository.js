function mapInstructor(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    bio: row.bio,
    phone: row.phone,
    email: row.email,
    active: Boolean(row.active),
  };
}

function mapSchedule(row) {
  return {
    id: row.id,
    weekday: row.weekday,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

function runInTransaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function createActivitiesRepository(db) {
  function listSchedulesByActivityIds(ids) {
    if (ids.length === 0) return new Map();
    const placeholders = ids.map(() => '?').join(', ');
    const rows = db
      .prepare(
        `SELECT id, activity_id, weekday, start_time, end_time
         FROM activity_schedules
         WHERE activity_id IN (${placeholders})
         ORDER BY weekday ASC, start_time ASC, id ASC`,
      )
      .all(...ids);

    const byActivity = new Map();
    for (const row of rows) {
      const list = byActivity.get(row.activity_id) ?? [];
      list.push(mapSchedule(row));
      byActivity.set(row.activity_id, list);
    }
    return byActivity;
  }

  function hydrateActivities(rows) {
    if (rows.length === 0) return [];
    const schedulesMap = listSchedulesByActivityIds(rows.map((r) => r.id));

    return rows.map((row) => {
      const enrolledCount = repo.countActiveEnrollments(row.id);
      const seatsAvailable = Math.max(0, row.capacity - enrolledCount);

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        type: row.type,
        categoryId: row.category_id,
        category: {
          id: row.category_id,
          name: row.category_name,
        },
        instructorId: row.instructor_id,
        instructor: row.instructor_id
          ? {
              id: row.instructor_id,
              name: row.instructor_name,
              bio: row.instructor_bio,
              active: Boolean(row.instructor_active),
            }
          : null,
        location: row.location,
        startDate: row.start_date,
        endDate: row.end_date,
        capacity: row.capacity,
        minAge: row.min_age,
        status: row.status,
        schedules: schedulesMap.get(row.id) ?? [],
        enrolledCount,
        seatsAvailable,
        soldOut: seatsAvailable === 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  function toPublicActivity(activity) {
    return {
      id: activity.id,
      title: activity.title,
      description: activity.description,
      type: activity.type,
      category: activity.category,
      instructor: activity.instructor
        ? {
            id: activity.instructor.id,
            name: activity.instructor.name,
            bio: activity.instructor.bio,
          }
        : null,
      location: activity.location,
      startDate: activity.startDate,
      endDate: activity.endDate,
      minAge: activity.minAge,
      schedules: activity.schedules,
      capacity: activity.capacity,
      seatsAvailable: activity.seatsAvailable,
      soldOut: activity.soldOut,
    };
  }

  const BASE_ACTIVITY_SELECT = `
    SELECT
      a.id,
      a.title,
      a.description,
      a.type,
      a.category_id,
      c.name AS category_name,
      a.instructor_id,
      i.name AS instructor_name,
      i.bio AS instructor_bio,
      i.active AS instructor_active,
      a.location,
      a.start_date,
      a.end_date,
      a.capacity,
      a.min_age,
      a.status,
      a.created_at,
      a.updated_at
    FROM activities a
    JOIN categories c ON c.id = a.category_id
    LEFT JOIN instructors i ON i.id = a.instructor_id
  `;

  const repo = {
    // Categories
    listCategories() {
      return db.prepare('SELECT id, name FROM categories ORDER BY name COLLATE NOCASE ASC').all();
    },

    findCategoryById(id) {
      return db.prepare('SELECT id, name FROM categories WHERE id = ?').get(id) ?? null;
    },

    findCategoryByName(name) {
      return db.prepare('SELECT id, name FROM categories WHERE name = ?').get(name) ?? null;
    },

    createCategory({ name }) {
      const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
      return this.findCategoryById(Number(result.lastInsertRowid));
    },

    updateCategory(id, { name }) {
      db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id);
      return this.findCategoryById(id);
    },

    // Instructors
    listInstructors() {
      const rows = db
        .prepare('SELECT id, name, bio, phone, email, active FROM instructors ORDER BY name COLLATE NOCASE ASC')
        .all();
      return rows.map(mapInstructor);
    },

    findInstructorById(id) {
      const row = db
        .prepare('SELECT id, name, bio, phone, email, active FROM instructors WHERE id = ?')
        .get(id);
      return mapInstructor(row);
    },

    createInstructor({ name, bio, phone, email, active = true }) {
      const result = db
        .prepare('INSERT INTO instructors (name, bio, phone, email, active) VALUES (?, ?, ?, ?, ?)')
        .run(name, bio, phone, email, active ? 1 : 0);
      return this.findInstructorById(Number(result.lastInsertRowid));
    },

    updateInstructor(id, { name, bio, phone, email, active }) {
      db.prepare('UPDATE instructors SET name = ?, bio = ?, phone = ?, email = ?, active = ? WHERE id = ?').run(
        name,
        bio,
        phone,
        email,
        active ? 1 : 0,
        id,
      );
      return this.findInstructorById(id);
    },

    // Enrollments count hook (returns 0 until enrollments table exists in T15)
    countActiveEnrollments(activityId) {
      const row = db
        .prepare("SELECT COUNT(*) AS total FROM enrollments WHERE activity_id = ? AND status <> 'cancelled'")
        .get(activityId);
      return Number(row?.total ?? 0);
    },

    // Activities (Public)
    listPublishedActivities({ q, category, type } = {}) {
      const conditions = ["a.status = 'published'"];
      const params = [];

      if (category !== undefined && category !== '') {
        const categoryId = Number(category);
        if (!Number.isInteger(categoryId) || categoryId <= 0) return [];
        conditions.push('a.category_id = ?');
        params.push(categoryId);
      }

      if (type !== undefined && type !== '') {
        conditions.push('a.type = ?');
        params.push(String(type).trim());
      }

      const rows = db
        .prepare(
          `${BASE_ACTIVITY_SELECT}
           WHERE ${conditions.join(' AND ')}
           ORDER BY a.start_date ASC, a.id ASC`,
        )
        .all(...params);

      let activities = hydrateActivities(rows).map(toPublicActivity);

      const searchTerm = String(q ?? '').trim().toLocaleLowerCase('pt-BR');
      if (searchTerm) {
        activities = activities.filter((item) => {
          const title = String(item.title ?? '').toLocaleLowerCase('pt-BR');
          const description = String(item.description ?? '').toLocaleLowerCase('pt-BR');
          return title.includes(searchTerm) || description.includes(searchTerm);
        });
      }

      return activities;
    },

    findPublishedActivityById(id) {
      const row = db
        .prepare(`${BASE_ACTIVITY_SELECT} WHERE a.id = ? AND a.status = 'published'`)
        .get(id);
      if (!row) return null;
      return toPublicActivity(hydrateActivities([row])[0]);
    },

    // Activities (Admin)
    listAllActivities() {
      const rows = db
        .prepare(`${BASE_ACTIVITY_SELECT} ORDER BY a.start_date ASC, a.id DESC`)
        .all();
      return hydrateActivities(rows);
    },

    findActivityById(id) {
      const row = db.prepare(`${BASE_ACTIVITY_SELECT} WHERE a.id = ?`).get(id);
      if (!row) return null;
      return hydrateActivities([row])[0];
    },

    createActivity({
      title,
      description,
      type,
      categoryId,
      instructorId,
      location,
      startDate,
      endDate,
      capacity,
      minAge,
      schedules,
    }) {
      const activityId = runInTransaction(db, () => {
        const result = db
          .prepare(
            `INSERT INTO activities (
              title, description, type, category_id, instructor_id,
              location, start_date, end_date, capacity, min_age, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
          )
          .run(
            title,
            description,
            type,
            categoryId,
            instructorId,
            location,
            startDate,
            endDate,
            capacity,
            minAge,
          );

        const newId = Number(result.lastInsertRowid);
        const insertSchedule = db.prepare(
          'INSERT INTO activity_schedules (activity_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)',
        );

        for (const s of schedules) {
          insertSchedule.run(newId, s.weekday, s.startTime, s.endTime);
        }

        return newId;
      });

      return this.findActivityById(activityId);
    },

    updateActivity(
      id,
      {
        title,
        description,
        type,
        categoryId,
        instructorId,
        location,
        startDate,
        endDate,
        capacity,
        minAge,
        schedules,
      },
    ) {
      runInTransaction(db, () => {
        db.prepare(
          `UPDATE activities
           SET title = ?,
               description = ?,
               type = ?,
               category_id = ?,
               instructor_id = ?,
               location = ?,
               start_date = ?,
               end_date = ?,
               capacity = ?,
               min_age = ?,
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?`,
        ).run(
          title,
          description,
          type,
          categoryId,
          instructorId,
          location,
          startDate,
          endDate,
          capacity,
          minAge,
          id,
        );

        db.prepare('DELETE FROM activity_schedules WHERE activity_id = ?').run(id);

        const insertSchedule = db.prepare(
          'INSERT INTO activity_schedules (activity_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)',
        );
        for (const s of schedules) {
          insertSchedule.run(id, s.weekday, s.startTime, s.endTime);
        }
      });

      return this.findActivityById(id);
    },

    updateActivityStatus(id, status) {
      db.prepare(
        `UPDATE activities
         SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`,
      ).run(status, id);
      return this.findActivityById(id);
    },
  };

  return repo;
}