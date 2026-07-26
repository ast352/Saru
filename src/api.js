const request = async (path, options = {}) => {
  const isForm = options.body instanceof FormData;
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { ...(isForm ? {} : { 'content-type': 'application/json' }), ...options.headers },
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
  orders: () => request('/api/orders'),
  createOrder: body => request('/api/orders', { method:'POST', body:JSON.stringify(body) }),
  updateOrder: (id,status) => request(`/api/orders/${id}/status`, { method:'PATCH', body:JSON.stringify({status}) }),
  createProduct: product => request('/api/products', { method:'POST', body:JSON.stringify(product) }),
  saveProduct: product => request(`/api/products/${product.id}`, { method:'PUT', body:JSON.stringify(product) }),
  deleteProduct: id => request(`/api/products/${id}`, { method:'DELETE' }),
  uploadProductImage: (id,file) => {
    const body=new FormData(); body.append('image',file);
    return request(`/api/products/${id}/images`, { method:'POST', body });
  },
  deleteProductImage: (productId,imageId) => request(`/api/products/${productId}/images/${imageId}`, { method:'DELETE' }),
};
