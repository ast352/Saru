import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PRODUCTS, money } from './data';
import { Icon, Shirt } from './ui';
import { api } from './api';
import './app.css';

function Header({ go, user, cartCount, openAuth, logout }) {
  const [open, setOpen] = useState(false);
  return <>
    <header className="site-header">
      <button className="header-menu" onClick={() => setOpen(true)} aria-label="Открыть меню"><Icon name="menu"/><span>Меню</span></button>
      <button className="logo" onClick={() => go('home')}>SARU</button>
      <div className="header-tools">
        <button className="header-shop" onClick={() => go('catalog')}>Сорочки</button>
        <button className="header-tool" onClick={user ? () => go(user.role === 'moderator' ? 'admin' : 'account') : openAuth}><Icon name="user"/><span>{user?.role === 'moderator' ? 'Управление' : user ? 'Профиль' : 'Войти'}</span></button>
        <button className="header-tool bag" onClick={() => go('cart')}><Icon name="bag"/><span>Корзина</span>{cartCount > 0 && <i>{cartCount}</i>}</button>
      </div>
    </header>
    {open && <div className="nav-layer">
      <div className="nav-panel">
        <button className="round nav-close" onClick={() => setOpen(false)}><Icon name="close"/></button>
        <nav>{[['home','Главная'],['catalog','Сорочки'],['story','О бренде'],['cart','Корзина']].map(([r,l],i) => <button key={r} onClick={() => {go(r);setOpen(false)}}><small>0{i+1}</small>{l}<Icon name="arrow"/></button>)}</nav>
        <div className="nav-account">{user?<><span>{user.email}</span><button onClick={() => {logout();setOpen(false)}}>Выйти из профиля</button></>:<button onClick={() => {openAuth();setOpen(false)}}>Войти или зарегистрироваться</button>}</div>
      </div>
      <button className="nav-blank" aria-label="Закрыть" onClick={() => setOpen(false)}/>
    </div>}
  </>;
}

function Home({ products, go }) {
  const rail = useRef(null);
  const move = direction => rail.current?.scrollBy({ left: direction * rail.current.clientWidth * .78, behavior: 'smooth' });
  return <main>
    <section className="home-hero">
      <div className="hero-photo">
        <video autoPlay muted loop playsInline preload="metadata" poster="/media/saru-hero-poster.jpg" aria-label="Атмосфера коллекции SARU">
          <source src="/media/saru-hero.webm" type="video/webm"/>
          <source src="/media/saru-hero.mp4" type="video/mp4"/>
        </video>
      </div>
    </section>

    <section className="collection-intro">
      <span>Коллекция SARU</span>
      <h1>Сорочки, в которых<br/>легко быть собой.</h1>
      <button className="link-arrow" onClick={() => go('catalog')}>Смотреть коллекцию <Icon name="arrow"/></button>
    </section>

    <section className="featured">
      <div className="collection-bar"><div><span>Избранные модели</span><h2>Сорочки</h2></div><div className="rail-actions"><button onClick={() => move(-1)} aria-label="Назад"><Icon name="back"/></button><button onClick={() => move(1)} aria-label="Вперёд"><Icon name="arrow"/></button></div></div>
      <div className="feature-rail" ref={rail}>{products.map((p, i) => <article className="feature-card" key={p.id} onClick={() => go('product', p.id)} tabIndex="0" onKeyDown={e=>e.key==='Enter'&&go('product',p.id)}>
        <div className="feature-image">{p.image ? <img src={p.image} alt={p.name}/> : <Shirt product={p}/>}<span>{String(i+1).padStart(2,'0')}</span></div>
        <div className="feature-copy"><div><small>{p.color}</small><h3>{p.name}</h3><p>{p.subtitle}</p></div><strong>{money(p.price)}</strong></div>
      </article>)}</div>
      <button className="link-arrow all-products" onClick={() => go('catalog')}>Смотреть все <Icon name="arrow"/></button>
    </section>
  </main>;
}

