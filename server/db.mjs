import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { PRODUCTS } from '../src/data.js';

const { Pool } = pg;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://saru:saru@127.0.0.1:5432/saru' });

const hashPassword = password => {
  const salt=randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;
};

export const verifyPassword = (password,stored) => {
  try {
    const [salt,expected]=String(stored||'').split(':');
    const expectedBuffer=Buffer.from(expected||'','hex');
    if(!salt||expectedBuffer.length!==64)return false;
    return timingSafeEqual(scryptSync(password,salt,64),expectedBuffer);
  } catch { return false; }
};

const productSelect = `
  SELECT p.*,
    COALESCE((SELECT json_agg(json_build_object('size',v.size,'stock',v.stock) ORDER BY v.size) FROM product_variants v WHERE v.product_id=p.id),'[]') AS variants,
    COALESCE((SELECT json_agg(json_build_object('id',i.id,'url',i.url,'altText',i.alt_text,'position',i.position) ORDER BY i.position,i.id) FROM product_images i WHERE i.product_id=p.id),'[]') AS images
  FROM products p
`;

const normalizeProduct = row => row && ({
  ...row,
  id:Number(row.id),
  position:Number(row.position),
  sizes:row.variants.map(v=>v.size),
  variants:row.variants.map(v=>({...v,stock:Number(v.stock)})),
  image:row.images[0]?.url || null,
});

export async function initDb() {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  const migrations=[
    ['001_initial.sql',resolve(root,'server/schema.sql')],
    ['002_security_audit.sql',resolve(root,'server/migrations/002_security_audit.sql')],
    ['003_customer_profile.sql',resolve(root,'server/migrations/003_customer_profile.sql')],
    ['004_refresh_seed_products.sql',resolve(root,'server/migrations/004_refresh_seed_products.sql')],
  ];
  for(const [name,path] of migrations){
    const applied=await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name]);
    if(applied.rowCount)continue;
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query(await readFile(path,'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error}
    finally{client.release()}
  }
  const {rows:[count]}=await pool.query('SELECT COUNT(*)::int AS count FROM products');
  if(!count.count) {
    for(const [position,p] of PRODUCTS.entries()) {
      const {rows:[created]}=await pool.query(`
        INSERT INTO products(id,name,subtitle,price,color,tone,accent,material,fit,story,published,position)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11) RETURNING id
      `,[p.id,p.name,p.subtitle,p.price,p.color,p.tone,p.accent,p.material,p.fit,p.story,position]);
      for(const size of p.sizes) await pool.query('INSERT INTO product_variants(product_id,size,stock) VALUES($1,$2,12)',[created.id,size]);
      if(p.image) await pool.query('INSERT INTO product_images(product_id,url,alt_text,position) VALUES($1,$2,$3,0)',[created.id,p.image,p.name]);
    }
    await pool.query(`SELECT setval(pg_get_serial_sequence('products','id'),(SELECT MAX(id) FROM products))`);
  }
  const email=(process.env.MODERATOR_EMAIL||'moderator@saru.ru').toLowerCase();
  const existing=await pool.query('SELECT id FROM users WHERE email=$1',[email]);
  if(!existing.rowCount) await pool.query('INSERT INTO users(name,email,password_hash,role,email_verified) VALUES($1,$2,$3,$4,TRUE)',[
    'Модератор',email,hashPassword(process.env.MODERATOR_PASSWORD||'SaruDemo2026!'),'moderator',
  ]);
}

export async function createUser({name,email,password}) {
  const {rows:[user]}=await pool.query(`
    INSERT INTO users(name,email,password_hash) VALUES($1,LOWER($2),$3)
    RETURNING id,name,email,role,email_verified AS "emailVerified",created_at AS "createdAt"
  `,[name.trim(),email.trim(),hashPassword(password)]);
  return {...user,id:Number(user.id)};
}

export async function findUserWithPassword(email) {
  const {rows}=await pool.query('SELECT * FROM users WHERE email=LOWER($1)',[email.trim()]);
  return rows[0]||null;
}

export async function createSession(userId) {
  const token=randomBytes(32).toString('base64url');
  const expires=new Date(Date.now()+30*86400000);
  await pool.query('DELETE FROM sessions WHERE expires_at<NOW()');
  await pool.query('INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,$3)',[token,userId,expires]);
  return {token,expires};
}

export async function userFromSession(token) {
  if(!token) return null;
  const {rows}=await pool.query(`
    SELECT u.id,u.name,u.email,u.role,u.email_verified AS "emailVerified",u.created_at AS "createdAt"
    FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>NOW()
  `,[token]);
  return rows[0]?{...rows[0],id:Number(rows[0].id)}:null;
}

