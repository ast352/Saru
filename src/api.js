const request = async (path, options = {}) => {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить запрос');
  return data;
};

export const api = {
  products: () => request('/api/products'),
  session: () => request('/api/session'),
  register: body => request('/api/auth/register', { method:'POST', body:JSON.stringify(body) }),
  login: body => request('/api/auth/login', { method:'POST', body:JSON.stringify(body) }),
  logout: () => request('/api/auth/logout', { method:'POST' }),
  resetRequest: email => request('/api/auth/reset-request', { method:'POST', body:JSON.stringify({email}) }),
  resetPassword: body => request('/api/auth/reset', { method:'POST', body:JSON.stringify(body) }),
  setCartItem: body => request('/api/cart', { method:'PUT', body:JSON.stringify(body) }),
  saveProduct: product => request(`/api/products/${product.id}`, { method:'PUT', body:JSON.stringify(product) }),
};
