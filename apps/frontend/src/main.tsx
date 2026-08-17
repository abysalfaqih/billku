import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Font Inter, self-hosted lewat @fontsource (dulu dimuat otomatis oleh
// next/font/google). Bobot yang dimuat mengikuti seluruh fontWeight yang
// dipakai di aplikasi ini (400/500/600/700/800/900).
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';

import './index.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
