import { createServer } from 'node:http';
import { createReadStream, mkdirSync } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import Busboy from 'busboy';
import {
  addProductImage, applyReset, auditModerator, changePassword, createEmailVerification, createOrder, createProduct,
  createReset, createSession, createUser, deleteAddress, deleteCustomerAccount, deleteProduct, deleteProductImage,
  deleteSession, findUserWithPassword, getCart, initDb, listAddresses, listOrders, listProducts, saveAddress,
  saveProduct, setCartItem, updateOrderStatus, updateProfileName, userFromSession, verifyEmailToken, verifyPassword,
} from './db.mjs';
import { sendEmailVerification, sendOrderCreated, sendOrderStatus, sendPasswordReset } from './mailer.mjs';

const PORT=Number(process.env.API_PORT||8787);
const HOST=process.env.API_HOST||'127.0.0.1';
const uploadsDir=resolve('uploads');
const distDir=resolve('dist');
mkdirSync(uploadsDir,{recursive:true});
const limits=new Map();
const publicOrigin=process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).origin : null;

const clientIp=req=>{
  if(process.env.TRUST_PROXY==='true'){
    const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
    if(forwarded)return forwarded;
  }
  return req.socket.remoteAddress||'unknown';
};
const consumeLimit=(key,max,windowMs)=>{
  const now=Date.now(),current=limits.get(key);
  if(!current||current.reset<=now){limits.set(key,{count:1,reset:now+windowMs});return true}
  current.count++; return current.count<=max;
};
setInterval(()=>{const now=Date.now();for(const [key,value] of limits)if(value.reset<=now)limits.delete(key)},60_000).unref();

