#!/bin/bash
# Prueba final: reproducir una pista de ccMixter vía proxy + abrir reproductor.
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

# Clic en la primera tarjeta de la sección "Novedades libres" (ccMixter)
$AB eval "(() => {
  const sections = Array.from(document.querySelectorAll('section'));
  const sec = sections.find(s => s.textContent.includes('Novedades libres'));
  if (!sec) return 'no-section';
  const card = sec.querySelector('div[role=\\'button\\'][aria-label]');
  if (!card) return 'no-card';
  card.click();
  return 'clicked';
})()"
sleep 8
$AB eval "(() => { const a = document.querySelector('audio'); if (!a) return 'SIN AUDIO'; return 'dur=' + (a.duration ? a.duration.toFixed(1) : 0) + 's pos=' + a.currentTime.toFixed(1) + 's pausado=' + a.paused + ' src=' + (a.currentSrc || a.src || '').slice(0, 90); })()"
echo "--- ERRORES ---"
$AB errors 2>/dev/null | head -4
$AB screenshot /tmp/ui-final.png >/dev/null 2>&1
echo "LISTO-FINAL"
