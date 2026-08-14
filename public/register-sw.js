if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Falha silenciosa: o app funciona normalmente sem o service worker,
      // só o prompt de instalação em alguns Androids pode não aparecer.
    });
  });
}
