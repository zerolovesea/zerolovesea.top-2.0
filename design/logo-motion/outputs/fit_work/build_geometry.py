from pathlib import Path
import json
root=Path(__file__).resolve().parents[2]
params={
 'stroke':'#444b54','fill':'#d3d8dd','width':5.8,
 'body':'M139 214 C126 214 117 207 121 192 L143 94 C155 108 168 108 178 94 L201 193 C205 205 197 214 184 214',
 'tail':'M107 202 L97 199.5 C82 195 81 214 94 214 L139 214',
 'tailFill':'M107 202 L127 207 L139 214 H94 C81 214 82 195 97 199.5 Z',
 'left':'M139 164 L148 207 C150 217 161 216 161 207',
 'right':'M182 164 L174 207 C172 217 161 216 161 207',
}
(root/'outputs/fit_work/parameters.json').write_text(json.dumps(params,indent=2))
p=params
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 300 300" role="img" aria-labelledby="logo-title">
<title id="logo-title">zerolovesea cat</title>
<g id="mark" stroke="{p['stroke']}" stroke-width="{p['width']}" stroke-linecap="round" stroke-linejoin="round">
 <g id="tail"><path id="tail-fill" fill="{p['fill']}" stroke="none" d="{p['tailFill']}"/><path id="tail-line" fill="none" pathLength="1" d="{p['tail']}"/></g>
 <g id="body"><path id="body-fill" stroke="none" fill="{p['fill']}" d="{p['body']} Z"/><path id="body-line" fill="none" pathLength="1" d="{p['body']}"/></g>
 <path id="leg-left" fill="none" pathLength="1" d="{p['left']}"/>
 <path id="leg-right" fill="none" pathLength="1" d="{p['right']}"/>
 <path id="chest" fill="none" pathLength="1" d="M161 174 L161 207"/>
 <g id="face" fill="{p['stroke']}" stroke="none"><circle id="eye-left" cx="151" cy="124" r="3"/><circle id="eye-right" cx="171" cy="124" r="3"/></g>
</g>
</svg>'''
(root/'logo.svg').write_text(svg)
