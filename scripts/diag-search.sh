#!/bin/bash
# Diagnóstico: servidor + una búsqueda + lecturas de error del log.
cd /home/z/my-project
setsid nohup npx next dev -p 3000 >> dev.log 2>&1 < /dev/null & disown
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then break; fi
  sleep 2
done
echo "root: $code"
MARK="DIAG-MARK-$(date +%s)"
echo "$MARK" >> dev.log
curl -s --max-time 100 "http://localhost:3000/api/music/search?q=piano" -o /tmp/search2.json -w "status:%{http_code}\n"
sleep 2
# Extraer la parte del log tras la marca
awk "/$MARK/{found=1} found" dev.log | strings | head -60
echo "-----"
python3 - <<'PY'
import json
try:
    d = json.load(open('/tmp/search2.json'))
    print("songs:", len(d.get('songs', [])), "· fuentes:", sorted(set(t['source'] for t in d.get('songs', []))))
except Exception as e:
    print("ERR", e, open('/tmp/search2.json').read()[:150])
PY
