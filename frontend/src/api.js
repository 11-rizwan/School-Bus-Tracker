const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = response.status === 204 ? null : await response.json().catch(() => ({}));

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    if (typeof data?.detail === 'string') {
      message = data.detail;
    } else if (Array.isArray(data?.detail)) {
      message = data.detail
        .map((item) => {
          const loc = Array.isArray(item.loc)
            ? item.loc.filter((part) => part !== 'body').join('.')
            : '';
          return loc ? `${loc}: ${item.msg}` : (item.msg || JSON.stringify(item));
        })
        .join('; ');
    } else if (data?.message) {
      message = data.message;
    }
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}
