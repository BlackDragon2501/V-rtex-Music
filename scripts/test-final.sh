#!/bin/bash
# Revisión final: consola de errores + página de búsqueda cargada + vista de género metal.
cd /home/z/my-project
setsid nohup npx next dev -p 3000 >> dev.log 2>&1 < /dev/null & disown
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then break; fi
  sleep 2
done
echo "servidor: $code"
AB="agent-browser"
$AB close >/dev/null 2>&1
$AB open "http://localhost:3000" >/dev/null
$AB wait --load networkidle --timeout 30000 >/dev/null 2>&1
sleep 2
echo "--- CONSOLA (errores) ---"
$AB console 2>/dev/null | grep -i -E "error|warn" | grep -v "Download the React DevTools" | head -8
echo "--- ERRORES DE PÁGINA ---"
$AB errors 2>/dev/null | head -8

echo "--- BÚSQUEDA 'jazz' CARGADA ---"
$AB find role searchbox fill "jazz" >/dev/null
$AB press Enter
sleep 8
ROWS=$($AB get count "div[role='button'][aria-label^='Reproducir']")
echo "filas de canciones: $ROWS"
$AB screenshot /tmp/ui-search2.png >/dev/null 2>&1

echo "--- GÉNERO METAL ---"
$AB eval "document.querySelector('main').scrollTop=0" >/dev/null
$AB find role button click --name "Radio de Metal" 2>/dev/null || $AB find text "Metal" click 2>/dev/null
sleep 8
$AB screenshot /tmp/ui-metal.png >/dev/null 2>&1
MT=$($AB eval "document.body.innerText.includes('Radio Vórtex') && Array.from(document.querySelectorAll('div[role=button]')).filter(d => (d.getAttribute('aria-label')||'').startsWith('Reproducir')).length")
echo "metal page filas: $MT"
echo "LISTO-REVISION"
