import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const seedProducts = [
  { id: 1, name: 'Рубашка «Тихий свет»', price: 18900, color: 'Молочный', tone: '#eee8dc', accent: '#d7c7ae', material: '100% длинноволокнистый хлопок', fit: 'Свободный крой', sizes: ['S', 'M', 'L', 'XL'], note: 'Мягкая рубашка из плотного хлопка с деликатной матовой фактурой. Расслабленный силуэт и широкая манжета.' },
  { id: 2, name: 'Рубашка «Полынь»', price: 21500, color: 'Шалфей', tone: '#d4d9ca', accent: '#9eaa91', material: 'Хлопок 72%, лён 28%', fit: 'Прямой крой', sizes: ['S', 'M', 'L'], note: 'Дышащая ткань с естественной неоднородностью. Мягкий воротник и перламутровые пуговицы.' },
  { id: 3, name: 'Рубашка «Глина»', price: 23200, color: 'Терракотовый', tone: '#d8b19a', accent: '#a9694d', material: '100% вымытый лён', fit: 'Свободный крой', sizes: ['M', 'L', 'XL'], note: 'Льняная рубашка тёплого оттенка. Становится мягче после каждой стирки и красиво стареет.' },
  { id: 4, name: 'Рубашка «Дымка»', price: 19800, color: 'Серо-голубой', tone: '#cdd5d4', accent: '#879a9c', material: 'Хлопок 86%, шёлк 14%', fit: 'Приталенный крой', sizes: ['XS', 'S', 'M', 'L'], note: 'Лёгкая рубашка с едва заметным блеском. Тонкая ткань, чистая линия плеча и скрытая планка.' },
  { id: 5, name: 'Рубашка «Овёс»', price: 22400, color: 'Песочный', tone: '#ddd0b8', accent: '#ac9167', material: 'Хлопок 55%, лён 45%', fit: 'Прямой крой', sizes: ['S', 'M', 'L', 'XL'], note: 'Спокойная база с фактурой льна. Накладной карман и чуть удлинённая спинка.' },
  { id: 6, name: 'Рубашка «Чернила»', price: 24600, color: 'Глубокий синий', tone: '#58646b', accent: '#27353d', material: '100% хлопок', fit: 'Свободный крой', sizes: ['M', 'L', 'XL'], note: 'Глубокий цвет и плотное сатиновое переплетение. Выразительная вечерняя рубашка без лишних деталей.' },
];

const money = n => `${new Intl.NumberFormat('ru-RU').format(n)} ₽`;