function Catalog({ products, go }) {
  const [color, setColor] = useState('Все');
  const colors = ['Все', ...new Set(products.map(p => p.color))];
  const shown = color === 'Все' ? products : products.filter(p => p.color === color);
  return <main className="shell catalog">
    <header className="catalog-head"><span className="micro">Коллекция SARU</span><h1>Сорочки</h1><p>{shown.length} моделей</p></header>
    <div className="filter-row">{colors.map(c => <button className={c === color ? 'active' : ''} onClick={() => setColor(c)} key={c}>{c}</button>)}</div>
    <div className="catalog-grid">{shown.map(p => <ProductTile key={p.id} product={p} go={go}/>)}</div>
  </main>;
}

function ProductTile({ product, go }) {
  return <article className="product-tile" onClick={() => go('product', product.id)}>
    <div>{product.image ? <img src={product.image} alt={product.name}/> : <Shirt product={product}/>}<button aria-label="Открыть"><Icon name="arrow"/></button></div>
    <footer><span><small>{product.color}</small><strong>{product.name}</strong><em>{product.subtitle}</em></span><b>{money(product.price)}</b></footer>
  </article>;
}

function ProductPage({ product, user, add, go, openAuth }) {
  const variants=product.variants?.length?product.variants:product.sizes.map(size=>({size,stock:1}));
  const firstAvailable=variants.find(v=>v.stock>0)?.size||'';
  const [size, setSize] = useState(firstAvailable);
  const [done, setDone] = useState(false);
  useEffect(()=>{setSize(firstAvailable);setDone(false)},[product.id]);
  const buy = async () => {
    if (!user) return openAuth('Войдите или создайте профиль, чтобы добавить рубашку в корзину.');
    const added=await add(product, size); if(added)setDone(true);
  };
  return <main className="product-view">
    <div className="product-visual">
      <button className="back" onClick={() => go('catalog')}><Icon name="back"/> Назад</button>
      {product.image ? <img src={product.image} alt={product.name}/> : <Shirt product={product}/>}
    </div>
    <aside className="product-details">
      <button className="product-breadcrumb" onClick={() => go('catalog')}>Сорочки / {product.color}</button>
      <h1>{product.name}</h1><p className="subtitle">{product.subtitle}</p><strong className="price">{money(product.price)}</strong>
      <div className="product-color"><span style={{background:product.tone}}/><div><small>Цвет</small><strong>{product.color}</strong></div></div>
      <div className="size-head"><span>Выберите размер</span><button>Таблица размеров</button></div>
      <div className="size-list">{variants.map(v => <button className={v.size === size ? 'active' : ''} disabled={!v.stock} onClick={() => {setSize(v.size);setDone(false)}} key={v.size}>{v.size}</button>)}</div>
      <small className="stock-note">{firstAvailable?'В наличии · отправим в течение 1–2 дней':'Нет в наличии'}</small>
      <button className={`action ${done ? 'done' : ''}`} disabled={!size} onClick={buy}>{done ? <><Icon name="check"/> Добавлено в корзину</> : firstAvailable?'Добавить в корзину':'Нет в наличии'}</button>
      {done&&<div className="added-panel"><span>Сорочка ждёт вас в корзине</span><div><button onClick={() => go('cart')}>Перейти в корзину</button><button onClick={() => setDone(false)}>Продолжить покупки</button></div></div>}
      {!user && <small className="login-note">Добавление доступно после регистрации</small>}
      <p className="product-story">{product.story}</p>
      <details open><summary>Состав и посадка <Icon name="plus"/></summary><p>{product.material}<br/>{product.fit}<br/>Сделано в России</p></details>
      <details><summary>Доставка и возврат <Icon name="plus"/></summary><p>Бесплатная доставка по России от 20 000 ₽. Возврат в течение 14 дней.</p></details>
    </aside>
  </main>;
}

