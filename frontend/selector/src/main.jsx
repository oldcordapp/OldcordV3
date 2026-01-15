import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';

import '@oldcord/frontend-shared/fonts.css';
import '@oldcord/frontend-shared/index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
