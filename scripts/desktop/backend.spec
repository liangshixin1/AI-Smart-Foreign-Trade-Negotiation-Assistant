# Explicit paths work on Windows even when PyInstaller's build directory changes.
import os
from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules

root = Path(SPECPATH).resolve().parents[1]
# Public builds carry runtime content only, never reference art or generation logs.
public = os.environ.get("NEGOTIATION_PUBLIC_BUILD") == "1"
content_data = [
    (str(file), str(file.parent.relative_to(root)))
    for file in (root / "content").rglob("*")
    if file.is_file() and not file.is_symlink()
    and not (public and "assets" in file.relative_to(root / "content").parts)
]
a = Analysis(
    [str(root / "scripts/desktop/backend_entry.py")],
    pathex=[str(root / "apps/api")],
    binaries=[],
    datas=content_data + [
           (str(root / "apps/web/dist"), "apps/web/dist"),
           (str(root / "apps/api/alembic"), "apps/api/alembic")],
    hiddenimports=collect_submodules("app") + collect_submodules("uvicorn"),
    hookspath=[], runtime_hooks=[], excludes=["app.main"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="negotiation-backend",
          debug=False, bootloader_ignore_signals=False, strip=False, upx=False,
          console=True)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name="negotiation-backend")
