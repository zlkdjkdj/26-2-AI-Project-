#!/usr/bin/env python3
"""Start both local MVP servers independently of the chat terminal."""
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
RUNTIME = ROOT / '.run'
SERVICES = {
    'backend': {'cwd': ROOT / 'backend', 'command': [str(ROOT / 'backend/.venv/bin/python'), '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000'], 'url': 'http://localhost:8000/api/health'},
    'frontend': {'cwd': ROOT / 'frontend', 'command': ['npm', 'run', 'dev'], 'url': 'http://localhost:5173'},
}

def marker(name):
    return RUNTIME / f'{name}.json'

def start_stamp(pid):
    try:
        # Linux /proc identity prevents signalling an unrelated process after PID reuse.
        return Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()[19]
    except (OSError, IndexError):
        return None

def managed_pid(name):
    try:
        info = json.loads(marker(name).read_text())
        if info['start_stamp'] is not None and start_stamp(info['pid']) == info['start_stamp']:
            return info['pid']
    except (OSError, KeyError, ValueError):
        pass
    return None

def reachable(url):
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return response.status == 200
    except Exception:
        return False

def start():
    if not Path(SERVICES['backend']['command'][0]).exists() or not (ROOT / 'frontend/node_modules').exists():
        print('Dependencies are missing. Follow the installation section in README.md.', file=sys.stderr)
        return 1
    RUNTIME.mkdir(exist_ok=True)
    started = []
    for name, service in SERVICES.items():
        if reachable(service['url']):
            print(f"{name}: already running at {service['url']}")
            continue
        if managed_pid(name):
            print(f'{name}: managed process exists but is unresponsive. Run stop, then start.', file=sys.stderr)
            return 1
        with (RUNTIME / f'{name}.log').open('ab') as log:
            process = subprocess.Popen(service['command'], cwd=service['cwd'], stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
        stamp = start_stamp(process.pid)
        marker(name).write_text(json.dumps({'pid': process.pid, 'start_stamp': stamp}))
        started.append(name)
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        if all(reachable(service['url']) for service in SERVICES.values()):
            print('Ready: http://localhost:5173 | API: http://localhost:8000/docs')
            return 0
        time.sleep(.3)
    print('A server did not start. Inspect .run/backend.log and .run/frontend.log.', file=sys.stderr)
    # Roll back only processes this invocation created.
    for name in started:
        stop_one(name)
    return 1

def stop_one(name):
    pid = managed_pid(name)
    if pid is not None:
        try:
            os.killpg(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        print(f'{name}: stopped')
    else:
        print(f'{name}: no managed process')
    marker(name).unlink(missing_ok=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['start', 'stop', 'status'])
    action = parser.parse_args().action
    if action == 'start':
        return start()
    if action == 'stop':
        for name in SERVICES:
            stop_one(name)
        return 0
    for name, service in SERVICES.items():
        print(f"{name}: {'running' if reachable(service['url']) else 'offline'} ({service['url']})")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
