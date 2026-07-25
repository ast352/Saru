import React from 'react';

export function Icon({ name, size = 21 }) {
  const paths = {
    menu: <path d="M4 7h16M4 12h12M4 17h16"/>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
    bag: <><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    back: <path d="M19 12H5m5-5-5 5 5 5"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    minus: <path d="M5 12h14"/>,
    edit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function Shirt({ product }) {
  return <svg className="shirt" viewBox="0 0 440 540" role="img" aria-label={product.name}>
    <defs><linearGradient id={`shirt-${product.id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={product.tone}/><stop offset="1" stopColor={product.accent}/></linearGradient></defs>
    <path d="M150 75 90 105 26 225l54 35 45-71-12 286h214l-12-286 45 71 54-35-64-120-60-30-35 38h-50z" fill={`url(#shirt-${product.id})`}/>
    <path d="m150 75 55 38-37 44-39-58m161-24-55 38 37 44 39-58M220 114v361" fill={product.tone} stroke={product.accent} strokeWidth="3"/>
    {[185,235,285,335,385,435].map(y => <circle key={y} cx="220" cy={y} r="3.5" fill={product.accent}/>)}
  </svg>;
}