function Cart({ cart, change, remove, go, user, onOrdered }) {
  const [checkout,setCheckout]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const countLabel = count % 10 === 1 && count % 100 !== 11 ? 'товар' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'товара' : 'товаров';
  const order=async e=>{
    e.preventDefault();setBusy(true);setError('');
    try{const data=Object.fromEntries(new FormData(e.currentTarget));await api.createOrder(data);onOrdered();go('account')}
    catch(err){setError(err.message)}finally{setBusy(false)}
  };
  if (!cart.length) return <main className="empty-state cart-empty"><span className="micro">Ваш выбор</span><div className="empty-bag"><Icon name="bag" size={30}/></div><h1>Корзина пуста</h1><p>Выберите сорочку — мы сохраним её здесь.</p><button className="action compact" onClick={() => go('catalog')}>Смотреть коллекцию</button></main>;
  return <main className="shell cart"><header><div><span className="micro">Ваш выбор</span><h1>Корзина</h1></div><p>{count} {countLabel}</p></header>
    <nav className="cart-steps" aria-label="Этапы оформления"><span className="active"><i>01</i> Корзина</span><span className={checkout?'active':''}><i>02</i> Доставка</span><span><i>03</i> Подтверждение</span></nav>
    <div className="cart-layout">
    <section>{cart.map(item => <article className="cart-line" key={`${item.id}-${item.size}`}>
      <div className="cart-image">{item.image ? <img src={item.image} alt={item.name}/> : <Shirt product={item}/>}</div>
      <div className="cart-info"><span className="micro">Сорочка SARU</span><h2>{item.name}</h2><p>{item.color} · Размер {item.size}</p><div className="counter" aria-label="Количество"><button aria-label="Уменьшить количество" onClick={() => change(item,-1)}><Icon name="minus" size={15}/></button><span>{item.qty}</span><button aria-label="Увеличить количество" onClick={() => change(item,1)}><Icon name="plus" size={15}/></button></div></div>
      <div className="cart-end"><button aria-label={`Удалить ${item.name}`} onClick={() => remove(item)}><Icon name="close"/></button><strong>{money(item.price * item.qty)}</strong></div>
    </article>)}</section>
    <aside className="total"><span className="micro">Ваш заказ</span><h2>Итого</h2><dl><div><dt>Товары · {count}</dt><dd>{money(total)}</dd></div><div><dt>Доставка</dt><dd>Рассчитаем позже</dd></div></dl><div className="total-sum"><span>К оплате</span><strong>{money(total)}</strong></div>
      {checkout?<form className="checkout" onSubmit={order}><div className="checkout-title"><span className="micro">Шаг 02</span><h3>Куда доставить?</h3></div>
      {error&&<p className="auth-error">{error}</p>}
      <label>Получатель<input name="name" required defaultValue={user?.name}/></label>
      <label>Телефон<input name="phone" required placeholder="+7 900 000-00-00"/></label>
      <label>Почта<input name="email" type="email" required defaultValue={user?.email}/></label>
      <label>Адрес<textarea name="address" required placeholder="Город, улица, дом, квартира"/></label>
      <label>Комментарий<textarea name="comment" placeholder="Необязательно"/></label>
      <button className="action" disabled={busy}>{busy?'Отправляем…':'Подтвердить заказ'}</button><button type="button" className="text-action" onClick={() => setCheckout(false)}>Вернуться к корзине</button>
    </form>:<><p className="total-note">Оплата появится позже. Сейчас заказ отправляется менеджеру для подтверждения.</p><button className="action" onClick={() => setCheckout(true)}>Перейти к оформлению</button><button className="text-action" onClick={() => go('catalog')}>Продолжить покупки</button></>}</aside>
  </div></main>;
}

