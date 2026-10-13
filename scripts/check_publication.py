#!/usr/bin/env python3
"""Read-only Git publication checks; prints file locations, never secret values.

Without a repository, use a temporary empty Git directory to evaluate .gitignore.
This checks the current working tree, not past commits or all possible secrets.
"""
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent
PATTERNS = {
    'Google API key': rb'AIza[0-9A-Za-z_-]{35}',
    'OpenAI-style API key': rb'\bsk-(?:proj-|svcacct-)?[0-9A-Za-z_-]{32,}',
    'GitHub token': rb'\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})',
    'AWS access key': rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
    'private key': rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----',
    'JPEG EXIF metadata (review private location/device tags)': rb'\xff\xe1[\s\S]{2}Exif\x00\x00',
    'credential URL': rb'\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://[^\s/@:]+:[^\s/@]+@',
}


def git(args, env):
    return subprocess.run(['git', *args], cwd=ROOT, env=env, capture_output=True, check=True).stdout


def local_secret_values():
    # Check known local credentials even when their format is not recognized.
    values = set()
    for directory in (ROOT, ROOT/'backend', ROOT/'frontend'):
        for file in directory.glob('.env*'):
            if file.name.endswith('.example') or not file.is_file():
                continue
            for line in file.read_text(errors='replace').splitlines():
                match = re.match(r'(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)', line.strip())
                if not match or not re.search(r'(?:API_KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL)$', match[1]):
                    continue
                value = match[2].strip().strip('\"\'')
                if len(value) >= 12 and not value.startswith('#'):
                    values.add(value.encode())
    return values


def check(env, has_repo):
    names = sorted(set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], env).decode().split('\0')) - {''})
    violations = []
    secrets = local_secret_values()
    if has_repo:
        tracked = git(['ls-files', '-z', '--cached'], env)
        if tracked:
            ignored = subprocess.run(['git', 'check-ignore', '--no-index', '-z', '--stdin'], cwd=ROOT, env=env, input=tracked, capture_output=True)
            if ignored.returncode not in (0, 1):
                raise RuntimeError('Cannot check tracked exclusions')
            violations.extend((name, 'tracked but excluded: remove from index before upload') for name in ignored.stdout.decode().split('\0') if name)
    for name in names:
        path = ROOT/name
        if path.is_symlink():
            violations.append((name, 'symlink: review target before publishing'))
            continue
        if not path.is_file():
            continue
        if path.stat().st_size > 10_000_000:
            violations.append((name, 'over 10 MB: content not scanned; review or exclude'))
            continue
        content = path.read_bytes()
        for label, pattern in PATTERNS.items():
            if re.search(pattern, content):
                violations.append((name, label))
        if any(value in content for value in secrets):
            violations.append((name, 'matches a local credential value'))
    print(f'Publication candidates: {len(names)} files')
    print('Repository history: not checked' if has_repo else 'No repository: .gitignore checked using temporary Git metadata')
    for name, reason in violations:
        print(f'BLOCK: {name} — {reason}')
    if not violations:
        print('PASS: no matching credentials or unreviewed large files in publication candidates')
    print('Scope: current files only; regex checks cannot guarantee absence of every secret.')
    return bool(violations)


def main():
    probe = subprocess.run(['git', 'rev-parse', '--show-toplevel'], cwd=ROOT, capture_output=True)
    if probe.returncode == 0:
        if Path(probe.stdout.decode().strip()).resolve() != ROOT:
            raise SystemExit('Project is inside another repository; check that repository separately.')
        return check(os.environ.copy(), True)
    with tempfile.TemporaryDirectory(prefix='atchacha-git-check-') as temporary:
        env = os.environ.copy()
        env.update(GIT_DIR=temporary, GIT_WORK_TREE=str(ROOT))
        git(['init', '--quiet'], env)
        return check(env, False)


if __name__ == '__main__':
    raise SystemExit(main())
