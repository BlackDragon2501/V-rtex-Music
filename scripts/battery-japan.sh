#!/bin/bash
# Batería de prueba de la integración Japón (Fase 2) en un solo proceso:
# arranca el servidor, espera salud y evalúa las 4 radios + portada.
cd /home/z/my-project

# 1) matar restos y arrancar limpio
(fuser -k 3000/tcp 2>/dev/null || true)
pkill -f "bun run dev" 2>/dev/null; pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null
sleep 3
setsid nohup bun run dev > dev.log 2>&1 < /dev/null &
disown

# 2) esperar salud (hasta 60 s)
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 8 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "servidor: HTTP $code"

PY() { python3 -c "$1"; }

echo ""
echo "=== RADIO j-pop ==="
curl -s -m 180 "http://localhost:3000/api/music/genre?slug=j-pop&sid=battery" | PY "
import json,sys
d=json.load(sys.stdin); ts=d.get('tracks',[])
cjk=lambda s: any('\u3040'<=c<='\u9fff' or '\uff66'<=c<='\uff9d' for c in s)
n=sum(1 for t in ts if cjk(t['title']+t['artist']))
print('tracks:', len(ts), '| guion japonés:', n)
for t in ts[:8]: print(f\"  · {t['title'][:52]} | {t['artist'][:22]} | {t['source']} {'JP' if cjk(t['title']+t['artist']) else ''}\")"

echo ""
echo "=== RADIO j-rock ==="
curl -s -m 180 "http://localhost:3000/api/music/genre?slug=j-rock&sid=battery" | PY "
import json,sys
d=json.load(sys.stdin); ts=d.get('tracks',[])
cjk=lambda s: any('\u3040'<=c<='\u9fff' or '\uff66'<=c<='\uff9d' for c in s)
n=sum(1 for t in ts if cjk(t['title']+t['artist']))
print('tracks:', len(ts), '| guion japonés:', n)
for t in ts[:8]: print(f\"  · {t['title'][:52]} | {t['artist'][:22]} | {t['source']} {'JP' if cjk(t['title']+t['artist']) else ''}\")"

echo ""
echo "=== RADIO anime ==="
curl -s -m 180 "http://localhost:3000/api/music/genre?slug=anime&sid=battery" | PY "
import json,sys
d=json.load(sys.stdin); ts=d.get('tracks',[])
cjk=lambda s: any('\u3040'<=c<='\u9fff' or '\uff66'<=c<='\uff9d' for c in s)
n=sum(1 for t in ts if cjk(t['title']+t['artist']))
print('tracks:', len(ts), '| guion japonés:', n)
for t in ts[:8]: print(f\"  · {t['title'][:52]} | {t['artist'][:22]} | {t['source']} {'JP' if cjk(t['title']+t['artist']) else ''}\")"

echo ""
echo "=== RADIO japon-tradicional ==="
curl -s -m 180 "http://localhost:3000/api/music/genre?slug=japon-tradicional&sid=battery" | PY "
import json,sys
d=json.load(sys.stdin); ts=d.get('tracks',[])
cjk=lambda s: any('\u3040'<=c<='\u9fff' or '\uff66'<=c<='\uff9d' for c in s)
n=sum(1 for t in ts if cjk(t['title']+t['artist']))
print('tracks:', len(ts), '| guion japonés:', n)
for t in ts[:8]: print(f\"  · {t['title'][:52]} | {t['artist'][:22]} | {t['source']} {'JP' if cjk(t['title']+t['artist']) else ''}\")"

echo ""
echo "=== PORTADA: Rincón del mundo ==="
curl -s -m 180 "http://localhost:3000/api/music/home?sid=battery" | PY "
import json,sys
d=json.load(sys.stdin)
cjk=lambda s: any('\u3040'<=c<='\u9fff' or '\uff66'<=c<='\uff9d' for c in s)
for k in ['trending','underground','fresh','ccTracks','world']:
    print(k, len(d.get(k,[])))
w=d.get('world',[])
jp=[t for t in w if cjk(t['title']+t['artist'])]
print('world japonés:', len(jp))
for t in w[:16]: print(f\"  · {t['title'][:52]} | {t['artist'][:22]} | {t['source']} {'JP' if cjk(t['title']+t['artist']) else ''}\")"

echo ""
echo "=== logs de errores recientes ==="
rg "rechazada|Error|error" dev.log | rg -v "429|iaHome" | tail -6
