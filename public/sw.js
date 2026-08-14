// Service worker mínimo — não faz cache agressivo de nada (o app depende de
// dados sempre atualizados do servidor). Ele existe principalmente porque o
// Chrome/Android exige um service worker ativo para oferecer o prompt de
// "Adicionar à tela inicial" com o ícone e nome corretos.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

// Passa direto pro servidor — sem cache offline por enquanto, já que os
// dados financeiros precisam sempre estar atualizados.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