const json=(res,status,body,headers={}) => {
  res.writeHead(status,{
    'content-type':'application/json; charset=utf-8',
    'x-content-type-options':'nosniff',
    'x-frame-options':'DENY',
    'referrer-policy':'strict-origin-when-cross-origin',
    'permissions-policy':'camera=(), microphone=(), geolocation=()',
    'content-security-policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    'cache-control':'no-store',
    ...headers,
  });
  res.end(JSON.stringify(body));
};
const parseCookies=header=>Object.fromEntries((header||'').split(';').filter(Boolean).map(x=>{const i=x.indexOf('=');return[x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))]}));
const readBody=req=>new Promise((resolveBody,reject)=>{
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return reject(Object.assign(new Error('Ожидается JSON'),{status:415}));
  let body='',tooLarge=false; req.on('data',c=>{if(tooLarge)return;body+=c;if(Buffer.byteLength(body)>1_000_000){tooLarge=true;reject(Object.assign(new Error('Запрос слишком большой'),{status:413}))}});
  req.on('end',()=>{try{resolveBody(body?JSON.parse(body):{})}catch{reject(Object.assign(new Error('Некорректный JSON'),{status:400}))}});
  req.on('error',reject);
});
const sessionCookie=(token,maxAge=2592000)=>`saru_session=${encodeURIComponent(token||'')}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`;
const cleanUser=user=>user&&({id:Number(user.id),name:user.name,email:user.email,role:user.role,emailVerified:Boolean(user.emailVerified??user.email_verified),createdAt:user.createdAt??user.created_at});
const validateProduct=body=>{
  if(!body||typeof body.name!=='string'||!body.name.trim()||body.name.length>160)return false;
  if(!Number.isInteger(body.price)||body.price<0||body.price>100_000_000)return false;
  for(const [field,max] of [['subtitle',240],['color',80],['material',180],['fit',120],['story',2000]])if(typeof (body[field]??'')!=='string'||String(body[field]??'').length>max)return false;
  if(!/^#[0-9a-f]{6}$/i.test(body.tone||'')||!/^#[0-9a-f]{6}$/i.test(body.accent||''))return false;
  if(!Array.isArray(body.variants)||!body.variants.length||body.variants.length>20)return false;
  const sizes=new Set();
  return body.variants.every(v=>{
    const size=String(v?.size||'').trim(),stock=Number(v?.stock);
    if(!/^[\p{L}\p{N} .+\/-]{1,24}$/u.test(size)||sizes.has(size)||!Number.isInteger(stock)||stock<0||stock>1_000_000)return false;
    sizes.add(size);return true;
  });
};
const validAddress=body=>{
  const fields=['label','recipientName','phone','city','street','house'];
  return fields.every(key=>typeof body?.[key]==='string'&&body[key].trim()&&body[key].length<=120)
    && String(body.apartment||'').length<=40&&String(body.postalCode||'').length<=20;
};
const validOrder=body=>{
  if(!body||String(body.comment||'').length>1000)return false;
  if(body.addressId!==undefined)return Number.isInteger(body.addressId)&&body.addressId>0;
  return typeof body.name==='string'&&body.name.trim()&&body.name.length<=120
    &&typeof body.phone==='string'&&body.phone.trim()&&body.phone.length<=40
    &&typeof body.address==='string'&&body.address.trim()&&body.address.length<=500;
};

const receiveImage=(req,productId)=>new Promise((resolveUpload,reject)=>{
  const busboy=Busboy({headers:req.headers,limits:{files:1,fileSize:8*1024*1024,fields:3}});
  let result=null,pending=null,settled=false;
  const fail=error=>{if(!settled){settled=true;reject(error)}};
  busboy.on('file',(_name,file,info)=>{
    const allowed={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'};
    const extension=allowed[info.mimeType];
    if(!extension){file.resume();return fail(Object.assign(new Error('Допустимы JPG, PNG и WebP'),{status:415}))}
    const filename=`${productId}-${Date.now()}-${randomBytes(5).toString('hex')}${extension}`;
    const path=resolve(uploadsDir,filename);
    const chunks=[]; let size=0;
    let truncated=false;
    file.on('limit',()=>{truncated=true});
    file.on('data',c=>{chunks.push(c);size+=c.length});
    pending=new Promise((ok,fail)=>file.on('end',async()=>{
      try {
        if(truncated)throw Object.assign(new Error('Файл превышает 8 МБ'),{status:413});
        const buffer=Buffer.concat(chunks);
        const signatures={
          '.jpg':buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff,
          '.png':buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
          '.webp':buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP',
        };
        if(!signatures[extension])throw Object.assign(new Error('Содержимое файла не соответствует формату'),{status:415});
        await import('node:fs/promises').then(fs=>fs.writeFile(path,buffer,{mode:0o600}));
        result={url:`/media/${filename}`,path,size}; ok();
      }
      catch(error){fail(error)}
    }).on('error',fail));
  });
  busboy.on('filesLimit',()=>fail(Object.assign(new Error('Разрешён один файл'),{status:400})));
  busboy.on('finish',async()=>{try{await pending;if(!result)throw Object.assign(new Error('Файл не найден'),{status:400});if(!settled){settled=true;resolveUpload(result)}}catch(error){fail(error)}});
  busboy.on('error',fail); req.pipe(busboy);
});

await initDb();

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host}`);
    const ip=clientIp(req);
    if(!consumeLimit(`global:${ip}`,300,60_000))return json(res,429,{error:'Слишком много запросов. Попробуйте через минуту.'},{'retry-after':'60'});
    if(['POST','PUT','PATCH','DELETE'].includes(req.method)){
      const origin=req.headers.origin;
      const allowedOrigin=publicOrigin||`http://${req.headers.host}`;
      const localDev=process.env.NODE_ENV!=='production'&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin||'');
      if(origin&&origin!==allowedOrigin&&!localDev)return json(res,403,{error:'Недопустимый источник запроса'});
    }
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
      if(!consumeLimit(`register:${ip}`,5,60*60_000))return json(res,429,{error:'Слишком много попыток регистрации'},{'retry-after':'3600'});
      const {name,email,password}=await readBody(req);
      if(!name?.trim()||name.trim().length>100||!email?.includes('@')||email.length>254||String(password).length<10||String(password).length>128)return json(res,400,{error:'Проверьте имя, почту и пароль от 10 символов'});
      try{
        const created=await createUser({name,email,password}),token=await createEmailVerification(created.id);
        const verificationSent=await sendEmailVerification({email:created.email,name:created.name,token}).catch(error=>{console.error('Email verification delivery failed',error);return false});
        const session=await createSession(created.id);
        return json(res,201,{user:cleanUser(created),cart:[],verificationSent,...(process.env.NODE_ENV==='production'?{}:{devVerificationToken:token})},{'set-cookie':sessionCookie(session.token)})
      }
      catch(error){if(error.code==='23505')return json(res,409,{error:'Профиль с такой почтой уже существует'});throw error}
    }
    if(req.method==='POST'&&url.pathname==='/api/auth/login'){
      const {email,password}=await readBody(req);
      const loginKey=String(email||'').trim().toLowerCase().slice(0,254);
      if(!consumeLimit(`login-ip:${ip}`,20,15*60_000)||!consumeLimit(`login-account:${loginKey}`,8,15*60_000))return json(res,429,{error:'Слишком много попыток входа. Попробуйте позже.'},{'retry-after':'900'});
      const found=loginKey&&await findUserWithPassword(loginKey);
      if(!found||!verifyPassword(String(password||''),found.password_hash))return json(res,401,{error:'Неверная почта или пароль'});
      const session=await createSession(found.id);return json(res,200,{user:cleanUser(found),cart:await getCart(found.id)},{'set-cookie':sessionCookie(session.token)});
    }
    if(req.method==='POST'&&url.pathname==='/api/auth/logout'){
      await deleteSession(cookies.saru_session);return json(res,200,{ok:true},{'set-cookie':sessionCookie('',0)});
    }
    if(req.method==='POST'&&url.pathname==='/api/auth/reset-request'){
      if(!consumeLimit(`reset-ip:${ip}`,5,60*60_000))return json(res,429,{error:'Слишком много запросов восстановления'},{'retry-after':'3600'});
      const {email}=await readBody(req);const reset=await createReset(email||'');
      if(reset)await sendPasswordReset({email:reset.user.email,name:reset.user.name,token:reset.token});
      return json(res,200,{ok:true,...(process.env.NODE_ENV==='production'||!reset?{}:{devToken:reset.token})});
    }
    if(req.method==='POST'&&url.pathname==='/api/auth/reset'){
      const {token,password}=await readBody(req);
      if(String(password).length<10||String(password).length>128)return json(res,400,{error:'Пароль должен содержать от 10 до 128 символов'});
      return await applyReset(token,password)?json(res,200,{ok:true}):json(res,400,{error:'Ссылка недействительна или устарела'});
    }

    if(req.method==='POST'&&url.pathname==='/api/auth/verify-email'){
      if(!consumeLimit(`verify:${ip}`,12,60*60_000))return json(res,429,{error:'Слишком много попыток подтверждения'},{'retry-after':'3600'});
      const {token}=await readBody(req);
      return await verifyEmailToken(token)?json(res,200,{ok:true}):json(res,400,{error:'Ссылка недействительна или устарела'});
    }
    if(req.method==='POST'&&url.pathname==='/api/profile/verification'){
      if(!requireUser())return;
      if(user.emailVerified)return json(res,200,{ok:true,alreadyVerified:true});
      if(!consumeLimit(`verify-send:${user.id}`,3,60*60_000))return json(res,429,{error:'Новое письмо можно запросить позже'},{'retry-after':'3600'});
      const token=await createEmailVerification(user.id);
      const sent=await sendEmailVerification({email:user.email,name:user.name,token}).catch(error=>{console.error('Email verification delivery failed',error);return false});
      return json(res,200,{ok:true,sent,...(process.env.NODE_ENV==='production'?{}:{devToken:token})});
    }
    if(req.method==='PATCH'&&url.pathname==='/api/profile'){
      if(!requireUser())return;const {name}=await readBody(req);
      if(!name?.trim()||name.trim().length>100)return json(res,400,{error:'Имя должно содержать от 1 до 100 символов'});
      return json(res,200,{user:cleanUser(await updateProfileName(user.id,name))});
    }
    if(req.method==='POST'&&url.pathname==='/api/profile/password'){
      if(!requireUser())return;
      if(!consumeLimit(`password-change:${user.id}`,5,60*60_000))return json(res,429,{error:'Слишком много попыток смены пароля'},{'retry-after':'3600'});
      const {currentPassword,newPassword}=await readBody(req);
      if(String(newPassword||'').length<10||String(newPassword).length>128)return json(res,400,{error:'Новый пароль должен содержать от 10 до 128 символов'});
      const changed=await changePassword(user.id,String(currentPassword||''),newPassword);
      return changed?json(res,200,{ok:true},{'set-cookie':sessionCookie('',0)}):json(res,403,{error:'Текущий пароль неверен'});
    }
    if(req.method==='DELETE'&&url.pathname==='/api/profile'){
      if(!requireUser())return;
      if(!consumeLimit(`account-delete:${user.id}`,3,24*60*60_000))return json(res,429,{error:'Слишком много попыток удаления аккаунта'});
      const {password}=await readBody(req);const deleted=await deleteCustomerAccount(user.id,String(password||''));
      return deleted?json(res,200,{ok:true},{'set-cookie':sessionCookie('',0)}):json(res,403,{error:'Пароль неверен или аккаунт удалить нельзя'});
    }
    if(req.method==='GET'&&url.pathname==='/api/profile/addresses'){
      if(!requireUser())return;return json(res,200,{addresses:await listAddresses(user.id)});
    }
    if(req.method==='POST'&&url.pathname==='/api/profile/addresses'){
      if(!requireUser())return;const body=await readBody(req);
      if(!validAddress(body))return json(res,400,{error:'Проверьте название, получателя, телефон и адрес'});
      return json(res,201,{address:await saveAddress(user.id,body)});
    }
    const addressMatch=url.pathname.match(/^\/api\/profile\/addresses\/(\d+)$/);
    if(addressMatch&&req.method==='PUT'){
      if(!requireUser())return;const body=await readBody(req);body.id=Number(addressMatch[1]);
      if(!validAddress(body))return json(res,400,{error:'Проверьте название, получателя, телефон и адрес'});
      return json(res,200,{address:await saveAddress(user.id,body)});
    }
    if(addressMatch&&req.method==='DELETE'){
      if(!requireUser())return;return json(res,200,{ok:await deleteAddress(user.id,Number(addressMatch[1]))});
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
      if(!validOrder(body))return json(res,400,{error:'Проверьте получателя, телефон и адрес'});
      const order=await createOrder(user.id,body);
      await sendOrderCreated({order}).catch(error=>console.error('Не удалось отправить уведомление о заказе',error));
      return json(res,201,{order,cart:[]});
    }

    const orderMatch=url.pathname.match(/^\/api\/orders\/(\d+)\/status$/);
    if(orderMatch&&req.method==='PATCH'){
      if(!requireModerator())return;const {status}=await readBody(req);
      const order=await updateOrderStatus(Number(orderMatch[1]),status);
      await auditModerator({moderatorId:user.id,action:'order.status_changed',entityType:'order',entityId:orderMatch[1],details:{status},ip,userAgent:req.headers['user-agent']});
      await sendOrderStatus({order}).catch(error=>console.error('Не удалось отправить статус заказа',error));
      return json(res,200,{order});
    }

    if(url.pathname==='/api/products'&&req.method==='POST'){
      if(!requireModerator())return;const body=await readBody(req);
      if(!validateProduct(body))return json(res,400,{error:'Проверьте карточку и остатки'});
      const product=await createProduct(body);
      await auditModerator({moderatorId:user.id,action:'product.created',entityType:'product',entityId:product.id,details:{published:product.published},ip,userAgent:req.headers['user-agent']});
      return json(res,201,{product});
    }
    const productMatch=url.pathname.match(/^\/api\/products\/(\d+)$/);
    if(productMatch&&req.method==='PUT'){
      if(!requireModerator())return;const body=await readBody(req);const id=Number(productMatch[1]);
      if(id!==body.id||!validateProduct(body))return json(res,400,{error:'Проверьте карточку и остатки'});
      const product=await saveProduct(body);
      await auditModerator({moderatorId:user.id,action:'product.updated',entityType:'product',entityId:id,details:{published:product.published,variants:product.variants},ip,userAgent:req.headers['user-agent']});
      return json(res,200,{product});
    }
    if(productMatch&&req.method==='DELETE'){
      if(!requireModerator())return;const id=Number(productMatch[1]);const ok=await deleteProduct(id);
      if(ok)await auditModerator({moderatorId:user.id,action:'product.deleted',entityType:'product',entityId:id,ip,userAgent:req.headers['user-agent']});
      return json(res,200,{ok});
    }

    const uploadMatch=url.pathname.match(/^\/api\/products\/(\d+)\/images$/);
    if(uploadMatch&&req.method==='POST'){
      if(!requireModerator())return;const id=Number(uploadMatch[1]);const uploaded=await receiveImage(req,id);
      const product=await addProductImage(id,uploaded.url,'');
      await auditModerator({moderatorId:user.id,action:'product.image_uploaded',entityType:'product',entityId:id,details:{url:uploaded.url,size:uploaded.size},ip,userAgent:req.headers['user-agent']});
      return json(res,201,{product});
    }
    const imageMatch=url.pathname.match(/^\/api\/products\/(\d+)\/images\/(\d+)$/);
    if(imageMatch&&req.method==='DELETE'){
      if(!requireModerator())return;const productId=Number(imageMatch[1]),imageId=Number(imageMatch[2]);
      const current=(await listProducts(true)).find(p=>p.id===productId);const image=current?.images.find(i=>Number(i.id)===imageId);
      const product=await deleteProductImage(productId,imageId);
      if(image?.url.startsWith('/media/'))await unlink(resolve(uploadsDir,image.url.slice(7))).catch(()=>{});
      await auditModerator({moderatorId:user.id,action:'product.image_deleted',entityType:'product',entityId:productId,details:{imageId},ip,userAgent:req.headers['user-agent']});
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
