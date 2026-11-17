from pathlib import Path
import re,json,base64,mimetypes
import sys
root=Path(sys.argv[1])
html=(root/'index.html').read_text().replace('<head>', '''<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; media-src data: blob:; connect-src data: blob:; worker-src blob:; base-uri 'none'; form-action 'none'">''')
assets={}
for p in (root/'assets').rglob('*'):
 if p.is_file(): assets['/'+p.relative_to(root).as_posix()]='data:'+('font/ttf' if p.suffix=='.ttf' else mimetypes.guess_type(p.name)[0] or 'application/octet-stream')+';base64,'+base64.b64encode(p.read_bytes()).decode()
js={}
for p in (root/'_expo/static/js/web').glob('*.js'):
 s=p.read_text().replace('window.location', 'window.__offlineLocation')
 for path,data in assets.items(): s=s.replace(json.dumps(path),json.dumps(data)).replace("'"+path+"'",json.dumps(data))
 js['/'+p.relative_to(root).as_posix()]=s
scripts=re.findall(r'<script src="([^"]+)" defer></script>',html)
html=re.sub(r'<script src="[^"]+" defer></script>','',html)
html=re.sub(r'<link[^>]+>','',html)
css='\n'.join(p.read_text() for p in (root/'_expo/static/css').glob('*.css'))
html=html.replace('</head>','<style>'+css+'</style></head>')
# All executable chunks and assets are embedded. The loader rewrites only Metro resource URLs.
bootstrap="""
Object.defineProperty(window,'__offlineLocation',{get(){return new URL((location.hash.slice(1)||'/'), 'http://offline.local')}});
const sources=JS_SOURCES;
const chunks={}; for(const [path,src] of Object.entries(sources)) chunks[path]=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
const mapURL=value=>{try{return chunks[new URL(value,location.href).pathname]||value}catch{return value}};
const desc=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'src'); Object.defineProperty(HTMLScriptElement.prototype,'src',{get:desc.get,set(value){desc.set.call(this,mapURL(value))}});
const originalSet=Element.prototype.setAttribute;Element.prototype.setAttribute=function(k,v){return originalSet.call(this,k,this.tagName==='SCRIPT'&&k==='src'?mapURL(v):v)};
const originalPush=history.pushState.bind(history),originalReplace=history.replaceState.bind(history);
history.pushState=(s,t,u)=>originalPush(s,t,location.pathname+'#'+u);history.replaceState=(s,t,u)=>originalReplace(s,t,location.pathname+'#'+u);
(async()=>{for(const path of INITIAL_SCRIPTS){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=chunks[path];s.onload=resolve;s.onerror=reject;document.body.appendChild(s)})}})();
""".replace('JS_SOURCES',json.dumps(js,ensure_ascii=True).replace('<', '\\u003c')).replace('INITIAL_SCRIPTS',json.dumps(scripts))
html=html.replace('</body>','<script>'+bootstrap.replace('</script','<\\/script')+'</script></body>')
html=html.replace('<title>example</title>','<title>OpenIM · 原版组件离线演示</title>')
(root/'openim-product-demo.html').write_text(html)
print('HTML bytes',len(html.encode()),'chunks',len(js),'assets',len(assets))
