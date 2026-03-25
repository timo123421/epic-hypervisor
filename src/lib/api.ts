const BASE_URL = '/api';

export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('nova_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  
  if (!res.ok) {
    let errMessage = 'API request failed';
    try {
      const err = await res.json();
      errMessage = err.error || errMessage;
    } catch (e) {
      // Ignore JSON parse error if response is not JSON
    }
    throw new Error(errMessage);
  }
  
  return res.json();
};
