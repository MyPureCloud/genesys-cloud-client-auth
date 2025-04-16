import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { registerElements } from 'genesys-spark-components';
import './configs/i18n';

registerElements();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div>Loading i18n</div>}>
      <App />
    </Suspense>
  </React.StrictMode>,
);
