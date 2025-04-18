import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import 'normalize.css'; //CSS reset
import { registerElements } from 'genesys-spark-components';
import './configs/i18n';

registerElements();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div>Loading i18n</div>}>
      <App />
    </Suspense>
  </React.StrictMode>
)