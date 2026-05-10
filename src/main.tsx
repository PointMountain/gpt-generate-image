import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './styles/tokens.css';
import './styles/global.css';

function clearRestoredFormFocus() {
  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLSelectElement
  ) {
    activeElement.blur();
  }
}

function resetInitialScroll() {
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  clearRestoredFormFocus();
  window.scrollTo(0, 0);
  window.requestAnimationFrame(() => {
    clearRestoredFormFocus();
    window.scrollTo(0, 0);
  });
  window.setTimeout(() => {
    clearRestoredFormFocus();
    window.scrollTo(0, 0);
  }, 120);
}

resetInitialScroll();
window.addEventListener('pageshow', resetInitialScroll);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
