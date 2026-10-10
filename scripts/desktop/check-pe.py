"""Verify both binaries actually target AMD64, not merely named x64."""

import struct
import sys
from pathlib import Path

for name in sys.argv[1:]:
    data = Path(name).read_bytes()
    assert data[:2] == b"MZ", "Not a PE file"
    offset = struct.unpack_from("<I", data, 0x3C)[0]
    assert data[offset : offset + 4] == b"PE\0\0", "Invalid PE header"
    machine = struct.unpack_from("<H", data, offset + 4)[0]
    assert machine == 0x8664, f"Expected AMD64, got {machine:#x}"
    print(Path(name).name, "AMD64 verified")
