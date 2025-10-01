import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@oldcord/frontend-shared/fonts.css'
import '@oldcord/frontend-shared/index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
