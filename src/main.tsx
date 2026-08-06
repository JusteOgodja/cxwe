import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { initMonitoring } from './lib/monitoring';

// No-op tant que VITE_MONITORING_DSN n'est pas défini (activation = action manuelle).
initMonitoring();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
