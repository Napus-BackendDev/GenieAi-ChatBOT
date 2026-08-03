import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// API authentication uses an HttpOnly same-site cookie. Always include
// credentials and clear only the non-secret UI identity cache on a stale session.
const originalFetch = window.fetch.bind(window)
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input && input.url) || ''
  const isApi = url.startsWith('/api/')
  const isLogin = url.startsWith('/api/auth/login')
  const options = isApi ? { ...init, credentials: 'include' } : init

  const response = await originalFetch(input, options)

  if (isApi && !isLogin && response.status === 401) {
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
