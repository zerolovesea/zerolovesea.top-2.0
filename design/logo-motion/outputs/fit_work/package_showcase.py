from pathlib import Path
import re
root=Path(__file__).resolve().parents[2]
p=root/'logo_motion.html';s=p.read_text()
s=s.replace('<html lang="en">','<html lang="zh-CN">').replace('--accent: #e64036;','--accent: #444b54;').replace('--text-tertiary: #aaa;','--text-tertiary: #666;')
s=s.replace('value="0.45"','value="1"').replace('0.45x','1.00x').replace('let playbackRate = 0.45','let playbackRate = 1').replace('setPlaybackRate(0.45, false)','setPlaybackRate(1, false)').replace('slow ? 0.45 : 0.25','slow ? 1 : 0.25')
s=s.replace('id="logo-root" aria-label="Animated logo"','id="logo-root" role="button" tabindex="0" aria-label="重播猫咪动画"')
s=s.replace('<main id="logo-root"','<div id="logo-root"').replace('data-p2m-duration="1800"></main>','data-p2m-duration="1800"></div>')
s=s.replace('<div class="atom" data-atom=', '<button type="button" class="atom" data-atom=')
s=re.sub(r'(<span class="atom-label">[^<]+</span>)</div>',r'\1</button>',s)
labels={'Hover':'轻抬','Pulse':'呼吸','Arc':'摆尾','Press':'轻按','Squash &amp; stretch':'柔性形变','Anticipation':'预备','Staging':'分层呈现','Follow through':'余势','Overlapping':'错峰','Slow in / out':'缓入缓出','Secondary action':'辅助动作','Timing':'节奏','Appeal':'亲和'}
for a,b in labels.items():s=s.replace('>'+a+'<','>'+b+'<')
s=s.replace('>Replay<','>重播<').replace('>Slow motion<','>慢动作<').replace('>Speed<','>速度<').replace('aria-label="Animation speed"','aria-label="动画速度"')
s=s.replace('slow ? "Normal speed" : "Slow motion"','slow ? "正常速度" : "慢动作"')
s=s.replace('Click the main logo to replay | Drag speed | Try atomic motions','点击猫咪重播 · 调节速度 · 悬停或点按下方动作')
s=s.replace('font: 12px/1.2 inherit;','font: inherit;\n      font-size:12px;')
s=s.replace('    .atom-stage img {','    .atom-stage svg {').replace('width: 74px;','width: 104px;').replace('height: 74px;','height: 94px;')
s=s.replace('    .atom {','    .atom {\n      border:0; padding:8px; background:#f7f7f7; border-radius:6px;')
s=s.replace('    .pill.active {','    :focus-visible {outline:2px solid #444b54;outline-offset:5px;}\n    .pill.active {')
s=s.replace('      gap: 2rem;','      gap: 1.5rem;')
start=s.index('    function setupAtomImages()');end=s.index('    function applyQaMode()',start)
s=s[:start]+'''    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    function setupAtomImages() {
      document.querySelectorAll('.atom').forEach(button => {
        const svg = createSvgNode(LOGO), prefix = 'atom-' + button.dataset.atom + '-';
        svg.querySelectorAll('[id]').forEach(node => node.id = prefix + node.id);
        svg.setAttribute('aria-labelledby', prefix + 'logo-title');
        svg.removeAttribute('width');svg.removeAttribute('height');
        button.querySelector('.atom-stage').append(svg);
      });
    }
    function setupAtoms() {
      function play(button) {
        if(reduced.matches)return;
        const kind=button.dataset.atom, svg=button.querySelector('svg');
        const node=svg.querySelector('[id$="'+(kind==='arc'?'tail':'mark')+'"]');
        node.getAnimations().forEach(a=>a.cancel());
        node.style.transformBox=kind==='arc'?'view-box':'fill-box';
        node.style.transformOrigin=kind==='arc'?'139px 214px':'center bottom';
        const frames={
          hover:['none','translateY(-4px) scale(1.02)','none'],
          pulse:['scale(1)','scale(1.025)','scale(1)'],
          arc:['rotate(0deg)','rotate(-5deg)','rotate(1.5deg)','rotate(0deg)'],
          press:['scale(1)','scale(1.035,.965)','scale(.995,1.005)','scale(1)']
        }[kind].map(transform=>({transform}));
        node.animate(frames,{duration:{hover:600,pulse:3200,arc:950,press:550}[kind],easing:'cubic-bezier(.4,0,.2,1)'});
        flashPills(kind==='arc'?'arc':kind==='press'?'squashstretch':'appeal');
      }
      document.querySelectorAll('.atom').forEach(button=>{
        button.addEventListener('pointerenter',()=>play(button));
        button.addEventListener('focus',()=>play(button));
        button.addEventListener('click',()=>play(button));
      });
    }

'''+s[end:]
s=s.replace('    document.getElementById("btnReplay").addEventListener', '''    document.getElementById('logo-root').addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();replayMain();}
    });
    document.getElementById("btnReplay").addEventListener''')
# Keep the template QA hook; write an accessible, neutral showcase from the generated SVG DOM.

p.write_text(s)
