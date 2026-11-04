import session from 'express-session';

export class SQLiteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.getStatement = db.prepare('SELECT sess FROM quest_sessions WHERE sid = ? AND expires > ?');
    this.setStatement = db.prepare(`INSERT INTO quest_sessions(sid, sess, expires) VALUES(?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`);
    this.deleteStatement = db.prepare('DELETE FROM quest_sessions WHERE sid = ?');
  }

  get(sid, callback) {
    try {
      const row = this.getStatement.get(sid, Date.now());
      callback(null, row ? JSON.parse(row.sess) : null);
    } catch (error) { callback(error); }
  }

  set(sid, value, callback = () => {}) {
    try {
      const expires = value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 86400000;
      this.setStatement.run(sid, JSON.stringify(value), expires);
      callback(null);
    } catch (error) { callback(error); }
  }

  touch(sid, value, callback = () => {}) { this.set(sid, value, callback); }
  destroy(sid, callback = () => {}) {
    try { this.deleteStatement.run(sid); callback(null); }
    catch (error) { callback(error); }
  }
}