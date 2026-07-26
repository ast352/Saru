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
  verifyEmail: token => request('/api/auth/verify-email', { method:'POST', body:JSON.stringify({token}) }),
  resendVerification: () => request('/api/profile/verification', { method:'POST', body:'{}' }),
  updateProfile: body => request('/api/profile', { method:'PATCH', body:JSON.stringify(body) }),
  changePassword: body => request('/api/profile/password', { method:'POST', body:JSON.stringify(body) }),
  deleteAccount: password => request('/api/profile', { method:'DELETE', body:JSON.stringify({password}) }),
  addresses: () => request('/api/profile/addresses'),
  saveAddress: address => request(address.id?`/api/profile/addresses/${address.id}`:'/api/profile/addresses', { method:address.id?'PUT':'POST', body:JSON.stringify(address) }),
  deleteAddress: id => request(`/api/profile/addresses/${id}`, { method:'DELETE' }),
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