function Auth({ message, close, onSession }) {
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [devToken, setDevToken] = useState('');
  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (mode === 'reset') {
        const result = await api.resetRequest(data.email);
        setDevToken(result.devToken || ''); setMode('resetConfirm'); return;
      }
      if (mode === 'resetConfirm') {
        await api.resetPassword({token:data.token,password:data.password});
        setMode('login'); setDevToken(''); return;
      }
      const session = mode === 'register' ? await api.register(data) : await api.login(data);
      onSession(session); close();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const title = mode === 'register' ? 'Создайте профиль' : mode === 'reset' ? 'Вернём доступ' : mode === 'resetConfirm' ? 'Новый пароль' : 'С возвращением';
  const lead = mode === 'register' ? 'Один профиль — для покупок, адресов и истории заказов.' : mode === 'reset' ? 'Укажите почту — мы подготовим одноразовый код.' : mode === 'resetConfirm' ? 'Введите код и придумайте новый надёжный пароль.' : 'Войдите, чтобы продолжить покупки и вернуться к выбранным сорочкам.';
  return <div className="modal"><button className="modal-air" aria-label="Закрыть" onClick={close}/><section className="auth">
    <button className="round auth-close" aria-label="Закрыть" onClick={close}><Icon name="close"/></button>
    <div className="auth-brand"><strong>SARU</strong><span>Личный кабинет</span></div>
    {(mode === 'login' || mode === 'register') && <div className="auth-tabs"><button className={mode==='login'?'active':''} onClick={() => {setMode('login');setError('')}}>Вход</button><button className={mode==='register'?'active':''} onClick={() => {setMode('register');setError('')}}>Регистрация</button></div>}
    <div className="auth-heading"><span className="micro">{mode === 'register' ? 'Добро пожаловать' : mode === 'login' ? 'Рады видеть вас' : 'Восстановление'}</span><h2>{title}</h2><p>{lead}</p></div>
    {message && <p className="auth-message">{message}</p>}{error && <p className="auth-error">{error}</p>}
    {mode === 'register' && <div className="auth-benefits"><span><Icon name="check" size={14}/> Корзина сохраняется</span><span><Icon name="check" size={14}/> История заказов</span><span><Icon name="check" size={14}/> Адреса доставки</span></div>}
    <form onSubmit={submit}>
      {mode === 'register' && <label>Имя<input name="name" required placeholder="Как к вам обращаться"/></label>}
      {mode !== 'resetConfirm' && <label>Почта<input name="email" type="email" required placeholder="name@example.ru"/></label>}
      {mode === 'resetConfirm' && <label>Код восстановления<input name="token" required defaultValue={devToken} placeholder="Код из письма"/></label>}
      {mode !== 'reset' && <label>Пароль<input name="password" type="password" minLength="10" maxLength="128" required placeholder="Минимум 10 символов"/></label>}
      <button className="action" disabled={busy}>{busy ? 'Подождите…' : mode === 'register' ? 'Создать профиль' : mode === 'reset' ? 'Получить код' : mode === 'resetConfirm' ? 'Сохранить пароль' : 'Войти'}</button>
      {mode === 'register' && <small className="auth-consent">Создавая профиль, вы соглашаетесь с политикой обработки персональных данных.</small>}
    </form>
    <div className="auth-switch">{mode === 'login' ? <button onClick={() => setMode('reset')}>Забыли пароль?</button> : mode !== 'register' && <button onClick={() => setMode('login')}>Вернуться ко входу</button>}</div>
  </section></div>;
}

