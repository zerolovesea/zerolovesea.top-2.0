const files = new Set(['logo_motion.html', 'logo.svg', 'motion.css', 'final_render.png', 'motion_spec.md']);
const server = Bun.serve({
  hostname: '127.0.0.1', port: 4355,
  fetch(request) {
    const name = new URL(request.url).pathname.slice(1) || 'logo_motion.html';
    if (!['GET', 'HEAD'].includes(request.method) || !files.has(name)) return new Response('Not found', { status: 404 });
    return new Response(Bun.file(new URL(name, import.meta.url)), { headers: { 'Cache-Control': 'no-store' } });
  },
});
console.log(`logo motion → ${server.url}logo_motion.html`);
