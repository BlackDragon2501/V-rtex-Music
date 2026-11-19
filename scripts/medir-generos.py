#!/usr/bin/env python3
# Mide la cobertura real de cada radio de género en Vórtex Music.
# Llama a /api/music/genre?slug=X y cuenta pistas y fuentes de cada una.
import json
import subprocess
import sys
import time

SLUGS = [
    "reggaeton", "pop-latino", "pop", "rock", "metal", "electronica",
    "hip-hop", "salsa", "cumbia", "lo-fi", "jazz", "k-pop", "clasica",
    "indie", "trance", "dubstep", "ruso", "china",
]

def fetch(slug: str) -> dict:
    url = f"http://localhost:3000/api/music/genre?slug={slug}"
    try:
        out = subprocess.run(
            ["curl", "-sS", "-m", "60", url],
            capture_output=True, text=True, timeout=70
        ).stdout
        d = json.loads(out)
        tracks = d.get("tracks") or []
        srcs: dict[str, int] = {}
        for t in tracks:
            s = t.get("source", "?")
            srcs[s] = srcs.get(s, 0) + 1
        ok = len(tracks) >= 10  # una radio "funciona" si ofrece >=10 canciones
        return {"slug": slug, "n": len(tracks), "srcs": srcs, "ok": ok}
    except Exception as e:
        return {"slug": slug, "n": 0, "srcs": {"error": 1}, "ok": False}

results = []
for slug in SLUGS:
    r = fetch(slug)
    results.append(r)
    estado = "OK " if r["ok"] else "BAJO"
    print(f"[{estado}] {slug:12s} {r['n']:3d} pistas  {json.dumps(r['srcs'], ensure_ascii=False)}")
    sys.stdout.flush()

ok_count = sum(1 for r in results if r["ok"])
pct = round(100 * ok_count / len(results))
total_tracks = sum(r["n"] for r in results)
print("\n==== RESUMEN ====")
print(f"Géneros operativos (>=10 pistas): {ok_count}/{len(results)} = {pct}%")
print(f"Pistas totales en radios: {total_tracks}")
