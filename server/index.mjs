import { createServer } from 'node:http';
import {
  applyReset, createReset, createSession, createUser, deleteSession, findUserWithPassword,
  getCart, listProducts, saveProduct, setCartItem, userFromSession, verifyPassword,
} from './db.mjs';

const PORT = Number(process.env.API_PORT || 8787);

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type':'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
};

const parseCookies = header => Object.fromEntries((header || '').split(';').filter(Boolean).map(x => {
  const i=x.indexOf('='); return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))];
}));

const readBody = req => new Promise((resolve,reject) => {
  let body=''; req.on('data',c => { body+=c; if(body.length>1_000_000) req.destroy(); });
  req.on('end',() => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Некорректный JSON')); } });
  req.on('error',reject);
});

const sessionCookie = (token, maxAge=2592000) => `saru_session=${encodeURIComponent(token || '')}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
const cleanUser = user => user && ({ id:user.id,name:user.name,email:user.email,role:user.role,createdAt:user.createdAt });

const server = createServer(async (req,res) => {
  try {
    const url = new URL(req.url,`http://${req.headers.host}`);
    const cookies = parseCookies(req.headers.cookie);
    const user = userFromSession(cookies.saru_session);
    const requireUser = () => {
      if (!user) { json(res,401,{ error:'Требуется авторизация' }); return false; }
      return true;
    };
    const requireModerator = () => {
      if (!user || user.role!=='moderator') { json(res,403,{ error:'Недостаточно прав' }); return false; }
      return true;
    };

    if (req.method==='GET' && url.pathname==='/api/health') return json(res,200,{ ok:true });
    if (req.method==='GET' && url.pathname==='/api/products') return json(res,200,{ products:listProducts(user?.role==='moderator') });
    if (req.method==='GET' && url.pathname==='/api/session') return json(res,200,{ user:cleanUser(user), cart:user?getCart(user.id):[] });

    if (req.method==='POST' && url.pathname==='/api/auth/register') {
      const {name,email,password}=await readBody(req);
      if(!name?.trim()||!email?.includes('@')||String(password).length<8) return json(res,400,{error:'Проверьте имя, почту и пароль от 8 символов'});
      try {
        const created=createUser({name,email,password}); const session=createSession(created.id);
        return json(res,201,{user:created,cart:[]},{'set-cookie':sessionCookie(session.token)});
      } catch (error) {
        if(String(error).includes('UNIQUE')) return json(res,409,{error:'Профиль с такой почтой уже существует'});
        throw error;
      }
    }

    if (req.method==='POST' && url.pathname==='/api/auth/login') {
      const {email,password}=await readBody(req); const found=email&&findUserWithPassword(email);
      if(!found||!verifyPassword(String(password||''),found.password_hash)) return json(res,401,{error:'Неверная почта или пароль'});
      const session=createSession(found.id);
      return json(res,200,{user:cleanUser(found),cart:getCart(found.id)},{'set-cookie':sessionCookie(session.token)});
    }

    if (req.method==='POST' && url.pathname==='/api/auth/logout') {
      deleteSession(cookies.saru_session);
      return json(res,200,{ok:true},{'set-cookie':sessionCookie('',0)});
    }

    if (req.method==='POST' && url.pathname==='/api/auth/reset-request') {
      const {email}=await readBody(req); const token=createReset(email||'');
      return json(res,200,{ok:true, ...(process.env.NODE_ENV==='production'||!token?{}:{devToken:token})});
    }

    if (req.method==='POST' && url.pathname==='/api/auth/reset') {
      const {token,password}=await readBody(req);
      if(String(password).length<8) return json(res,400,{error:'Пароль должен содержать минимум 8 символов'});
      return applyReset(token,password) ? json(res,200,{ok:true}) : json(res,400,{error:'Ссылка недействительна или устарела'});
    }

    if (url.pathname==='/api/cart' && req.method==='GET') {
      if(!requireUser()) return; return json(res,200,{cart:getCart(user.id)});
    }
    if (url.pathname==='/api/cart' && req.method==='PUT') {
      if(!requireUser()) return;
      const {productId,size,quantity}=await readBody(req);
      if(!Number.isInteger(productId)||!size||!Number.isInteger(quantity)) return json(res,400,{error:'Некорректные данные корзины'});
      return json(res,200,{cart:setCartItem(user.id,productId,size,quantity)});
    }

    const productMatch=url.pathname.match(/^\/api\/products\/(\d+)$/);
    if(productMatch && req.method==='PUT') {
      if(!requireModerator()) return;
      const body=await readBody(req); const id=Number(productMatch[1]);
      if(id!==body.id||!body.name||!Number.isInteger(body.price)||!Array.isArray(body.sizes)) return json(res,400,{error:'Некорректная карточка товара'});
      return json(res,200,{product:saveProduct(body)});
    }

    json(res,404,{error:'Маршрут не найден'});
  } catch (error) {
    console.error(error);
    json(res,500,{error:'Внутренняя ошибка сервера'});
  }
});

server.listen(PORT,'127.0.0.1',() => {
  console.log(`Saru API: http://127.0.0.1:${PORT}`);
  if(!process.env.MODERATOR_PASSWORD) console.log('Локальный модератор: moderator@saru.ru / SaruDemo2026!');
});
