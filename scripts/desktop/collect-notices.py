"""Collect verbatim installed dependency license notices; never inspect user data."""
import argparse
import importlib.metadata
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--frontend', action='store_true')
args = parser.parse_args()
output = root / ('docs/handoff/windows-public/FRONTEND-NOTICES.txt' if args.frontend else 'build/public-notices/THIRD-PARTY-NOTICES.txt')
output.parent.mkdir(parents=True, exist_ok=True)
parts = ['Third-party notices. Upstream license texts apply to their respective components.\n']
if args.frontend:
    seen = set()
    def visit(folder):
        folder = folder.resolve()
        if folder in seen: return
        seen.add(folder)
        manifest = folder / 'package.json'
        if not manifest.exists(): return
        data = json.loads(manifest.read_text(encoding='utf-8'))
        parts.append(f"\n=== {data.get('name')} {data.get('version')} | {data.get('license', 'See upstream')} ===\n")
        for file in sorted(folder.iterdir()):
            if file.is_file() and file.name.lower().startswith(('license','licence','copying','notice')):
                parts.append(file.read_text(encoding='utf-8', errors='replace'))
        for name in data.get('dependencies', {}):
            for parent in [folder, *folder.parents]:
                candidate = parent / 'node_modules' / name
                if candidate.exists():
                    visit(candidate); break
    visit(root / 'apps/web')
else:
    parts.append((root / 'LICENSE').read_text(encoding='utf-8'))
    parts.append((root / 'docs/handoff/windows-public/FRONTEND-NOTICES.txt').read_text(encoding='utf-8'))
    for dist in sorted(importlib.metadata.distributions(), key=lambda d: d.metadata['Name'] or ''):
        parts.append(f"\n=== {dist.metadata['Name']} {dist.version} ===\n")
        for file in dist.files or []:
            if any(x in str(file).lower() for x in ('license','licence','copying','notice')):
                actual = dist.locate_file(file)
                if actual.is_file(): parts.append(actual.read_text(encoding='utf-8', errors='replace'))
    for name in ['LICENSE','LICENSES.chromium.html']:
        file = root / 'desktop/node_modules/electron/dist' / name
        if not file.exists(): raise RuntimeError('Electron license missing')
        parts.append(file.read_text(encoding='utf-8', errors='replace'))
output.write_text('\n'.join(line.rstrip() for line in '\n'.join(parts).splitlines()) + '\n', encoding='utf-8')
print(f'Notices written: {output.name}')
