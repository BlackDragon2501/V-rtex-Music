#!/bin/bash
# Visual final: página Metal + dropdown de historial.
cd /home/z/my-project
setsid nohup npx next dev -p 3000 >> dev.log 2>&1 < /dev/null & disown
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then break; fi
  sleep 2
done
AB="agent-browser"
$AB close >/dev/null 2>&1
$AB open http://localhost:3000 >/dev/null
$AB wait --load networkidle --timeout 30000 >/dev/null 2>&1
sleep 3

# Precalentar el género metal vía API para que la vista abra al instante
curl -s "http://localhost:3000/api/music/genre?slug=metal" -o /dev/null --max-time 60
$AB eval "(() => { const btn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Radio de Metal'); if (btn) { btn.click(); return 'ok'; } return 'no-btn'; })()"
sleep 8
$AB screenshot /tmp/ui-metal2.png >/dev/null 2>&1
ROWS=$($AB get count "div[role='button'][aria-label^='Reproducir']")
echo "metal filas: $ROWS"

# Dropdown de historial (ya contiene búsquedas previas? reponer una)
$AB find role searchbox fill "salsa roja" >/dev/null
$AB press Enter
sleep 4
$AB find role searchbox click >/dev/null
sleep 1
$AB screenshot /tmp/ui-history2.png >/dev/null 2>&1
echo "dropdown: $($AB get count "[aria-label='Búsquedas recientes']")"
echo "LISTO-VISUAL"
