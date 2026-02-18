import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
// 🚩 AÑADE ESTO JUSTO AQUÍ DEBAJO:
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('🚀 App: Service Worker registrado', reg.scope))
      .catch(err => console.log('❌ App: Error al registrar SW', err));
  });
}