function Account({ user, go, onUser, onLogout }) {
  const [orders,setOrders]=useState([]);
  const [addresses,setAddresses]=useState([]);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [verificationToken,setVerificationToken]=useState('');
  const load=()=>Promise.all([api.orders(),api.addresses()]).then(([o,a])=>{setOrders(o.orders);setAddresses(a.addresses)});
  useEffect(()=>{load().catch(err=>setError(err.message))},[]);
  const run=async action=>{setError('');setMessage('');try{await action()}catch(err){setError(err.message)}};
  const saveName=e=>{e.preventDefault();const name=new FormData(e.currentTarget).get('name');run(async()=>{const {user:next}=await api.updateProfile({name});onUser(next);setMessage('Имя сохранено')})};
  const changePassword=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));run(async()=>{await api.changePassword(d);setMessage('Пароль изменён. Войдите снова.');setTimeout(onLogout,900)})};
  const addAddress=e=>{e.preventDefault();const form=e.currentTarget,d=Object.fromEntries(new FormData(form));d.isDefault=d.isDefault==='on';run(async()=>{await api.saveAddress(d);form.reset();await load();setMessage('Адрес сохранён')})};
  const resend=()=>run(async()=>{const result=await api.resendVerification();setVerificationToken(result.devToken||'');setMessage(result.sent?'Письмо отправлено':'Локальный код создан')});
  const verify=()=>run(async()=>{await api.verifyEmail(verificationToken);const session=await api.session();onUser(session.user);setVerificationToken('');setMessage('Почта подтверждена')});
  const removeAccount=e=>{e.preventDefault();if(!confirm('Удалить профиль и личные данные? Отменить это действие нельзя.'))return;const password=new FormData(e.currentTarget).get('password');run(async()=>{await api.deleteAccount(password);onLogout()})};
  return <main className="shell account"><h1>{user?.name || 'Профиль'}</h1>{error&&<p className="auth-error">{error}</p>}{message&&<p className="profile-message">{message}</p>}
    <div><span>Электронная почта</span><strong>{user?.email} · {user?.emailVerified?'подтверждена':'не подтверждена'}</strong></div>
    {!user?.emailVerified&&<section className="profile-panel"><h2>Подтверждение почты</h2><p>Отправим одноразовую ссылку, действующую 24 часа.</p><button className="outline-action" onClick={resend}>Отправить письмо</button>{verificationToken&&<div className="local-verification"><input value={verificationToken} onChange={e=>setVerificationToken(e.target.value)}/><button onClick={verify}>Подтвердить локально</button></div>}</section>}
    <div className="profile-grid"><section className="profile-panel"><h2>Личные данные</h2><form onSubmit={saveName}><label>Имя<input name="name" defaultValue={user?.name} required maxLength="100"/></label><button className="outline-action">Сохранить</button></form></section>
    <section className="profile-panel"><h2>Смена пароля</h2><form onSubmit={changePassword}><label>Текущий пароль<input name="currentPassword" type="password" required/></label><label>Новый пароль<input name="newPassword" type="password" minLength="10" maxLength="128" required/></label><button className="outline-action">Сменить пароль</button></form></section></div>
    <section className="profile-panel addresses"><h2>Адреса доставки</h2><div className="address-list">{addresses.map(a=><article key={a.id}><strong>{a.label}{a.is_default?' · основной':''}</strong><span>{a.recipient_name}, {a.phone}</span><p>{a.city}, {a.street}, {a.house}{a.apartment?`, кв. ${a.apartment}`:''}</p><button onClick={()=>run(async()=>{await api.deleteAddress(a.id);await load()})}>Удалить</button></article>)}</div><form onSubmit={addAddress} className="address-form"><label>Название<input name="label" placeholder="Дом" required/></label><label>Получатель<input name="recipientName" defaultValue={user?.name} required/></label><label>Телефон<input name="phone" required/></label><label>Город<input name="city" required/></label><label>Улица<input name="street" required/></label><label>Дом<input name="house" required/></label><label>Квартира<input name="apartment"/></label><label>Индекс<input name="postalCode"/></label><label className="check-field"><input type="checkbox" name="isDefault"/> Основной адрес</label><button className="outline-action">Добавить адрес</button></form></section>
    <section className="order-history"><h2>Заказы</h2>{orders.length?orders.map(o=><article key={o.id}><div><strong>Заказ №{o.id}</strong><span>{new Date(o.created_at).toLocaleDateString('ru-RU')}</span></div><div><span>{o.items.map(i=>`${i.name}, ${i.size} × ${i.quantity}`).join(' · ')}</span><b>{money(Number(o.total))}</b></div><i>{({new:'Новый',confirmed:'Подтверждён',shipped:'Отправлен',completed:'Завершён',cancelled:'Отменён'})[o.status]}</i></article>):<p>Пока нет заказов</p>}</section>
    <section className="danger-zone"><h2>Удаление профиля</h2><p>История заказов останется в обезличенном виде.</p><form onSubmit={removeAccount}><input name="password" type="password" required placeholder="Введите текущий пароль"/><button>Удалить профиль</button></form></section>
    <button className="action compact" onClick={() => go('catalog')}>Смотреть товары</button></main>;
}

