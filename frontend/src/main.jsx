import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global authed-fetch wrapper: attaches the JWT to every /api/* call (except the
// login endpoint) so all pages using raw fetch('/api/...') are authenticated in
// one place. On a 401 it clears the stale session and reloads to the login screen.
const originalFetch = window.fetch.bind(window)
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input && input.url) || ''
  const isApi = url.startsWith('/api/')
  const isLogin = url.startsWith('/api/auth/login')
  const token = localStorage.getItem('genie_ai_token')

  let options = init
  if (isApi && !isLogin && token) {
    const headers = new Headers((input && input.headers) || init.headers || {})
    headers.set('Authorization', `Bearer ${token}`)
    options = { ...init, headers }
  }

  const response = await originalFetch(input, options)

  if (isApi && !isLogin && response.status === 401) {
    localStorage.removeItem('genie_ai_token')
    localStorage.removeItem('genie_ai_user')
    window.location.reload()
  }

  return response
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
