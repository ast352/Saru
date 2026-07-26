import { createServer } from 'node:http';
import { createReadStream, mkdirSync } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import Busboy from 'busboy';
import {
  addProductImage, applyReset, createOrder, createProduct, createReset, createSession, createUser,
  deleteProduct, deleteProductImage, deleteSession, findUserWithPassword, getCart, initDb,
  listOrders, listProducts, saveProduct, setCartItem, updateOrderStatus, userFromSession, verifyPassword,
} from './db.mjs';
import { sendPasswordReset } from './mailer.mjs';

const PORT=Number(process.env.API_PORT||8787);
const HOST=process.env.API_HOST||'127.0.0.1';
const uploadsDir=resolve('uploads');
const distDir=resolve('dist');
mkdirSync(uploadsDir,{recursive:true});

const json=(res,status,body,headers={}) => {
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff',...headers});
  res.end(JSON.stringify(body));
};
const parseCookies=header=>Object.fromEntries((header||'').split(';').filter(Boolean).map(x=>{const i=x.indexOf('=');return[x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))]}));
const readBody=req=>new Promise((resolveBody,reject)=>{
  let body=''; req.on('data',c=>{body+=c;if(body.length>1_000_000)req.destroy()});
  req.on('end',()=>{try{resolveBody(body?JSON.parse(body):{})}catch{reject(Object.assign(new Error('Некорректный JSON'),{status:400}))}});
  req.on('error',reject);
});
const sessionCookie=(token,maxAge=2592000)=>`saru_session=${encodeURIComponent(token||'')}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`;
const cleanUser=user=>user&&({id:Number(user.id),name:user.name,email:user.email,role:user.role,createdAt:user.createdAt});
const validateProduct=body=>body?.name&&Number.isInteger(body.price)&&Array.isArray(body.variants)&&body.variants.every(v=>v.size&&Number.isInteger(Number(v.stock)));

