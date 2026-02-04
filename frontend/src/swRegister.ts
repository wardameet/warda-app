export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(reg => {
          console.log('✅ Warda SW registered:', reg.scope);
          // Check for updates every 30 minutes
          setInterval(() => reg.update(), 30 * 60 * 1000);
        })
        .catch(err => console.log('SW registration failed:', err));
    });
  }
}
