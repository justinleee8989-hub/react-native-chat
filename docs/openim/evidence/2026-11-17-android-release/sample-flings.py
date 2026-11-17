import subprocess, pathlib, re, json, sys, time
adb=['/Users/czzz/Library/Android/sdk/platform-tools/adb','-s','ca0839ec']
label=sys.argv[1]
out=pathlib.Path('/tmp/im-release-performance')/label;out.mkdir(parents=True,exist_ok=True)
def run(*args):return subprocess.check_output(adb+list(args))
state=run('shell','dumpsys','activity','activities').decode()
if not re.search(r'(?:topResumedActivity=|ResumedActivity:).*com\.anonymous\.example',state):raise RuntimeError('QA app is not foreground')
run('shell','dumpsys','gfxinfo','com.anonymous.example','reset')
gestures = ([(650,2300),(2300,650)] * 20) if 'sustained' in label else [(650,2300)]*5+[(2300,650)]*5
for a,b in gestures:
 run('shell','input','swipe','700',str(a),'700',str(b),'100')
 if 'sustained' in label: time.sleep(0.25)
stats=run('shell','dumpsys','gfxinfo','com.anonymous.example').decode();(out/'gfx.txt').write_text(stats)
(out/'final.png').write_bytes(run('exec-out','screencap','-p'))
for line in stats.splitlines():
 if re.match(r'(Total frames rendered:|Janky frames:|\d+th percentile:)',line):print(line)
