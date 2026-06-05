import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Attach Bearer token automatically
api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401: clear session and reload
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && err.config?.url !== '/auth/me' && err.config?.url !== '/auth/verify-otp' && err.config?.url !== '/auth/request-otp') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

export default api
