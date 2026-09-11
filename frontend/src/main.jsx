import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// API authentication uses an HttpOnly same-site cookie. Always include
// credentials and clear only the non-secret UI identity cache on a stale session.
const originalFetch = window.fetch.bind(window)
const readCookie = (name) => document.cookie
  .split('; ')
  .find((item) => item.startsWith(`${name}=`))
  ?.slice(name.length + 1) || ''

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input && input.url) || ''
  const isApi = url.startsWith('/api/')
  const isLogin = url.startsWith('/api/auth/login')
  const method = String(init.method || 'GET').toUpperCase()
  const isUnsafe = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const headers = new Headers(init.headers || {})
  const csrf = readCookie('genieai_csrf')
  if (isApi && isUnsafe && !isLogin && csrf) {
    headers.set('X-CSRF-Token', csrf)
  }
  const options = isApi ? { ...init, credentials: 'include', headers } : init

  const response = await originalFetch(input, options)

  const isSessionProbe = url.startsWith('/api/auth/session') || url.startsWith('/api/auth/providers')
  if (isApi && !isLogin && !isSessionProbe && !url.startsWith('/api/webhooks/') && response.status === 401) {
    ;[localStorage, sessionStorage].forEach((storage) => {
      storage.removeItem('genie_ai_token')
      storage.removeItem('genie_ai_user')
    })
    window.location.reload()
  }

  return response
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
