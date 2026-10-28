import { readFile } from 'node:fs/promises';

// Keep the approved preview and bundled startup animation on the same vector and timing.
export async function launchHTML() {
  const source = new URL('../../../design/logo-motion/', import.meta.url);
  const [svg, motion] = await Promise.all([
    readFile(new URL('logo.svg', source), 'utf8'),
    readFile(new URL('motion.css', source), 'utf8'),
  ]);
  return `<!doctype html>
<html lang="zh-CN" data-reduced="false"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Tidemark</title><style>
${motion}
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;background:#fff;color:#222}
body{display:grid;place-items:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;user-select:none}
main{display:flex;flex-direction:column;align-items:center;gap:22px;transform:translateY(-12px)}
#logo-root{position:relative;width:144px;height:156px;overflow:visible}
#logo-root svg{position:absolute;display:block;width:330px;height:330px;left:-85px;top:-95px;overflow:visible}
h1{margin:0;font-size:34px;line-height:1.2;letter-spacing:-1px;font-weight:500;animation:launch-title 1100ms 400ms both}
p{margin:0;color:#888;font-size:12px;letter-spacing:2px;animation:launch-title 900ms 750ms both}
@keyframes launch-title{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
html[data-reduced="true"] *,html[data-reduced="true"] #logo-root *{animation:none!important;stroke-dashoffset:0!important}
@media(prefers-reduced-motion:reduce){*,#logo-root *{animation:none!important;stroke-dashoffset:0!important}}
</style></head><body><main aria-label="Tidemark 正在启动">
<div id="logo-root">${svg}</div>
<h1>Tidemark</h1><p>写下此刻，留下潮痕。</p>
</main></body></html>`;
}
