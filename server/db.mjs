import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { PRODUCTS } from '../src/data.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(root, 'data');
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(resolve(dataDir, 'saru.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','moderator')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    used_at TEXT
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    price INTEGER NOT NULL CHECK(price >= 0),
    color TEXT NOT NULL,
    tone TEXT NOT NULL,
    accent TEXT NOT NULL,
    material TEXT NOT NULL,
    fit TEXT NOT NULL,
    sizes TEXT NOT NULL,
    image TEXT,
    story TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS cart_items (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    PRIMARY KEY(user_id, product_id, size)
  );
`);

const hashPassword = password => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (password, stored) => {
  const [salt, expected] = stored.split(':');
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
};

const productCount = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
if (!productCount) {
  const insert = db.prepare(`
    INSERT INTO products (id,name,subtitle,price,color,tone,accent,material,fit,sizes,image,story,published)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)
  `);
  for (const p of PRODUCTS) insert.run(p.id,p.name,p.subtitle,p.price,p.color,p.tone,p.accent,p.material,p.fit,JSON.stringify(p.sizes),p.image ?? null,p.story);
}

const moderatorEmail = (process.env.MODERATOR_EMAIL || 'moderator@saru.ru').toLowerCase();
const moderatorPassword = process.env.MODERATOR_PASSWORD || 'SaruDemo2026!';
if (!db.prepare('SELECT id FROM users WHERE email = ?').get(moderatorEmail)) {
  db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
    .run('Модератор', moderatorEmail, hashPassword(moderatorPassword), 'moderator');
}

export const createUser = ({ name, email, password }) => {
  const result = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
    .run(name.trim(), email.trim().toLowerCase(), hashPassword(password), 'customer');
  return getUser(Number(result.lastInsertRowid));
};

export const getUser = id => db.prepare('SELECT id,name,email,role,created_at AS createdAt FROM users WHERE id = ?').get(id);
export const findUserWithPassword = email => db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());

export const createSession = userId => {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  db.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)').run(token,userId,expires);
  return { token, expires };
};

export const userFromSession = token => {
  if (!token) return null;
  return db.prepare(`
    SELECT u.id,u.name,u.email,u.role,u.created_at AS createdAt
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token=? AND s.expires_at>?
  `).get(token,new Date().toISOString()) ?? null;
};

export const deleteSession = token => token && db.prepare('DELETE FROM sessions WHERE token=?').run(token);

const rowToProduct = row => row && ({ ...row, sizes: JSON.parse(row.sizes), published: Boolean(row.published) });
export const listProducts = includeHidden => db.prepare(`SELECT * FROM products ${includeHidden ? '' : 'WHERE published=1'} ORDER BY id`).all().map(rowToProduct);
export const getProduct = id => rowToProduct(db.prepare('SELECT * FROM products WHERE id=?').get(id));

export const saveProduct = product => {
  db.prepare(`
    UPDATE products SET name=?,subtitle=?,price=?,color=?,tone=?,accent=?,material=?,fit=?,sizes=?,image=?,story=?,published=?
    WHERE id=?
  `).run(product.name,product.subtitle,product.price,product.color,product.tone,product.accent,product.material,product.fit,JSON.stringify(product.sizes),product.image||null,product.story,product.published?1:0,product.id);
  return getProduct(product.id);
};

export const getCart = userId => db.prepare(`
  SELECT c.product_id AS productId,c.size,c.quantity,p.*
  FROM cart_items c JOIN products p ON p.id=c.product_id
  WHERE c.user_id=? ORDER BY p.id
`).all(userId).map(row => ({ ...rowToProduct(row), qty: row.quantity, size: row.size }));

export const setCartItem = (userId, productId, size, quantity) => {
  if (quantity <= 0) db.prepare('DELETE FROM cart_items WHERE user_id=? AND product_id=? AND size=?').run(userId,productId,size);
  else db.prepare(`
    INSERT INTO cart_items(user_id,product_id,size,quantity) VALUES(?,?,?,?)
    ON CONFLICT(user_id,product_id,size) DO UPDATE SET quantity=excluded.quantity
  `).run(userId,productId,size,quantity);
  return getCart(userId);
};

export const createReset = email => {
  const user = findUserWithPassword(email);
  if (!user) return null;
  const token = randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + 1000 * 60 * 20).toISOString();
  db.prepare('INSERT INTO password_resets(token,user_id,expires_at) VALUES(?,?,?)').run(token,user.id,expires);
  return token;
};

export const applyReset = (token, password) => {
  const reset = db.prepare('SELECT * FROM password_resets WHERE token=? AND used_at IS NULL AND expires_at>?').get(token,new Date().toISOString());
  if (!reset) return false;
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(password),reset.user_id);
  db.prepare('UPDATE password_resets SET used_at=? WHERE token=?').run(new Date().toISOString(),token);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(reset.user_id);
  return true;
};