const receiveImage=(req,productId)=>new Promise((resolveUpload,reject)=>{
  const busboy=Busboy({headers:req.headers,limits:{files:1,fileSize:8*1024*1024,fields:3}});
  let result=null,pending=null;
  busboy.on('file',(_name,file,info)=>{
    const allowed={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'};
    const extension=allowed[info.mimeType];
    if(!extension){file.resume();return reject(Object.assign(new Error('Допустимы JPG, PNG и WebP'),{status:415}))}
    const filename=`${productId}-${Date.now()}-${randomBytes(5).toString('hex')}${extension}`;
    const path=resolve(uploadsDir,filename);
    const chunks=[]; let size=0;
    file.on('data',c=>{chunks.push(c);size+=c.length});
    pending=new Promise((ok,fail)=>file.on('end',async()=>{
      try { await import('node:fs/promises').then(fs=>fs.writeFile(path,Buffer.concat(chunks))); result={url:`/media/${filename}`,path,size}; ok(); }
      catch(error){fail(error)}
    }).on('error',fail));
  });
  busboy.on('finish',async()=>{try{await pending;if(!result)throw Object.assign(new Error('Файл не найден'),{status:400});resolveUpload(result)}catch(error){reject(error)}});
  busboy.on('error',reject); req.pipe(busboy);
});

await initDb();

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host}`);
    if(req.method==='GET'&&url.pathname.startsWith('/media/')){
      const filename=url.pathname.slice(7);
      if(!/^[a-zA-Z0-9._-]+$/.test(filename))return json(res,400,{error:'Некорректный файл'});
      const path=resolve(uploadsDir,filename);
      if(!path.startsWith(uploadsDir))return json(res,403,{error:'Запрещено'});
      try{
        const info=await stat(path); const types={'.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
        res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream','content-length':info.size,'cache-control':'public, max-age=31536000, immutable'});
        return createReadStream(path).pipe(res);
      }catch{return json(res,404,{error:'Файл не найден'})}
    }

    const cookies=parseCookies(req.headers.cookie);
    const user=await userFromSession(cookies.saru_session);
    const requireUser=()=>{if(!user){json(res,401,{error:'Требуется авторизация'});return false}return true};
    const requireModerator=()=>{if(!user||user.role!=='moderator'){json(res,403,{error:'Недостаточно прав'});return false}return true};

    if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true,database:'postgresql'});
    if(req.method==='GET'&&url.pathname==='/api/products')return json(res,200,{products:await listProducts(user?.role==='moderator')});
    if(req.method==='GET'&&url.pathname==='/api/session')return json(res,200,{user:cleanUser(user),cart:user?await getCart(user.id):[]});

    if(req.method==='POST'&&url.pathname==='/api/auth/register'){
      const {name,email,password}=await readBody(req);
      if(!name?.trim()||!email?.includes('@')||String(password).length<8)return json(res,400,{error:'Проверьте имя, почту и пароль от 8 символов'});
      try{const created=await createUser({name,email,password});const session=await createSession(created.id);return json(res,201,{user:created,cart:[]},{'set-cookie':sessionCookie(session.token)})}
      catch(error){if(error.code==='23505')return json(res,409,{error:'Профиль с такой почтой уже существует'});throw error}
    }
    if(req.method==='POST'&&url.pathname==='/api/auth/login'){
      const {email,password}=await readBody(req);const found=email&&await findUserWithPassword(email);
      if(!found||!verifyPassword(String(password||''),found.password_hash))return json(res,401,{error:'Неверная почта или пароль'});
      const session=await createSession(found.id);return json(res,200,{user:cleanUser(found),cart:await getCart(found.id)},{'set-cookie':sessionCookie(session.token)});
    }
    if(req.method==='POST'&&url.pathname==='/api/auth/logout'){
      await deleteSession(cookies.saru_session);return json(res,200,{ok:true},{'set-cookie':sessionCookie('',0)});
    }
    if(req.method==='POST'&&url.pathname==='/api/auth/reset-request'){
      const {email}=await readBody(req);const reset=await createReset(email||'');
      if(reset)await sendPasswordReset({email:reset.user.email,name:reset.user.name,token:reset.token});
      return json(res,200,{ok:true,...(process.env.NODE_ENV==='production'||!reset?{}:{devToken:reset.token})});
    }
    if(req.method==='POST'&&url.pathname==='/api/auth/reset'){
      const {token,password}=await readBody(req);
      if(String(password).length<8)return json(res,400,{error:'Пароль должен содержать минимум 8 символов'});
      return await applyReset(token,password)?json(res,200,{ok:true}):json(res,400,{error:'Ссылка недействительна или устарела'});
    }

    if(url.pathname==='/api/cart'&&req.method==='GET'){if(!requireUser())return;return json(res,200,{cart:await getCart(user.id)})}
    if(url.pathname==='/api/cart'&&req.method==='PUT'){
      if(!requireUser())return;const {productId,size,quantity}=await readBody(req);
      if(!Number.isInteger(productId)||!size||!Number.isInteger(quantity))return json(res,400,{error:'Некорректные данные корзины'});
      return json(res,200,{cart:await setCartItem(user.id,productId,size,quantity)});
    }
    if(url.pathname==='/api/orders'&&req.method==='GET'){if(!requireUser())return;return json(res,200,{orders:await listOrders(user.id,user.role==='moderator')})}
    if(url.pathname==='/api/orders'&&req.method==='POST'){
      if(!requireUser())return;const body=await readBody(req);
      if(!body.name||!body.phone||!body.email?.includes('@')||!body.address)return json(res,400,{error:'Заполните имя, телефон, почту и адрес'});
      return json(res,201,{order:await createOrder(user.id,body),cart:[]});
    }

    const orderMatch=url.pathname.match(/^\/api\/orders\/(\d+)\/status$/);
    if(orderMatch&&req.method==='PATCH'){if(!requireModerator())return;const {status}=await readBody(req);return json(res,200,{order:await updateOrderStatus(Number(orderMatch[1]),status)})}

    if(url.pathname==='/api/products'&&req.method==='POST'){
      if(!requireModerator())return;const body=await readBody(req);
      if(!validateProduct(body))return json(res,400,{error:'Проверьте карточку и остатки'});
      return json(res,201,{product:await createProduct(body)});
    }
    const productMatch=url.pathname.match(/^\/api\/products\/(\d+)$/);
    if(productMatch&&req.method==='PUT'){
      if(!requireModerator())return;const body=await readBody(req);const id=Number(productMatch[1]);
      if(id!==body.id||!validateProduct(body))return json(res,400,{error:'Проверьте карточку и остатки'});
      return json(res,200,{product:await saveProduct(body)});
    }
    if(productMatch&&req.method==='DELETE'){if(!requireModerator())return;return json(res,200,{ok:await deleteProduct(Number(productMatch[1]))})}

    const uploadMatch=url.pathname.match(/^\/api\/products\/(\d+)\/images$/);
    if(uploadMatch&&req.method==='POST'){
      if(!requireModerator())return;const id=Number(uploadMatch[1]);const uploaded=await receiveImage(req,id);
      return json(res,201,{product:await addProductImage(id,uploaded.url,'')});
    }
    const imageMatch=url.pathname.match(/^\/api\/products\/(\d+)\/images\/(\d+)$/);
    if(imageMatch&&req.method==='DELETE'){
      if(!requireModerator())return;const productId=Number(imageMatch[1]),imageId=Number(imageMatch[2]);
      const current=(await listProducts(true)).find(p=>p.id===productId);const image=current?.images.find(i=>Number(i.id)===imageId);
      const product=await deleteProductImage(productId,imageId);
      if(image?.url.startsWith('/media/'))await unlink(resolve(uploadsDir,image.url.slice(7))).catch(()=>{});
      return json(res,200,{product});
    }
    if(req.method==='GET'&&!url.pathname.startsWith('/api/')){
      const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
      if(!relative.includes('..')){
        const requested=resolve(distDir,relative);
        try{
          const info=await stat(requested);
          if(info.isFile()){
            const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
            res.writeHead(200,{'content-type':types[extname(requested)]||'application/octet-stream','content-length':info.size});
            return createReadStream(requested).pipe(res);
          }
        }catch{}
      }
      try{
        const index=resolve(distDir,'index.html'),info=await stat(index);
        res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-length':info.size});
        return createReadStream(index).pipe(res);
      }catch{}
    }
    json(res,404,{error:'Маршрут не найден'});
  }catch(error){
    console.error(error);
    json(res,error.status||500,{error:error.status?error.message:'Внутренняя ошибка сервера'});
  }
});

server.listen(PORT,HOST,()=>{
  console.log(`Saru API: http://${HOST}:${PORT}`);
  if(!process.env.MODERATOR_PASSWORD)console.log('Локальный модератор: moderator@saru.ru / SaruDemo2026!');
});