function Admin({ products, setProducts, user, go }) {
  const [edit, setEdit] = useState(null);
  const [tab,setTab]=useState('products');
  const [orders,setOrders]=useState([]);
  const [error, setError] = useState('');
  const [saved,setSaved]=useState('');
  useEffect(()=>{if(user?.role==='moderator')api.orders().then(x=>setOrders(x.orders)).catch(()=>{})},[user]);
  if (!user || user.role !== 'moderator') return <main className="empty-state"><h1>Закрытая зона</h1><p>Войдите как moderator@saru.ru</p><button className="action compact" onClick={() => go('home')}>На главную</button></main>;
  const save = async e => {
    e.preventDefault(); setError(''); setSaved('');
    const d = new FormData(e.currentTarget);
    const variants=String(d.get('variants')).split(',').map(x=>{const [size,stock]=x.trim().split(':');return {size,stock:Number(stock)}}).filter(x=>x.size&&Number.isInteger(x.stock));
    const changed = {...edit,name:d.get('name'),subtitle:d.get('subtitle'),price:+d.get('price'),color:d.get('color'),tone:d.get('tone'),accent:d.get('accent'),story:d.get('story'),material:d.get('material'),fit:d.get('fit'),published:d.get('published')==='on',variants};
    try {
      const {product}=edit.id?await api.saveProduct(changed):await api.createProduct(changed);
      setProducts(edit.id?products.map(p => p.id===product.id?product:p):[...products,product]); setEdit(product); setSaved('Изменения сохранены');
    } catch(err) { setError(err.message); }
  };
  const blank={name:'Образец карточки сорочки SARU — цвет',subtitle:'',price:15000,color:'Слоновая кость',tone:'#eee8dc',accent:'#c4b49c',material:'100% хлопок',fit:'Прямая посадка',story:'',published:false,images:[],variants:[{size:'S',stock:0},{size:'M',stock:0},{size:'L',stock:0}]};
  const removeProduct=async p=>{if(!confirm(`Удалить «${p.name}»?`))return;await api.deleteProduct(p.id);setProducts(products.filter(x=>x.id!==p.id))};
  const upload=async e=>{const file=e.target.files[0];if(!file||!edit.id)return;setSaved('');try{const {product}=await api.uploadProductImage(edit.id,file);setEdit(product);setProducts(products.map(p=>p.id===product.id?product:p));setSaved('Фотография добавлена')}catch(err){setError(err.message)}finally{e.target.value=''}};
  const removeImage=async image=>{if(!confirm('Удалить эту фотографию?'))return;setError('');setSaved('');try{const {product}=await api.deleteProductImage(edit.id,image.id);setEdit(product);setProducts(products.map(p=>p.id===product.id?product:p));setSaved('Фотография удалена')}catch(err){setError(err.message)}};
  const status=async(o,value)=>{const {order}=await api.updateOrder(o.id,value);setOrders(orders.map(x=>x.id===o.id?order:x))};
  const published=products.filter(p=>p.published).length;
  const stock=products.reduce((sum,p)=>sum+p.variants.reduce((s,v)=>s+v.stock,0),0);
  return <main className="admin"><aside><div><button className="logo" onClick={() => go('home')}>SARU</button><span>Панель модератора</span></div><nav><button className={tab==='products'?'active':''} onClick={()=>setTab('products')}>Товары <b>{products.length}</b></button><button className={tab==='orders'?'active':''} onClick={()=>setTab('orders')}>Заказы <b>{orders.length}</b></button></nav><div className="admin-user"><small>Модератор</small><span>{user.email}</span></div><button className="admin-exit" onClick={() => go('home')}><Icon name="back"/> На сайт</button></aside><section>
    {tab==='products'?<><header><div><span className="micro">Управление каталогом</span><h1>Товары</h1><p>Редактируйте карточки, фотографии, размеры и доступность на сайте.</p></div><button className="action compact" onClick={() => {setError('');setSaved('');setEdit(blank)}}><Icon name="plus"/> Добавить товар</button></header>
    <div className="admin-stats"><article><span>Всего карточек</span><strong>{products.length}</strong></article><article><span>На сайте</span><strong>{published}</strong></article><article><span>Скрыто</span><strong>{products.length-published}</strong></article><article><span>Остаток</span><strong>{stock} <small>шт.</small></strong></article></div>
    <div className="admin-list"><div className="admin-list-head"><span>Карточка</span><span>Остаток</span><span>Цена</span><span>Статус</span><span>Действия</span></div>{products.map(p => <article key={p.id}><div className="admin-thumb">{p.image ? <img src={p.image} alt=""/> : <Shirt product={p}/>}</div><div className="admin-product-info"><strong>{p.name}</strong><small>{p.color} · {p.material||'Состав не указан'}</small></div><span>{p.variants.reduce((s,v)=>s+v.stock,0)} шт.</span><span>{money(p.price)}</span><i className={p.published?'published':'draft'}>{p.published?'Опубликован':'Скрыт'}</i><div className="admin-actions"><button aria-label={`Редактировать ${p.name}`} onClick={() => {setError('');setSaved('');setEdit(p)}}><Icon name="edit"/></button><button aria-label={`Удалить ${p.name}`} onClick={()=>removeProduct(p)}><Icon name="close"/></button></div></article>)}</div></>:<><header><div><span className="micro">Работа с покупателями</span><h1>Заказы</h1></div></header><div className="admin-orders">{orders.map(o=><article key={o.id}><div><strong>№{o.id} · {o.customer_name}</strong><span>{o.phone} · {o.email}</span><small>{o.address}</small></div><div><b>{money(Number(o.total))}</b><select value={o.status} onChange={e=>status(o,e.target.value)}>{[['new','Новый'],['confirmed','Подтверждён'],['shipped','Отправлен'],['completed','Завершён'],['cancelled','Отменён']].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></div></article>)}</div></>}
  </section>{edit && <div className="modal admin-modal"><button className="modal-air" aria-label="Закрыть" onClick={() => setEdit(null)}/><form className="editor" onSubmit={save}><button type="button" className="round auth-close" aria-label="Закрыть" onClick={() => setEdit(null)}><Icon name="close"/></button><div className="editor-head"><span className="micro">{edit.id?`Товар №${edit.id}`:'Новая карточка'}</span><h2>{edit.id?'Редактирование':'Создание товара'}</h2><p>Информация сразу появится в каталоге после публикации.</p></div>{error&&<p className="auth-error">{error}</p>}{saved&&<p className="editor-saved"><Icon name="check" size={15}/>{saved}</p>}
    <fieldset><legend>Основная информация</legend><label>Название<input name="name" defaultValue={edit.name} required maxLength="160"/></label><label>Краткое описание<input name="subtitle" defaultValue={edit.subtitle} maxLength="240"/></label><div className="editor-grid"><label>Цена, ₽<input name="price" type="number" min="0" step="100" defaultValue={edit.price} required/></label><label>Название цвета<input name="color" defaultValue={edit.color} maxLength="80"/></label></div><div className="editor-grid color-fields"><label>Основной оттенок<span><input name="tone" type="color" defaultValue={edit.tone||'#eee8dc'} onInput={e=>{e.currentTarget.nextElementSibling.value=e.currentTarget.value}}/><input name="toneText" defaultValue={edit.tone||'#eee8dc'} readOnly/></span></label><label>Акцент<span><input name="accent" type="color" defaultValue={edit.accent||'#c4b49c'} onInput={e=>{e.currentTarget.nextElementSibling.value=e.currentTarget.value}}/><input name="accentText" defaultValue={edit.accent||'#c4b49c'} readOnly/></span></label></div></fieldset>
    <fieldset><legend>Характеристики</legend><label>Размеры и остатки<input name="variants" defaultValue={edit.variants.map(v=>`${v.size}:${v.stock}`).join(', ')} placeholder="S:5, M:8, L:3"/><small>Формат: размер:количество через запятую</small></label><div className="editor-grid"><label>Состав<input name="material" defaultValue={edit.material} maxLength="180"/></label><label>Посадка<input name="fit" defaultValue={edit.fit} maxLength="120"/></label></div><label>Полное описание<textarea name="story" defaultValue={edit.story} maxLength="2000"/></label></fieldset>
    <fieldset><legend>Фотографии</legend>{edit.id?<><div className="editor-images">{edit.images?.length?edit.images.map(image=><figure key={image.id}><img src={image.url} alt={image.altText||edit.name}/><button type="button" onClick={()=>removeImage(image)} aria-label="Удалить фотографию"><Icon name="close" size={15}/></button></figure>):<p>Фотографий пока нет</p>}</div><label className="upload">Добавить фотографию <small>JPEG, PNG или WebP · до 8 МБ</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload}/></label></>:<p className="editor-hint">Сначала сохраните карточку, затем появится загрузка фотографий.</p>}</fieldset>
    <label className="publish"><input name="published" type="checkbox" defaultChecked={edit.published}/><span><strong>Показывать карточку на сайте</strong><small>Если выключить, товар останется доступен только модератору.</small></span></label><button className="action">{edit.id?'Сохранить изменения':'Создать карточку'}</button></form></div>}</main>;
}

