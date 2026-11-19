#!/bin/bash
# Prueba de rutas de Vórtex Music: arranca el servidor, espera y valida las APIs.
cd /home/z/my-project
setsid nohup npx next dev -p 3000 >> dev.log 2>&1 < /dev/null & disown

# Esperar a que responda /
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then break; fi
  sleep 2
done
echo "root: $code"

# 1) HOME
curl -s --max-time 100 "http://localhost:3000/api/music/home" -o /tmp/home.json
python3 - <<'PY'
import json
try:
    d = json.load(open('/tmp/home.json'))
    print("== HOME ==")
    for k in d:
        v = d[k]
        ej = f"{v[0].get('title','')[:30]} · {v[0].get('source','?')} · {v[0].get('duration')}s" if v else "(vacío)"
        print(f"  {k}: {len(v)} | {ej}")
except Exception as e:
    print("HOME ERROR:", e, open('/tmp/home.json').read()[:200])
PY

# 2) BÚSQUEDA
curl -s --max-time 100 "http://localhost:3000/api/music/search?q=rock" -o /tmp/search.json
python3 - <<'PY'
import json
try:
    d = json.load(open('/tmp/search.json'))
    print("== SEARCH rock ==")
    print("  songs:", len(d.get('songs', [])), "· fuentes:", sorted(set(t['source'] for t in d.get('songs', []))))
    print("  artists:", len(d.get('artists', [])), "· ej:", d['artists'][0]['name'] if d.get('artists') else "-")
    for t in d.get('songs', [])[:4]:
        print(f"   · {t['title'][:34]} | {t['artist'][:20]} | {t['source']} | {t['duration']}s | preview={t['preview']}")
except Exception as e:
    print("SEARCH ERROR:", e, open('/tmp/search.json').read()[:200])
PY

# 3) GÉNERO METAL
curl -s --max-time 100 "http://localhost:3000/api/music/genre?slug=metal" -o /tmp/metal.json
python3 - <<'PY'
import json
try:
    d = json.load(open('/tmp/metal.json'))
    print("== GENRE metal ==")
    print("  label:", d.get('label'), "· tracks:", len(d.get('tracks', [])))
    for t in d.get('tracks', [])[:4]:
        print(f"   · {t['title'][:34]} | {t['artist'][:20]} | {t['source']} | {t['duration']}s")
except Exception as e:
    print("METAL ERROR:", e, open('/tmp/metal.json').read()[:200])
PY

# 4) GÉNERO REGGAETÓN
curl -s --max-time 100 "http://localhost:3000/api/music/genre?slug=reggaeton" -o /tmp/reg.json
python3 - <<'PY'
import json
try:
    d = json.load(open('/tmp/reg.json'))
    tr = d.get('tracks', [])
    print("== GENRE reggaeton == tracks:", len(tr))
    for t in tr[:4]:
        print(f"   · {t['title'][:34]} | {t['artist'][:20]} | {t['source']} | {t['duration']}s")
except Exception as e:
    print("REGGAETON ERROR:", e, open('/tmp/reg.json').read()[:200])
PY

# 5) ARTISTA ccMixter (id cc-)
curl -s --max-time 100 "http://localhost:3000/api/music/artist?id=cc-Javolenus" -o /tmp/artist.json
python3 - <<'PY'
import json
try:
    d = json.load(open('/tmp/artist.json'))
    print("== ARTISTA cc-Javolenus ==")
    print("  name:", d.get('artist', {}).get('name'), "· topSongs:", len(d.get('topSongs', [])))
except Exception as e:
    print("ARTIST ERROR:", e, open('/tmp/artist.json').read()[:200])
PY

# 6) PROXY ccMixter con Range
URL=$(python3 - <<'PY'
import json
try:
    d = json.load(open('/tmp/home.json'))
    for t in d.get('fresh', []):
        if t.get('source') == 'ccmixter' and '/stream/cc?p=' in t.get('streamUrl', ''):
            print(t['streamUrl'])
            break
except Exception:
    pass
PY
)
if [ -n "$URL" ]; then
  echo "== PROXY ccMixter =="
  curl -s -o /dev/null -w "  range 0-2047 → %{http_code} %{content_type} (%{size_download} bytes)\n" --max-time 40 -r 0-2047 "http://localhost:3000${URL}"
else
  echo "== PROXY ccMixter: sin pista ccmixter en home =="
fi

echo "LISTO"
