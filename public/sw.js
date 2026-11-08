const VERSION='wagner-noronha-4-3-saude-2026-11-08';
const PRECACHE=['/','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/brand/logo-wagner.png','/brand/wagner-hero-v42.jpg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const req=event.request; const url=new URL(req.url); if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/media/'))return;
  if(req.mode==='navigate'){event.respondWith(fetch(req).catch(()=>caches.match('/')));return;}
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{if(res.ok&&url.pathname.match(/\.(?:js|css|png|jpg|jpeg|webp|svg|woff2)$/i)){const c=res.clone();caches.open(VERSION).then(cache=>cache.put(req,c));}return res;})));
});
