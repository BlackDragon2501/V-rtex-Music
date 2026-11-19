"""Prueba del botón "Más canciones": rotación por sid + filtro exclude."""
import json
import random
import urllib.parse
import urllib.request

BASE = "http://localhost:3000/api/music/genre"
SID = f"testmas{random.randint(1000, 999999)}"


def fetch(slug, sid, exclude=None):
    url = f"{BASE}?slug={slug}&sid={sid}"
    if exclude:
        url += "&exclude=" + urllib.parse.quote(exclude)
    with urllib.request.urlopen(url, timeout=90) as r:
        return json.load(r)


d1 = fetch("metal", SID)
i1 = [t["id"] for t in d1["tracks"]]
d2 = fetch("metal", SID)
i2 = [t["id"] for t in d2["tracks"]]
print(f"Radio {d1['label']}: tanda1={len(i1)}, tanda2={len(i2)}")
s12 = len(set(i1) & set(i2))
print(f"solape t1∩t2 = {s12} (esperado 0: mismo sid rota)")

d3 = fetch("metal", SID, ",".join(i1 + i2))
i3 = [t["id"] for t in d3["tracks"]]
s13 = len(set(i1) & set(i3))
s23 = len(set(i2) & set(i3))
print(f"tanda3 con exclude = {len(i3)}, solape t3∩t1 = {s13}, t3∩t2 = {s23} (esperados 0)")

ok = len(i1) > 0 and len(i2) > 0 and s12 == 0 and s13 == 0 and s23 == 0
print("RESULTADO:", "OK" if ok else "FALLO")
