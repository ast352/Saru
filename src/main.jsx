import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PRODUCTS, money } from './data';
import { Icon, Shirt } from './ui';
import './app.css';

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};

function Header({ go, user, cartCount, openAuth, logout }) {
  const [open, setOpen] = useState(false);
  return <>
    <header className="site-header">
      <button className="round" onClick={() => setOpen(true)} aria-label="Открыть меню"><Icon name="menu"/></button>
      <button className="logo" onClick={() => go('home')}>САРУ</button>
      <div className="header-tools">
        {user && <button className="header-label" onClick={() => user.role === 'moderator' ? go('admin') : logout()}>{user.role === 'moderator' ? 'Управление' : 'Выйти'}</button>}
        <button className="round" onClick={user ? () => go(user.role === 'moderator' ? 'admin' : 'account') : openAuth}><Icon name="user"/></button>
        <button className="round bag" onClick={() => go('cart')}><Icon name="bag"/>{cartCount > 0 && <i>{cartCount}</i>}</button>
      </div>
    </header>
    {open && <div className="nav-layer">
      <div className="nav-panel">
        <button className="round nav-close" onClick={() => setOpen(false)}><Icon name="close"/></button>
        <nav>{[['home','Главная'],['catalog','Товары'],['story','О бренде'],['cart','Корзина']].map(([r,l],i) => <button key={r} onClick={() => {go(r);setOpen(false)}}><small>0{i+1}</small>{l}<Icon name="arrow"/></button>)}</nav>
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
      <div className="hero-photo"><img src="/images/saru-hero-v2.jpg" alt="Место для будущего видео Сару"/></div>
    </section>

    <section className="featured">
      <div className="collection-bar"><h2>Рубашки</h2><div className="rail-actions"><button onClick={() => move(-1)} aria-label="Назад"><Icon name="back"/></button><button onClick={() => move(1)} aria-label="Вперёд"><Icon name="arrow"/></button></div></div>
      <div className="feature-rail" ref={rail}>{products.map((p, i) => <article className="feature-card" key={p.id} onClick={() => go('product', p.id)}>
        <div className="feature-image">{p.image ? <img src={p.image} alt={p.name}/> : <Shirt product={p}/>}<span>{String(i+1).padStart(2,'0')}</span></div>
        <div className="feature-copy"><div><h3>{p.name}</h3><p>{p.subtitle}</p></div><strong>{money(p.price)}</strong></div>
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
    <header className="catalog-head"><h1>Рубашки</h1><p>{shown.length} моделей</p></header>
    <div className="filter-row">{colors.map(c => <button className={c === color ? 'active' : ''} onClick={() => setColor(c)} key={c}>{c}</button>)}</div>
    <div className="catalog-grid">{shown.map(p => <ProductTile key={p.id} product={p} go={go}/>)}</div>
  </main>;
}

function ProductTile({ product, go }) {
  return <article className="product-tile" onClick={() => go('product', product.id)}>
    <div>{product.image ? <img src={product.image} alt={product.name}/> : <Shirt product={product}/>}<button aria-label="Открыть"><Icon name="arrow"/></button></div>
    <footer><span><strong>{product.name}</strong><small>{product.color}</small></span><b>{money(product.price)}</b></footer>
  </article>;
}

function ProductPage({ product, user, add, go, openAuth }) {
  const [size, setSize] = useState(product.sizes[0]);
  const [done, setDone] = useState(false);
  const buy = () => {
    if (!user) return openAuth('Войдите или создайте профиль, чтобы добавить рубашку в корзину.');
    add(product, size); setDone(true); setTimeout(() => setDone(false), 1600);
  };
  return <main className="product-view">
    <div className="product-visual">
      <button className="back" onClick={() => go('catalog')}><Icon name="back"/> Назад</button>
      {product.image ? <img src={product.image} alt={product.name}/> : <Shirt product={product}/>}
    </div>
    <aside className="product-details">
      <h1>{product.name}</h1><p className="subtitle">{product.subtitle} · {product.color}</p><strong className="price">{money(product.price)}</strong>
      <div className="size-head"><span>Выберите размер</span><button>Таблица размеров</button></div>
      <div className="size-list">{product.sizes.map(s => <button className={s === size ? 'active' : ''} onClick={() => setSize(s)} key={s}>{s}</button>)}</div>
      <button className={`action ${done ? 'done' : ''}`} onClick={buy}>{done ? <><Icon name="check"/> Добавлено</> : 'Добавить в корзину'}</button>
      {!user && <small className="login-note">Добавление доступно после регистрации</small>}
      <p className="product-story">{product.story}</p>
      <details open><summary>Состав и посадка <Icon name="plus"/></summary><p>{product.material}<br/>{product.fit}<br/>Сделано в России</p></details>
      <details><summary>Доставка и возврат <Icon name="plus"/></summary><p>Бесплатная доставка по России от 20 000 ₽. Возврат в течение 14 дней.</p></details>
    </aside>
  </main>;
}

function Cart({ cart, change, remove, go }) {
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  if (!cart.length) return <main className="empty-state"><h1>Корзина пуста</h1><button className="action compact" onClick={() => go('catalog')}>Перейти к товарам</button></main>;
  return <main className="shell cart"><header><h1>Корзина</h1></header><div className="cart-layout">
    <section>{cart.map(item => <article className="cart-line" key={`${item.id}-${item.size}`}>
      <div className="cart-image">{item.image ? <img src={item.image} alt={item.name}/> : <Shirt product={item}/>}</div>
      <div className="cart-info"><h2>{item.name}</h2><p>{item.color} · {item.size}</p><div className="counter"><button onClick={() => change(item,-1)}><Icon name="minus" size={15}/></button><span>{item.qty}</span><button onClick={() => change(item,1)}><Icon name="plus" size={15}/></button></div></div>
      <div className="cart-end"><button onClick={() => remove(item)}><Icon name="close"/></button><strong>{money(item.price * item.qty)}</strong></div>
    </article>)}</section>
    <aside className="total"><div><span>Итого</span><strong>{money(total)}</strong></div><p>Доставка рассчитывается на следующем шаге</p><button className="action" onClick={() => alert('Оплату подключим на следующем этапе.')}>Оформить заказ</button><small>Безопасная оплата появится в следующей версии</small></aside>
  </div></main>;
}

function Auth({ message, close, login }) {
  const [mode, setMode] = useState('login');
  const [sent, setSent] = useState(false);
  const submit = e => {
    e.preventDefault();
    if (mode === 'reset') return setSent(true);
    const email = new FormData(e.currentTarget).get('email');
    login({ email, role: email === 'moderator@saru.ru' ? 'moderator' : 'customer' }); close();
  };
  return <div className="modal"><button className="modal-air" onClick={close}/><section className="auth">
    <button className="round auth-close" onClick={close}><Icon name="close"/></button>
    <h2>{mode === 'register' ? 'Новый профиль' : mode === 'reset' ? 'Вернуть доступ' : 'С возвращением'}</h2>{message && <p className="auth-message">{message}</p>}
    {sent ? <div className="sent"><Icon name="check" size={28}/><p>Ссылка отправлена на вашу почту.</p></div> : <form onSubmit={submit}>
      {mode === 'register' && <label>Имя<input name="name" required placeholder="Как к вам обращаться"/></label>}
      <label>Почта<input name="email" type="email" required placeholder="name@example.ru"/></label>
      {mode !== 'reset' && <label>Пароль<input name="password" type="password" minLength="6" required placeholder="Минимум 6 символов"/></label>}
      <button className="action">{mode === 'register' ? 'Создать профиль' : mode === 'reset' ? 'Отправить ссылку' : 'Войти'}</button>
    </form>}
    <div className="auth-switch">{mode === 'login' ? <><button onClick={() => setMode('reset')}>Забыли пароль?</button><button onClick={() => setMode('register')}>Создать профиль</button></> : <button onClick={() => {setMode('login');setSent(false)}}>Вернуться ко входу</button>}</div>
    <small>Демо-модератор: moderator@saru.ru</small>
  </section></div>;
}

function Account({ user, go }) {
  return <main className="shell account"><h1>Профиль</h1><div><span>Электронная почта</span><strong>{user?.email}</strong></div><div><span>Заказы</span><strong>Пока нет заказов</strong></div><button className="action compact" onClick={() => go('catalog')}>Смотреть товары</button></main>;
}

function Admin({ products, setProducts, user, go }) {
  const [edit, setEdit] = useState(null);
  if (!user || user.role !== 'moderator') return <main className="empty-state"><h1>Закрытая зона</h1><p>Войдите как moderator@saru.ru</p><button className="action compact" onClick={() => go('home')}>На главную</button></main>;
  const save = e => { e.preventDefault(); const d = new FormData(e.currentTarget); setProducts(products.map(p => p.id === edit.id ? {...p,name:d.get('name'),price:+d.get('price'),color:d.get('color'),story:d.get('story')} : p)); setEdit(null); };
  return <main className="admin"><aside><button className="logo" onClick={() => go('home')}>САРУ</button><nav><button className="active">Товары <b>{products.length}</b></button><button>Заказы <b>0</b></button></nav><button className="admin-exit" onClick={() => go('home')}><Icon name="back"/> На сайт</button></aside><section>
    <header><h1>Товары</h1><button className="action compact" onClick={() => setEdit(products[0])}>Редактировать</button></header>
    <div className="admin-list">{products.map(p => <article key={p.id}><div>{p.image ? <img src={p.image} alt=""/> : <Shirt product={p}/>}</div><strong>{p.name}</strong><span>{p.color}</span><span>{money(p.price)}</span><i>Опубликован</i><button onClick={() => setEdit(p)}><Icon name="edit"/></button></article>)}</div>
  </section>{edit && <div className="modal"><button className="modal-air" onClick={() => setEdit(null)}/><form className="editor" onSubmit={save}><button type="button" className="round auth-close" onClick={() => setEdit(null)}><Icon name="close"/></button><h2>{edit.name}</h2><label>Название<input name="name" defaultValue={edit.name}/></label><div><label>Цена<input name="price" type="number" defaultValue={edit.price}/></label><label>Цвет<input name="color" defaultValue={edit.color}/></label></div><label>Описание<textarea name="story" defaultValue={edit.story}/></label><button className="action">Сохранить</button></form></div>}</main>;
}

function Story() {
  return <main className="story"><header><h1>Меньше шума.<br/>Больше ощущения.</h1></header><section><p>Нам близки вещи, которые оставляют пространство для собственного голоса.</p><p>В основе Сару — точная конструкция, натуральные материалы и спокойные оттенки.</p></section></main>;
}

function Footer({ go }) {
  return <footer className="site-footer"><div className="footer-columns"><div><span className="micro">Меню</span><button onClick={() => go('catalog')}>Товары</button><button onClick={() => go('story')}>О бренде</button></div><div><span className="micro">Помощь</span><button>Доставка и возврат</button><button>Уход</button></div><div><span className="micro">Контакты</span><a href="mailto:hello@saru.ru">hello@saru.ru</a><a href="#">Telegram</a></div></div></footer>;
}

function App() {
  const [route, setRoute] = useState({ name:'home' });
  const [products,setProducts] = useState(() => read('saru-products-v2', PRODUCTS));
  const [cart,setCart] = useState(() => read('saru-cart', []));
  const [user,setUser] = useState(() => read('saru-user', null));
  const [auth,setAuth] = useState(null);
  const go = (name,id) => setRoute({name,id});
  useEffect(() => window.scrollTo({top:0,behavior:'smooth'}), [route]);
  useEffect(() => localStorage.setItem('saru-products-v2',JSON.stringify(products)),[products]);
  useEffect(() => localStorage.setItem('saru-cart',JSON.stringify(cart)),[cart]);
  useEffect(() => user ? localStorage.setItem('saru-user',JSON.stringify(user)) : localStorage.removeItem('saru-user'),[user]);
  const add = (p,size) => setCart(old => { const x=old.find(i=>i.id===p.id&&i.size===size); return x?old.map(i=>i===x?{...i,qty:i.qty+1}:i):[...old,{...p,size,qty:1}] });
  const change = (item,n) => setCart(old => old.map(i=>i.id===item.id&&i.size===item.size?{...i,qty:i.qty+n}:i).filter(i=>i.qty>0));
  const remove = item => setCart(old => old.filter(i=>!(i.id===item.id&&i.size===item.size)));
  const page = useMemo(() => {
    const props={products,go};
    if(route.name==='catalog') return <Catalog {...props}/>;
    if(route.name==='product') return <ProductPage product={products.find(p=>p.id===route.id)||products[0]} user={user} add={add} go={go} openAuth={m=>setAuth(m||true)}/>;
    if(route.name==='cart') return <Cart cart={cart} change={change} remove={remove} go={go}/>;
    if(route.name==='account') return <Account user={user} go={go}/>;
    if(route.name==='admin') return <Admin products={products} setProducts={setProducts} user={user} go={go}/>;
    if(route.name==='story') return <Story/>;
    return <Home {...props}/>;
  },[route,products,cart,user]);
  return <><Header go={go} user={user} cartCount={cart.reduce((s,i)=>s+i.qty,0)} openAuth={()=>setAuth(true)} logout={()=>setUser(null)}/>{page}{route.name!=='admin'&&<Footer go={go}/>} {auth&&<Auth message={typeof auth==='string'?auth:null} close={()=>setAuth(null)} login={setUser}/>}</>;
}

createRoot(document.getElementById('root')).render(<App/>);
