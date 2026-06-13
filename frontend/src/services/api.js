
import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Inject JWT token
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Refresh on 401
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if error is 401 and we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/refresh') && !originalRequest.url.includes('/auth/login')) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        // No refresh token, force logout
        handleLogoutRedirect();
        return Promise.reject(error);
      }

      try {
        // Attempt to refresh token
        // Use a clean axios instance to avoid looping interceptors
        const res = await axios.post(`${API.defaults.baseURL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = res.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        // Update authorization header and retry original request
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return API(originalRequest);
      } catch (refreshErr) {
        console.error('Refresh token failed:', refreshErr);
        handleLogoutRedirect();
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

function handleLogoutRedirect() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  
  // Only redirect if we are not already on the login or register page
  if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
    window.location.href = '/login';
  }
}

export default API;