function Story() {
  return <main className="story"><header><h1>Меньше шума.<br/>Больше ощущения.</h1></header><section><p>Нам близки вещи, которые оставляют пространство для собственного голоса.</p><p>В основе SARU — точная конструкция, натуральные материалы и спокойные оттенки.</p></section></main>;
}

function Footer({ go }) {
  return <footer className="site-footer"><div className="footer-columns"><div><span className="micro">Меню</span><button onClick={() => go('catalog')}>Товары</button><button onClick={() => go('story')}>О бренде</button></div><div><span className="micro">Помощь</span><button>Доставка и возврат</button><button>Уход</button></div><div><span className="micro">Контакты</span><a href="mailto:hello@saru.ru">hello@saru.ru</a><a href="#">Telegram</a></div></div></footer>;
}

function App() {
  const [route, setRoute] = useState({ name:'home' });
  const [products,setProducts] = useState(PRODUCTS);
  const [cart,setCart] = useState([]);
  const [user,setUser] = useState(null);
  const [auth,setAuth] = useState(null);
  const [ready,setReady] = useState(false);
  const [notice,setNotice] = useState('');
  const go = (name,id) => setRoute({name,id});
  useEffect(() => window.scrollTo({top:0,behavior:'smooth'}), [route]);
  useEffect(() => {
    Promise.all([api.products(),api.session()])
      .then(([catalog,session]) => { setProducts(catalog.products); setUser(session.user); setCart(session.cart); })
      .catch(err => setNotice(err.message))
      .finally(() => setReady(true));
  },[]);
  useEffect(()=>{
    const token=new URLSearchParams(window.location.search).get('verify');
    if(!token)return;
    api.verifyEmail(token).then(()=>api.session()).then(session=>{setUser(session.user);setNotice('Почта успешно подтверждена')}).catch(err=>setNotice(err.message)).finally(()=>{
      const clean=new URL(window.location.href);clean.searchParams.delete('verify');window.history.replaceState({},'',clean.pathname+clean.search);
    });
  },[]);
  const onSession = session => { setUser(session.user); setCart(session.cart||[]); api.products().then(x=>setProducts(x.products)); };
  const logout = async () => { await api.logout(); setUser(null); setCart([]); if(route.name==='admin'||route.name==='account') go('home'); };
  const updateCart = async (p,size,quantity) => {
    try { const result=await api.setCartItem({productId:p.id,size,quantity}); setCart(result.cart); return true; }
    catch(err) { setNotice(err.message); return false; }
  };
  const add = (p,size) => { const x=cart.find(i=>i.id===p.id&&i.size===size); return updateCart(p,size,(x?.qty||0)+1); };
  const change = (item,n) => updateCart(item,item.size,item.qty+n);
  const remove = item => updateCart(item,item.size,0);
  const page = useMemo(() => {
    const props={products,go};
    if(route.name==='catalog') return <Catalog {...props}/>;
    if(route.name==='product') return <ProductPage product={products.find(p=>p.id===route.id)||products[0]} user={user} add={add} go={go} openAuth={m=>setAuth(m||true)}/>;
    if(route.name==='cart') return <Cart cart={cart} change={change} remove={remove} go={go} user={user} onOrdered={()=>setCart([])}/>;
    if(route.name==='account') return <Account user={user} go={go} onUser={setUser} onLogout={logout}/>;
    if(route.name==='admin') return <Admin products={products} setProducts={setProducts} user={user} go={go}/>;
    if(route.name==='story') return <Story/>;
    return <Home {...props}/>;
  },[route,products,cart,user]);
  if(!ready) return <div className="boot">SARU</div>;
  return <><Header go={go} user={user} cartCount={cart.reduce((s,i)=>s+i.qty,0)} openAuth={()=>setAuth(true)} logout={logout}/>{notice&&<button className="notice" onClick={()=>setNotice('')}>{notice}<Icon name="close" size={15}/></button>}{page}{route.name!=='admin'&&<Footer go={go}/>} {auth&&<Auth message={typeof auth==='string'?auth:null} close={()=>setAuth(null)} onSession={onSession}/>}</>;
}

createRoot(document.getElementById('root')).render(<App/>);
