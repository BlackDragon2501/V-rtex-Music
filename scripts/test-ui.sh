#!/bin/bash
# Prueba de UI v2: banderas --timeout antes del subcomando y objetivos correctos.
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
$AB open http://localhost:3000 --timeout 60000 >/dev/null
$AB wait --load networkidle --timeout 30000 >/dev/null 2>&1
sleep 2

# Historial limpio al empezar
$AB eval "localStorage.removeItem('vortex:search-history')" >/dev/null
$AB reload >/dev/null; sleep 2

echo "--- BUSCAR 'jazz' CON ENTER ---"
$AB find role searchbox fill "jazz"
$AB press Enter
sleep 4
SONGS=$($AB get count "div[role='button'][aria-label^='Reproducir']")
echo "filas de canciones visibles: $SONGS"
$AB screenshot /tmp/ui-search.png >/dev/null 2>&1

echo "--- REABRIR BUSCADOR → dropdown con 'jazz' ---"
$AB find role searchbox click
sleep 1
DROP=$($AB get count "[aria-label='Búsquedas recientes']")
echo "dropdown presente: $DROP (esperado 1)"
ITEMS=$($AB eval "Array.from(document.querySelectorAll(\"[aria-label='Búsquedas recientes'] ul li\")).map(li => li.textContent.trim()).join(' | ')")
echo "items: $ITEMS"

echo "--- GUARDAR UNA SEGUNDA BÚSQUEDA Y ORDEN (recencia) ---"
$AB press Escape 2>/dev/null
$AB find role searchbox fill "reggaeton"
$AB press Enter
sleep 3.5
$AB find role searchbox click
sleep 1
ITEMS2=$($AB eval "Array.from(document.querySelectorAll(\"[aria-label='Búsquedas recientes'] ul li button[aria-label^='Buscar']\")).map(b => b.textContent.trim()).join(' | ')")
echo "orden historial: $ITEMS2 (esperado reggaeton | jazz)"

echo "--- X INDIVIDUAL (eliminar jazz) ---"
$AB find role button click --name "Eliminar jazz del historial"
sleep 0.8
ITEMS3=$($AB eval "Array.from(document.querySelectorAll(\"[aria-label='Búsquedas recientes'] ul li button[aria-label^='Buscar']\")).map(b => b.textContent.trim()).join(' | ')")
echo "tras X: $ITEMS3 (esperado solo reggaeton)"

echo "--- LIMPIAR TODO ---"
$AB find role button click --name "Limpiar todo el historial de búsqueda"
sleep 0.8
DROP2=$($AB get count "[aria-label='Búsquedas recientes']")
LS=$($AB eval "localStorage.getItem('vortex:search-history')")
echo "dropdown tras Limpiar todo: $DROP2 (esperado 0) · localStorage: $LS"

echo "--- REPRODUCIR TENDENCIAS (audio completo) ---"
$AB open http://localhost:3000 >/dev/null
$AB wait --load networkidle --timeout 30000 >/dev/null 2>&1
sleep 3
$AB find role button click --name "Reproducir tendencias"
sleep 7
$AB eval "(() => { const a = document.querySelector('audio'); if (!a) return 'SIN AUDIO'; return 'dur=' + (a.duration ? a.duration.toFixed(1) : 0) + 's pos=' + a.currentTime.toFixed(1) + 's pausado=' + a.paused + ' src=' + (a.currentSrc || a.src || '').slice(0, 80); })()"
$AB screenshot /tmp/ui-play.png >/dev/null 2>&1
echo "--- ERRORES DE PÁGINA ---"
$AB errors 2>/dev/null | head -5
echo "LISTO-UI-V2"
