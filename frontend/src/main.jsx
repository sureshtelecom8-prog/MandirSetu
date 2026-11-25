import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
createRoot(document.getElementById('root')).render(<StrictMode>
    <div className="min-h-screen min-w-0 bg-[#f7f6f2] font-sans text-[#24251f] antialiased">
      <App />
    </div>
  </StrictMode>);
