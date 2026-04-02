import './buffer-polyfill';
import { Fragment } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './app/App.tsx';
import './styles/index.css';

const pdfExport =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pdfExport') === '1';

createRoot(document.getElementById('root')!).render(
  <Fragment>
    <App />
    {!pdfExport ? <Toaster richColors position="top-center" /> : null}
  </Fragment>,
);
  