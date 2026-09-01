import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';

createApp(App).mount('#app');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
      const announceUpdate = () => {
        window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: registration }));
      };

      if (registration.waiting) announceUpdate();

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) announceUpdate();
        });
      });

      window.addEventListener('pwa-apply-update', () => {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
      });
    }).catch(() => {
      // Silent fallback when service worker registration is unavailable.
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
