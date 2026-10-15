// Create only missing tables in the database bound to this new Worker.
const statements=[
  "CREATE TABLE IF NOT EXISTS guard_submissions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('FUTURE_SWITCH','MISSING_HOURS')),payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING',partner_user_id TEXT REFERENCES users(id),partner_status TEXT NOT NULL DEFAULT 'NONE',decision_note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,decided_by TEXT,decided_at TEXT)",
  "CREATE TABLE IF NOT EXISTS phone_access (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, phone TEXT NOT NULL UNIQUE, code_hash TEXT NOT NULL DEFAULT '', expires_at INTEGER NOT NULL DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, guard_name TEXT NOT NULL DEFAULT '', role TEXT NOT NULL CHECK(role IN ('ADMIN','MANAGER','GUARD')), password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0, must_change INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)",
  "CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, write_nonce TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS workspace_versions (id TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL, actor TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL CHECK(kind IN ('VACATION','SWITCH')), payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', partner_user_id TEXT REFERENCES users(id), partner_status TEXT NOT NULL DEFAULT 'NONE', decision_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT)",
  "CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at INTEGER NOT NULL)"
];
const pending=new WeakMap();
export async function ensureSchema(db){
 if(!pending.has(db))pending.set(db,db.batch(statements.map(sql=>db.prepare(sql))).catch(error=>{pending.delete(db);throw error;}));
 await pending.get(db);
}
