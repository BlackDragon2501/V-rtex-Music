import os
import sys

SKIP_DIRS = {"node_modules", ".next", "download"}
SKIP_FILES = {"dev.log", "server.log", "nohup.out"}
ORIG = "/home/z/my-project"
COPIA = "/home/z/my-project/download/vortex-music-copia"


def walk(root):
    files = {}
    for r, ds, fs in os.walk(root):
        ds[:] = [d for d in ds if d not in SKIP_DIRS]
        for f in fs:
            if f in SKIP_FILES:
                continue
            p = os.path.join(r, f)
            rel = os.path.relpath(p, root)
            files[rel] = os.path.getsize(p)
    return files


orig = walk(ORIG)
copia = walk(COPIA)

missing = sorted(set(orig) - set(copia))
extra = sorted(set(copia) - set(orig) - {"LEEME.md"})
print(f"Original: {len(orig)} archivos")
print(f"Copia:    {len(copia)} archivos")
print(f"Faltan en la copia: {len(missing)} {missing[:10] if missing else '(ninguno)'}")
print(f"Extra en la copia:  {len(extra)} {extra if extra else '(solo LEEME.md esperado)'}")

diff = [f for f in orig if f in copia and orig[f] != copia[f]]
print(f"Tamanos distintos: {len(diff)} {diff[:10] if diff else '(todos identicos)'}")

key = [
    ".env",
    "bun.lock",
    "package.json",
    "db/custom.db",
    ".git/HEAD",
    "src/lib/music/rotation.ts",
    "src/lib/music/genres.ts",
    "src/lib/music/jamendo.ts",
    "src/app/api/music/genre/route.ts",
    "src/app/api/music/home/route.ts",
    "src/app/api/music/search/route.ts",
    "src/components/music/BackButton.tsx",
    "src/app/page.tsx",
    "LEEME.md",
]
for k in key:
    print(("OK    " if k in copia else "FALTA ") + k)

env_path = os.path.join(COPIA, ".env")
with open(env_path, "r", encoding="utf-8") as fh:
    env_txt = fh.read()
print("JAMENDO_CLIENT_ID en .env de la copia:", "SI" if "JAMENDO_CLIENT_ID" in env_txt else "NO")

sys.exit(0 if not missing and not diff else 1)