function Icon({ name, size = 21 }) {
  const paths = {
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
    bag: <><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    arrow: <><path d="m5 12 14 0M14 7l5 5-5 5"/></>,
    back: <><path d="m19 12-14 0M10 7l-5 5 5 5"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    minus: <><path d="M5 12h14"/></>,
    trash: <><path d="M4 7h16M9 3h6l1 4H8l1-4ZM7 7l1 14h8l1-14"/></>,
    heart: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function ShirtArt({ product, large = false }) {
  return (
    <svg className={`shirt-art ${large ? 'large' : ''}`} viewBox="0 0 440 540" role="img" aria-label={product.name}>
      <defs><linearGradient id={`g${product.id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={product.tone}/><stop offset="1" stopColor={product.accent}/></linearGradient></defs>
      <path d="M150 75 90 105 26 225l54 35 45-71-12 286h214l-12-286 45 71 54-35-64-120-60-30-35 38h-50z" fill={`url(#g${product.id})`}/>
      <path d="m150 75 55 38-37 44-39-58M290 75l-55 38 37 44 39-58" fill={product.tone} stroke={product.accent} strokeWidth="3"/>
      <path d="M220 114v361M168 157l52-43 52 43" fill="none" stroke={product.accent} strokeWidth="3"/>
      {[185,235,285,335,385,435].map(y => <circle key={y} cx="220" cy={y} r="3.5" fill={product.accent}/>)}
      <path d="M113 445h214M80 260l37 17M360 260l-37 17" stroke={product.accent} strokeWidth="3"/>
    </svg>
  );
}

function Header({ navigate, user, cartCount, openAuth, logout }) {
  const [menu, setMenu] = useState(false);
  return <header className="header">
    <button className="icon-button" onClick={() => setMenu(true)} aria-label="Меню"><Icon name="menu"/></button>
    <button className="wordmark" onClick={() => navigate('home')} aria-label="На главную">САРУ</button>
    <div className="header-actions">
      {user ? <button className="text-button desktop-only" onClick={() => user.role === 'moderator' ? navigate('admin') : logout()}>{user.role === 'moderator' ? 'Панель' : 'Выйти'}</button> : null}
      <button className="icon-button" onClick={user ? () => navigate(user.role === 'moderator' ? 'admin' : 'account') : openAuth} aria-label="Профиль"><Icon name="user"/></button>
      <button className="icon-button bag-button" onClick={() => navigate('cart')} aria-label="Корзина"><Icon name="bag"/>{cartCount > 0 && <span>{cartCount}</span>}</button>
    </div>
    {menu && <div className="menu-panel">
      <button className="icon-button close-menu" onClick={() => setMenu(false)}><Icon name="close"/></button>
      <nav>
        <button onClick={() => { navigate('home'); setMenu(false); }}>Главная</button>
        <button onClick={() => { navigate('catalog'); setMenu(false); }}>Коллекция 01</button>
        <button onClick={() => { navigate('story'); setMenu(false); }}>О бренде</button>
        <button onClick={() => { navigate('cart'); setMenu(false); }}>Корзина</button>
      </nav>
      <p>Рубашки для неспешной жизни.<br/>Москва · 2026</p>
    </div>}
  </header>;
}

function Home({ products, navigate }) {
  return <>
    <section className="hero">
      <div className="hero-placeholder">
        <div className="sun-disc"/>
        <div className="silhouette"><span/><span/></div>
        <div className="grain"/>
      </div>
      <div className="hero-copy"><p>Коллекция 01 · 2026</p><h1>Одежда,<br/>в которой тихо</h1><button onClick={() => navigate('catalog')}>Смотреть коллекцию <Icon name="arrow"/></button></div>
      <div className="video-note"><span>Место для вашего видео</span><i/></div>
    </section>
    <section className="intro"><p>САРУ / МАНИФЕСТ</p><h2>Мы создаём рубашки, которые не требуют повода. Натуральные ткани, мягкие линии и внимание к тому, как вещь живёт вместе с вами.</h2></section>
    <section className="collection">
      <div className="section-head"><div><p>Новая коллекция</p><h2>Рубашки Сару</h2></div><button onClick={() => navigate('catalog')}>Смотреть все <Icon name="arrow"/></button></div>
      <div className="product-grid">{products.slice(0,4).map(p => <ProductCard key={p.id} product={p} navigate={navigate}/>)}</div>
    </section>
    <section className="editorial"><div><p>Материал 01</p><h2>Хлопок, лён<br/>и немного воздуха</h2></div><p>Мы выбираем ткани за тактильность, долговечность и способность становиться только лучше со временем.</p></section>
    <Newsletter />
  </>;
}

function ProductCard({ product, navigate }) {
  return <article className="product-card" onClick={() => navigate('product', product.id)}>
    <div className="product-image"><ShirtArt product={product}/><button className="heart" onClick={e => e.stopPropagation()} aria-label="В избранное"><Icon name="heart"/></button></div>
    <div className="product-meta"><div><h3>{product.name}</h3><p>{product.color}</p></div><strong>{money(product.price)}</strong></div>
  </article>;
}

function Catalog({ products, navigate }) {
  const [filter, setFilter] = useState('Все');
  const colors = ['Все', ...new Set(products.map(p => p.color))];
  const shown = filter === 'Все' ? products : products.filter(p => p.color === filter);
  return <main className="page catalog-page"><div className="page-title"><p>Коллекция 01 · 2026</p><h1>Рубашки</h1><span>{shown.length} моделей</span></div>
    <div className="filters">{colors.map(c => <button className={filter === c ? 'active' : ''} onClick={() => setFilter(c)} key={c}>{c}</button>)}</div>
    <div className="product-grid">{shown.map(p => <ProductCard key={p.id} product={p} navigate={navigate}/>)}</div>
  </main>;
}

function Product({ product, addToCart, navigate, user, openAuth }) {
  const [size, setSize] = useState(product.sizes[0]);
  const [added, setAdded] = useState(false);
  const add = () => {
    if (!user) return openAuth('Чтобы добавить рубашку в корзину, войдите или создайте профиль.');
    addToCart(product, size); setAdded(true); setTimeout(() => setAdded(false), 1800);
  };
  return <main className="product-page">
    <button className="back-link" onClick={() => navigate('catalog')}><Icon name="back"/> Назад к коллекции</button>
    <div className="product-gallery">
      <div className="gallery-main"><ShirtArt product={product} large/><span>01 / 02</span></div>
      <div className="gallery-detail"><ShirtArt product={{...product, id: product.id + 20}}/></div>
    </div>
    <aside className="product-info">
      <p className="eyebrow">Сару · Коллекция 01</p><h1>{product.name}</h1><p className="product-color">{product.color}</p><strong className="product-price">{money(product.price)}</strong>
      <div className="size-row"><span>Размер</span><button>Таблица размеров</button></div>
      <div className="sizes">{product.sizes.map(s => <button key={s} onClick={() => setSize(s)} className={size === s ? 'active' : ''}>{s}</button>)}</div>
      <button className={`primary ${added ? 'success' : ''}`} onClick={add}>{added ? <><Icon name="check"/> Добавлено</> : 'Добавить в корзину'}</button>
      {!user && <p className="auth-hint">Для добавления в корзину потребуется регистрация</p>}
      <p className="description">{product.note}</p>
      <details open><summary>Состав и детали <Icon name="plus"/></summary><p>{product.material}<br/>{product.fit}<br/>Сделано в России</p></details>
      <details><summary>Доставка и возврат <Icon name="plus"/></summary><p>Бесплатная доставка по России. Возврат в течение 14 дней.</p></details>
    </aside>
  </main>;
}

function Cart({ cart, updateCart, removeCart, navigate }) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return <main className="page cart-page"><div className="page-title centered"><p>Сару · Ваш выбор</p><h1>Корзина</h1></div>
    {cart.length === 0 ? <div className="empty"><h2>Здесь пока тихо</h2><p>Добавьте рубашку из нашей первой коллекции.</p><button className="primary" onClick={() => navigate('catalog')}>Перейти в каталог</button></div> :
    <div className="cart-layout"><section className="cart-list">{cart.map(item => <article className="cart-item" key={`${item.id}-${item.size}`}>
      <div className="cart-thumb"><ShirtArt product={item}/></div>
      <div className="cart-body"><div><p className="eyebrow">САРУ</p><h2>{item.name}</h2><p>{item.color} · Размер {item.size}</p></div>
        <div className="qty"><button onClick={() => updateCart(item, -1)}><Icon name="minus" size={16}/></button><span>{item.qty}</span><button onClick={() => updateCart(item, 1)}><Icon name="plus" size={16}/></button></div>
      </div><div className="cart-price"><button onClick={() => removeCart(item)} aria-label="Удалить"><Icon name="close"/></button><strong>{money(item.price * item.qty)}</strong></div>
    </article>)}</section>
      <aside className="cart-summary"><div><h2>Итого</h2><strong>{money(total)}</strong></div><div className="summary-line"><span>{cart.reduce((s,i)=>s+i.qty,0)} товара</span><span>{money(total)}</span></div><button className="promo">Добавить промокод</button><div className="delivery-note">Бесплатная доставка по России</div><button className="primary" onClick={() => alert('Оплату подключим на следующем этапе.')}>Оформить заказ</button><p>Оплата появится в следующей версии сайта</p></aside>
    </div>}
  </main>;
}

function AuthModal({ close, message, login }) {
  const [mode, setMode] = useState('login');
  const [done, setDone] = useState(false);
  const submit = e => { e.preventDefault(); if (mode === 'reset') return setDone(true); const data = new FormData(e.currentTarget); login({ email: data.get('email'), role: data.get('email') === 'moderator@saru.ru' ? 'moderator' : 'customer' }); close(); };
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><div className="auth-modal"><button className="modal-close" onClick={close}><Icon name="close"/></button>
    <p className="eyebrow">Личный кабинет</p><h2>{mode === 'register' ? 'Создать профиль' : mode === 'reset' ? 'Восстановить пароль' : 'С возвращением'}</h2>{message && <p className="modal-message">{message}</p>}
    {done ? <div className="reset-done"><Icon name="check" size={28}/><p>Ссылка для восстановления отправлена на вашу почту.</p><button className="text-link" onClick={() => {setDone(false); setMode('login')}}>Вернуться ко входу</button></div> :
    <form onSubmit={submit}>{mode === 'register' && <label>Имя<input name="name" required placeholder="Как к вам обращаться"/></label>}<label>Электронная почта<input name="email" type="email" required placeholder="name@example.ru"/></label>{mode !== 'reset' && <label>Пароль<input name="password" type="password" required minLength="6" placeholder="Не менее 6 символов"/></label>}<button className="primary" type="submit">{mode === 'register' ? 'Зарегистрироваться' : mode === 'reset' ? 'Отправить ссылку' : 'Войти'}</button></form>}
    {mode === 'login' && <><button className="text-link" onClick={() => setMode('reset')}>Забыли пароль?</button><p className="switch">Впервые у нас? <button onClick={() => setMode('register')}>Создать профиль</button></p><p className="demo-login">Для демо-модератора: moderator@saru.ru</p></>}
    {mode !== 'login' && !done && <button className="text-link" onClick={() => setMode('login')}>Уже есть профиль? Войти</button>}
  </div></div>;
}

function Admin({ products, setProducts, user, navigate }) {
  const [editing, setEditing] = useState(null);
  if (!user || user.role !== 'moderator') return <main className="page empty"><h2>Закрытая зона</h2><p>Войдите с почтой moderator@saru.ru, чтобы открыть демо-панель.</p><button className="primary" onClick={() => navigate('home')}>На главную</button></main>;
  const save = e => { e.preventDefault(); const d = new FormData(e.currentTarget); const next = { ...editing, name:d.get('name'), price:Number(d.get('price')), color:d.get('color'), note:d.get('note') }; setProducts(products.map(p => p.id === next.id ? next : p)); setEditing(null); };
  return <main className="admin-page"><aside className="admin-nav"><button className="wordmark" onClick={() => navigate('home')}>САРУ</button><p>Панель модератора</p><nav><button className="active">Товары <span>{products.length}</span></button><button>Заказы <span>0</span></button><button>Коллекции</button></nav><button className="admin-back" onClick={() => navigate('home')}><Icon name="back"/> На сайт</button></aside>
    <section className="admin-content"><div className="admin-head"><div><p>Каталог</p><h1>Товары</h1></div><button className="primary" onClick={() => setEditing({...seedProducts[0], id: Date.now(), name:'Новая рубашка', price:19000})}><Icon name="plus"/> Добавить товар</button></div>
      <div className="admin-table"><div className="table-row table-title"><span>Товар</span><span>Цвет</span><span>Цена</span><span>Статус</span><span/></div>{products.map(p => <div className="table-row" key={p.id}><div className="table-product"><div><ShirtArt product={p}/></div><strong>{p.name}</strong></div><span>{p.color}</span><span>{money(p.price)}</span><span className="status">Опубликован</span><button onClick={() => setEditing(p)}><Icon name="edit"/></button></div>)}</div>
    </section>
    {editing && <div className="modal-backdrop"><form className="edit-modal" onSubmit={save}><button type="button" className="modal-close" onClick={() => setEditing(null)}><Icon name="close"/></button><p className="eyebrow">Редактор карточки</p><h2>{editing.name}</h2><div className="upload-zone"><ShirtArt product={editing}/><span><Icon name="plus"/> Загрузить фото</span><small>PNG или JPG до 10 МБ</small></div><label>Название<input name="name" defaultValue={editing.name}/></label><div className="form-row"><label>Цена<input name="price" type="number" defaultValue={editing.price}/></label><label>Цвет<input name="color" defaultValue={editing.color}/></label></div><label>Описание<textarea name="note" defaultValue={editing.note}/></label><button className="primary">Сохранить изменения</button></form></div>}
  </main>;
}

function Account({ user, navigate }) {
  return <main className="page account-page"><p className="eyebrow">Личный кабинет</p><h1>Здравствуйте</h1><div className="account-card"><div><span>Профиль</span><strong>{user?.email}</strong></div><div><span>Заказы</span><strong>У вас пока нет заказов</strong></div><button className="primary" onClick={() => navigate('catalog')}>Смотреть коллекцию</button></div></main>;
}

function Story() {
  return <main className="story-page"><section><p>Сару · Москва</p><h1>Вещи,<br/>которые остаются</h1></section><div className="story-copy"><p>Сару начался с простой мысли: хорошей рубашке не нужен громкий голос.</p><p>Мы работаем с натуральными тканями, спокойными цветами и формой, в которой удобно двигаться, жить и возвращаться домой.</p></div></main>;
}

function Newsletter() {
  const [sent, setSent] = useState(false);
  return <section className="newsletter"><div><p>Письма Сару</p><h2>Редко, но по делу</h2></div><form onSubmit={e => { e.preventDefault(); setSent(true); }}><input type="email" placeholder="Ваша электронная почта" required/><button>{sent ? 'Спасибо' : <Icon name="arrow"/>}</button></form></section>;
}

function Footer({ navigate }) {
  return <footer><div className="footer-logo">САРУ</div><div className="footer-links"><div><p>Навигация</p><button onClick={() => navigate('catalog')}>Коллекция</button><button onClick={() => navigate('story')}>О бренде</button></div><div><p>Помощь</p><button>Доставка и возврат</button><button>Уход за изделиями</button></div><div><p>Связаться</p><a href="mailto:hello@saru.ru">hello@saru.ru</a><a href="#">Telegram</a></div></div><div className="footer-bottom"><span>© 2026 Сару</span><span>Сделано неспешно</span></div></footer>;
}

function App() {
  const [route, setRoute] = useState({name:'home'});
  const [products, setProducts] = useState(() => JSON.parse(localStorage.getItem('saru-products') || 'null') || seedProducts);
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('saru-cart') || '[]'));
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('saru-user') || 'null'));
  const [auth, setAuth] = useState(null);
  useEffect(() => localStorage.setItem('saru-products', JSON.stringify(products)), [products]);
  useEffect(() => localStorage.setItem('saru-cart', JSON.stringify(cart)), [cart]);
  useEffect(() => user ? localStorage.setItem('saru-user', JSON.stringify(user)) : localStorage.removeItem('saru-user'), [user]);
  useEffect(() => { window.scrollTo({top:0, behavior:'smooth'}); }, [route]);
  const navigate = (name, id) => setRoute({name, id});
  const addToCart = (p,size) => setCart(c => { const found=c.find(i=>i.id===p.id&&i.size===size); return found ? c.map(i=>i===found?{...i,qty:i.qty+1}:i) : [...c,{...p,size,qty:1}]; });
  const updateCart = (item,d) => setCart(c => c.map(i=>i.id===item.id&&i.size===item.size?{...i,qty:i.qty+d}:i).filter(i=>i.qty>0));
  const removeCart = item => setCart(c => c.filter(i=>!(i.id===item.id&&i.size===item.size)));
  const content = useMemo(() => {
    if (route.name === 'catalog') return <Catalog products={products} navigate={navigate}/>;
    if (route.name === 'product') return <Product product={products.find(p=>p.id===route.id) || products[0]} addToCart={addToCart} navigate={navigate} user={user} openAuth={m=>setAuth(m || true)}/>;
    if (route.name === 'cart') return <Cart cart={cart} updateCart={updateCart} removeCart={removeCart} navigate={navigate}/>;
    if (route.name === 'admin') return <Admin products={products} setProducts={setProducts} user={user} navigate={navigate}/>;
    if (route.name === 'account') return <Account user={user} navigate={navigate}/>;
    if (route.name === 'story') return <Story/>;
    return <Home products={products} navigate={navigate}/>;
  }, [route, products, cart, user]);
  return <><Header navigate={navigate} user={user} cartCount={cart.reduce((s,i)=>s+i.qty,0)} openAuth={()=>setAuth(true)} logout={()=>setUser(null)}/>{content}{route.name !== 'admin' && <Footer navigate={navigate}/>} {auth && <AuthModal close={()=>setAuth(null)} message={typeof auth==='string'?auth:null} login={setUser}/>}</>;
}

createRoot(document.getElementById('root')).render(<App/>);
