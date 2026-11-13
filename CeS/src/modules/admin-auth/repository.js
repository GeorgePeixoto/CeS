// SQL for admin_users. Rows include passwordHash; never send them to clients as-is.

const toUser = (row) => row && {
  id: row.id,
  name: row.name,
  email: row.email,
  passwordHash: row.password_hash,
  createdAt: row.created_at,
};

export function createAdminUserRepository(db) {
  const byEmail = db.prepare('SELECT * FROM admin_users WHERE email = ?');
  const byId = db.prepare('SELECT * FROM admin_users WHERE id = ?');
  const insert = db.prepare(
    'INSERT INTO admin_users (name, email, password_hash) VALUES (?, ?, ?) RETURNING *',
  );

  return {
    findByEmail: (email) => toUser(byEmail.get(email)),
    findById: (id) => toUser(byId.get(id)),
    create: ({ name, email, passwordHash }) => toUser(insert.get(name, email, passwordHash)),
  };
}
