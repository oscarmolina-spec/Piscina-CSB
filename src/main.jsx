import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 1. Arrancamos la web primero (Prioridad absoluta)
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 2. Registramos la App como PWA después (Sin bloquear nada)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('🚀 App: Lista para instalar'))
      .catch((err) => console.log('❌ App: Error de registro', err));
  });
}