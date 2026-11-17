#!/usr/bin/env python3
"""Rebuild real React Native components using an isolated temporary copy; no installs."""
from pathlib import Path
import tempfile,shutil,os,json,subprocess,sys
here=Path(__file__).resolve().parent
source=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else here.parents[1]
work=Path(tempfile.mkdtemp(prefix='openim-offline-build-'))
for name in ['package.json','babel.config.cjs','src','lib']:
 p=source/name
 if p.is_dir():shutil.copytree(p,work/name)
 else:shutil.copy2(p,work/name)
shutil.copytree(source/'example',work/'example',ignore=shutil.ignore_patterns('node_modules','android','ios','dist','offline-dist','.expo','.env*'))
for name in ['node_modules','example/node_modules']:(work/name).symlink_to(source/name,target_is_directory=True)
for name,content in json.loads((here/'offline-patches.json').read_text()).items():
 content=content.replace('/Users/czzz/work/kson/code/github/IM/react-native-chat',str(source))
 (work/name).write_text(content)
(work/'example/app/explore.tsx').unlink(missing_ok=True)
env={**os.environ,'EXPO_PUBLIC_OPENIM_EMAIL_VERIFICATION_ENABLED':'true','EXPO_NO_TELEMETRY':'1'}
subprocess.run(['node','node_modules/expo/bin/cli','export','--platform','web','--output-dir','offline-dist'],cwd=work/'example',env=env,check=True)
subprocess.run([sys.executable,str(here/'inline.py'),str(work/'example/offline-dist')],check=True)
shutil.copy2(work/'example/offline-dist/openim-product-demo.html',here/'openim-product-demo.html')
print('Built',here/'openim-product-demo.html','from',work)