const verificationHash=token=>createHash('sha256').update(token).digest('hex');

export async function createEmailVerification(userId) {
  const token=randomBytes(32).toString('base64url');
  await pool.query('DELETE FROM email_verification_tokens WHERE user_id=$1 OR expires_at<NOW()',[userId]);
  await pool.query(`
    INSERT INTO email_verification_tokens(token_hash,user_id,expires_at)
    VALUES($1,$2,NOW()+INTERVAL '24 hours')
  `,[verificationHash(token),userId]);
  return token;
}

export async function verifyEmailToken(token) {
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const {rows:[record]}=await client.query(`
      SELECT * FROM email_verification_tokens
      WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() FOR UPDATE
    `,[verificationHash(String(token||''))]);
    if(!record){await client.query('ROLLBACK');return false}
    await client.query('UPDATE users SET email_verified=TRUE WHERE id=$1',[record.user_id]);
    await client.query('UPDATE email_verification_tokens SET used_at=NOW() WHERE token_hash=$1',[record.token_hash]);
    await client.query('COMMIT');return true;
  }catch(error){await client.query('ROLLBACK');throw error}
  finally{client.release()}
}

export async function updateProfileName(userId,name) {
  const {rows:[user]}=await pool.query(`
    UPDATE users SET name=$1 WHERE id=$2
    RETURNING id,name,email,role,email_verified AS "emailVerified",created_at AS "createdAt"
  `,[name.trim(),userId]);
  return user;
}

export async function changePassword(userId,currentPassword,newPassword) {
  const {rows:[user]}=await pool.query('SELECT password_hash FROM users WHERE id=$1',[userId]);
  if(!user||!verifyPassword(currentPassword,user.password_hash))return false;
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('UPDATE users SET password_hash=$1 WHERE id=$2',[hashPassword(newPassword),userId]);
    await client.query('DELETE FROM sessions WHERE user_id=$1',[userId]);
    await client.query('COMMIT');return true;
  }catch(error){await client.query('ROLLBACK');throw error}
  finally{client.release()}
}

export async function listAddresses(userId) {
  const {rows}=await pool.query('SELECT * FROM user_addresses WHERE user_id=$1 ORDER BY is_default DESC,id',[userId]);
  return rows;
}

export async function saveAddress(userId,address) {
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    if(address.isDefault)await client.query('UPDATE user_addresses SET is_default=FALSE WHERE user_id=$1',[userId]);
    let row;
    if(address.id){
      const result=await client.query(`
        UPDATE user_addresses SET label=$1,recipient_name=$2,phone=$3,city=$4,street=$5,house=$6,apartment=$7,postal_code=$8,is_default=$9,updated_at=NOW()
        WHERE id=$10 AND user_id=$11 RETURNING *
      `,[address.label,address.recipientName,address.phone,address.city,address.street,address.house,address.apartment||'',address.postalCode||'',Boolean(address.isDefault),address.id,userId]);
      row=result.rows[0];
    }else{
      const result=await client.query(`
        INSERT INTO user_addresses(user_id,label,recipient_name,phone,city,street,house,apartment,postal_code,is_default)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
      `,[userId,address.label,address.recipientName,address.phone,address.city,address.street,address.house,address.apartment||'',address.postalCode||'',Boolean(address.isDefault)]);
      row=result.rows[0];
    }
    if(!row)throw Object.assign(new Error('Адрес не найден'),{status:404});
    await client.query('COMMIT');return row;
  }catch(error){await client.query('ROLLBACK');throw error}
  finally{client.release()}
}

export async function deleteAddress(userId,addressId) {
  const result=await pool.query('DELETE FROM user_addresses WHERE id=$1 AND user_id=$2',[addressId,userId]);
  return result.rowCount>0;
}

export async function deleteCustomerAccount(userId,password) {
  const {rows:[user]}=await pool.query('SELECT password_hash,role FROM users WHERE id=$1',[userId]);
  if(!user||user.role==='moderator'||!verifyPassword(password,user.password_hash))return false;
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const {rows:[orders]}=await client.query('SELECT COUNT(*)::int AS count FROM orders WHERE user_id=$1',[userId]);
    if(orders.count){
      const anonymous=`deleted-${userId}-${randomBytes(5).toString('hex')}@deleted.invalid`;
      await client.query(`
        UPDATE users SET name='Удалённый пользователь',email=$1,password_hash=$2,email_verified=FALSE WHERE id=$3
      `,[anonymous,hashPassword(randomBytes(32).toString('hex')),userId]);
      await client.query('DELETE FROM sessions WHERE user_id=$1',[userId]);
      await client.query('DELETE FROM cart_items WHERE user_id=$1',[userId]);
      await client.query('DELETE FROM user_addresses WHERE user_id=$1',[userId]);
      await client.query(`
        UPDATE orders SET customer_name='Удалённый пользователь',phone='',email=$1,address='',comment=''
        WHERE user_id=$2
      `,[anonymous,userId]);
    }else await client.query('DELETE FROM users WHERE id=$1',[userId]);
    await client.query('COMMIT');return true;
  }catch(error){await client.query('ROLLBACK');throw error}
  finally{client.release()}
}

