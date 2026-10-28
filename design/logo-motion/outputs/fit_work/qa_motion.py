from pathlib import Path
import json,io,math
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
url=(root/'logo_motion.html').as_uri();out=root/'outputs';report={}
def pixels(data):return np.array(Image.open(io.BytesIO(data)).convert('RGB')).astype(int)
def curve(x,a=.34,b=0,c=.14,d=1):
 lo,hi=0.,1.
 for _ in range(60):
  t=(lo+hi)/2;v=3*(1-t)**2*t*a+3*(1-t)*t*t*c+t**3
  if v<x:lo=t
  else:hi=t
 t=(lo+hi)/2
 return 3*(1-t)**2*t*b+3*(1-t)*t*t*d+t**3
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page(viewport={'width':900,'height':800},device_scale_factor=2)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def capture(query,path):
  page.goto(url+query);page.wait_for_function('window.__p2mReady === true')
  data=page.locator('#logo-root').screenshot();path.write_bytes(data);return pixels(data)
 static=capture('?static=1',root/'html_render.png')
 final=capture('?t=1800',out/'final_frame.png')
 diff=np.abs(static-final);report['same_pipeline']={'max_channel_delta':int(diff.max()),'different_pixels':int(np.any(diff,axis=2).sum())};assert not diff.any(),report
 zero=capture('?t=0',out/'zero_frame.png');report['initial_ink_pixels']=int((zero.sum(2)<720).sum());assert report['initial_ink_pixels']==0
 # Compare the SVG geometry itself at the same viewport/DPR and presentation width.
 svg=(root/'logo.svg').read_text().replace('width="480" height="480"','width="336" height="336" style="display:block"')
 page.set_content('<html><body style="margin:0;background:#fff"><div id="bare" style="width:336px;height:336px">'+svg+'</div></body></html>')
 bare=pixels(page.locator('#bare').screenshot(path=str(out/'bare_vector.png')))
 vector_diff=np.abs(bare-final);report['vector_vs_animation']={'max_channel_delta':int(vector_diff.max()),'mean_channel_delta':float(vector_diff.mean()),'different_pixels':int(np.any(vector_diff,axis=2).sum())}
 for t in [540,720,900]:
  page.goto(url+f'?t={t}');page.wait_for_function('window.__p2mReady === true')
  actual=float(page.locator('#body-line').evaluate('(e)=>getComputedStyle(e).strokeDashoffset.replace("px","")'))
  fraction=(t-378)/864;expected=1.1*(1-curve(fraction));assert abs(actual-expected)<.00002,(t,actual,expected)
 report['easing_verified_times']=[540,720,900]
 page.emulate_media(reduced_motion='reduce')
 reduced=capture('?t=0',out/'reduced_motion.png');report['reduced_motion_diff']=int(np.any(reduced-static,axis=2).sum());assert np.abs(reduced-static).mean()<.2
 for selector in ['#mark','#tail','#eye-left','#eye-right']:
  assert page.locator(selector).evaluate('(e)=>getComputedStyle(e).transform')=='none'
 report['reduced_motion_mean_channel_delta']=float(np.abs(reduced-static).mean())
 page.goto(url);page.wait_for_function('window.__p2mReady === true')
 page.locator('[data-atom="arc"]').click();assert page.evaluate('document.getAnimations().length')==0
 page.emulate_media(reduced_motion='no-preference');page.goto(url);page.wait_for_function('window.__p2mReady === true')
 before=page.evaluate('heroAnimations()[0].currentTime')
 page.locator('#speedSlider').fill('2');page.locator('#speedSlider').dispatch_event('input')
 page.wait_for_function('heroAnimations().every(a=>a.playbackRate===2)')
 assert page.evaluate('heroAnimations()[0].currentTime')>=before
 page.locator('#btnSlow').click();page.wait_for_function('heroAnimations().every(a=>a.playbackRate===.25)')
 page.locator('#btnReplay').click();assert page.evaluate('heroAnimations()[0].currentTime')<400
 for name in ['hover','pulse','arc','press']:
  page.locator(f'[data-atom="{name}"]').click()
  assert page.locator(f'[data-atom="{name}"] svg').evaluate('(e)=>e.getAnimations({subtree:true}).length')>0
 report['controls']=['live speed','slow toggle','replay','four interactive vector atoms','reduced-motion atoms static']
 # Stop only the hero for deterministic full-page layout evidence; controls remain visible.
 for width,height,name in [(900,800,'desktop'),(390,844,'mobile')]:
  page.set_viewport_size({'width':width,'height':height});page.goto(url);page.wait_for_function('window.__p2mReady === true');page.evaluate('heroAnimations().forEach(a=>a.finish())')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),name
  page.screenshot(path=str(out/f'showcase_{name}.png'),full_page=True)
 assert not errors,errors
 browser.close()
report['page_errors']=errors
(out/'qa_report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