export const deleteSession = token => token ? pool.query('DELETE FROM sessions WHERE token=$1',[token]) : null;

export async function listProducts(includeHidden=false) {
  const {rows}=await pool.query(`${productSelect} ${includeHidden?'':'WHERE p.published=TRUE'} ORDER BY p.position,p.id`);
  return rows.map(normalizeProduct);
}

export async function getProduct(id) {
  const {rows}=await pool.query(`${productSelect} WHERE p.id=$1`,[id]);
  return normalizeProduct(rows[0]);
}

export async function createProduct(product) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const {rows:[created]}=await client.query(`
      INSERT INTO products(name,subtitle,price,color,tone,accent,material,fit,story,published,position)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE((SELECT MAX(position)+1 FROM products),0)) RETURNING id
    `,[product.name,product.subtitle||'',product.price,product.color||'',product.tone||'#eee8dc',product.accent||'#cdbda5',product.material||'',product.fit||'',product.story||'',Boolean(product.published)]);
    for(const v of product.variants||[]) await client.query('INSERT INTO product_variants(product_id,size,stock) VALUES($1,$2,$3)',[created.id,v.size,v.stock||0]);
    await client.query('COMMIT');
    return getProduct(created.id);
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function saveProduct(product) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      UPDATE products SET name=$1,subtitle=$2,price=$3,color=$4,tone=$5,accent=$6,material=$7,fit=$8,story=$9,published=$10,updated_at=NOW()
      WHERE id=$11
    `,[product.name,product.subtitle||'',product.price,product.color||'',product.tone,product.accent,product.material||'',product.fit||'',product.story||'',Boolean(product.published),product.id]);
    await client.query('DELETE FROM product_variants WHERE product_id=$1 AND size<>ALL($2::text[])',[product.id,(product.variants||[]).map(v=>v.size)]);
    for(const v of product.variants||[]) await client.query(`
      INSERT INTO product_variants(product_id,size,stock) VALUES($1,$2,$3)
      ON CONFLICT(product_id,size) DO UPDATE SET stock=EXCLUDED.stock
    `,[product.id,v.size,Math.max(0,Number(v.stock)||0)]);
    await client.query('COMMIT');
    return getProduct(product.id);
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function deleteProduct(id) {
  const result=await pool.query('DELETE FROM products WHERE id=$1',[id]);
  return result.rowCount>0;
}

export async function addProductImage(productId,url,altText='') {
  await pool.query('INSERT INTO product_images(product_id,url,alt_text,position) VALUES($1,$2,$3,COALESCE((SELECT MAX(position)+1 FROM product_images WHERE product_id=$1),0))',[productId,url,altText]);
  return getProduct(productId);
}

export async function deleteProductImage(productId,imageId) {
  await pool.query('DELETE FROM product_images WHERE id=$1 AND product_id=$2',[imageId,productId]);
  return getProduct(productId);
}

export async function getCart(userId) {
  const {rows}=await pool.query(`
    SELECT c.size,c.quantity,p.*,
      json_build_array(json_build_object('size',v.size,'stock',v.stock)) AS variants,
      COALESCE((SELECT json_agg(json_build_object('id',i.id,'url',i.url,'altText',i.alt_text,'position',i.position) ORDER BY i.position,i.id) FROM product_images i WHERE i.product_id=p.id),'[]') AS images
    FROM cart_items c JOIN products p ON p.id=c.product_id
    JOIN product_variants v ON v.product_id=c.product_id AND v.size=c.size
    WHERE c.user_id=$1 ORDER BY p.id
  `,[userId]);
  return rows.map(row=>({...normalizeProduct(row),qty:Number(row.quantity),size:row.size,stock:Number(row.variants[0].stock)}));
}

export async function setCartItem(userId,productId,size,quantity) {
  if(quantity<=0) await pool.query('DELETE FROM cart_items WHERE user_id=$1 AND product_id=$2 AND size=$3',[userId,productId,size]);
  else {
    const {rows:[variant]}=await pool.query('SELECT stock FROM product_variants WHERE product_id=$1 AND size=$2',[productId,size]);
    if(!variant) throw Object.assign(new Error('Размер недоступен'),{status:400});
    if(quantity>variant.stock) throw Object.assign(new Error(`В наличии: ${variant.stock}`),{status:409});
    await pool.query(`
      INSERT INTO cart_items(user_id,product_id,size,quantity) VALUES($1,$2,$3,$4)
      ON CONFLICT(user_id,product_id,size) DO UPDATE SET quantity=EXCLUDED.quantity
    `,[userId,productId,size,quantity]);
  }
  return getCart(userId);
}

export async function createOrder(userId,data) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const {rows:items}=await client.query(`
      SELECT c.product_id,c.size,c.quantity,p.name,p.price,v.stock
      FROM cart_items c JOIN products p ON p.id=c.product_id
      JOIN product_variants v ON v.product_id=c.product_id AND v.size=c.size
      WHERE c.user_id=$1 FOR UPDATE OF v
    `,[userId]);
    if(!items.length) throw Object.assign(new Error('Корзина пуста'),{status:400});
    for(const item of items) if(item.quantity>item.stock) throw Object.assign(new Error(`Недостаточно товара «${item.name}», размер ${item.size}`),{status:409});
    const total=items.reduce((sum,x)=>sum+x.price*x.quantity,0);
    const {rows:[order]}=await client.query(`
      INSERT INTO orders(user_id,customer_name,phone,email,address,comment,total)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `,[userId,data.name,data.phone,data.email,data.address,data.comment||'',total]);
    for(const item of items) {
      await client.query('INSERT INTO order_items(order_id,product_id,product_name,size,quantity,price) VALUES($1,$2,$3,$4,$5,$6)',[order.id,item.product_id,item.name,item.size,item.quantity,item.price]);
      await client.query('UPDATE product_variants SET stock=stock-$1 WHERE product_id=$2 AND size=$3',[item.quantity,item.product_id,item.size]);
    }
    await client.query('DELETE FROM cart_items WHERE user_id=$1',[userId]);
    await client.query('COMMIT');
    return getOrder(order.id,userId,false);
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function getOrder(id,userId,isModerator) {
  const {rows}=await pool.query(`
    SELECT o.*,COALESCE(json_agg(json_build_object('id',i.id,'productId',i.product_id,'name',i.product_name,'size',i.size,'quantity',i.quantity,'price',i.price)) FILTER(WHERE i.id IS NOT NULL),'[]') AS items
    FROM orders o LEFT JOIN order_items i ON i.order_id=o.id
    WHERE o.id=$1 ${isModerator?'':'AND o.user_id=$2'} GROUP BY o.id
  `,[id,...(isModerator?[]:[userId])]);
  return rows[0]||null;
}

export async function listOrders(userId,isModerator=false) {
  const {rows}=await pool.query(`
    SELECT o.*,COALESCE(json_agg(json_build_object('id',i.id,'productId',i.product_id,'name',i.product_name,'size',i.size,'quantity',i.quantity,'price',i.price)) FILTER(WHERE i.id IS NOT NULL),'[]') AS items
    FROM orders o LEFT JOIN order_items i ON i.order_id=o.id
    ${isModerator?'':'WHERE o.user_id=$1'} GROUP BY o.id ORDER BY o.created_at DESC
  `,isModerator?[]:[userId]);
  return rows;
}

export async function updateOrderStatus(id,status) {
  const allowed=['new','confirmed','shipped','completed','cancelled'];
  if(!allowed.includes(status)) throw Object.assign(new Error('Некорректный статус'),{status:400});
  await pool.query('UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2',[status,id]);
  return getOrder(id,null,true);
}

export async function auditModerator({moderatorId,action,entityType,entityId,details={},ip,userAgent}) {
  await pool.query(`
    INSERT INTO moderator_audit_log(moderator_id,action,entity_type,entity_id,details,ip_address,user_agent)
    VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)
  `,[moderatorId,action,entityType,String(entityId||''),JSON.stringify(details),ip,String(userAgent||'').slice(0,500)]);
}

export async function createReset(email) {
  const user=await findUserWithPassword(email);
  if(!user) return null;
  const token=randomBytes(24).toString('base64url');
  await pool.query("INSERT INTO password_resets(token,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '20 minutes')",[token,user.id]);
  return {token,user};
}

export async function applyReset(token,password) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const {rows:[reset]}=await client.query('SELECT * FROM password_resets WHERE token=$1 AND used_at IS NULL AND expires_at>NOW() FOR UPDATE',[token]);
    if(!reset) { await client.query('ROLLBACK'); return false; }
    await client.query('UPDATE users SET password_hash=$1 WHERE id=$2',[hashPassword(password),reset.user_id]);
    await client.query('UPDATE password_resets SET used_at=NOW() WHERE token=$1',[token]);
    await client.query('DELETE FROM sessions WHERE user_id=$1',[reset.user_id]);
    await client.query('COMMIT'); return true;
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
