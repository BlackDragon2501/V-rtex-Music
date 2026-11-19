"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LogoWordmark } from "@/components/music/Logo";

// ============ Footer legal y de marca de Vórtex Music ========================
//
// Contiene, de arriba abajo:
//   · Marca: logo + el lema oficial ("Tu música, sin límites. Gratis y sin
//     anuncios." — el mismo de la metadata del sitio).
//   · Enlaces legales que abren su documento en un diálogo: Políticas de
//     Privacidad • Términos y Servicios • Acerca de Vórtex Music • Contacto.
//   · Derechos Reservados para: Vortex Company (la organización).
//   · Vórtex Studio (creador de este proyecto).
//
// Vive al final del contenido de TODAS las vistas (AppShell lo monta tras la
// vista activa con mt-auto): pegado abajo si el contenido es corto y empujado
// naturalmente al final del scroll si es largo. Nunca tapa al reproductor:
// queda por encima de la barra (PlayerBar/MobileNav son hermanos aparte).

type LegalDoc = "privacidad" | "terminos" | "acerca";

interface Seccion {
  h: string;
  ps: string[];
}

const DOCS: Record<LegalDoc, { titulo: string; descripcion: string; secciones: Seccion[] }> = {
  privacidad: {
    titulo: "Políticas de Privacidad",
    descripcion: "Cómo tratamos la información en Vórtex Music. Resumen honesto: no pedimos registro y no recogemos datos personales.",
    secciones: [
      {
        h: "1. Sin cuentas ni datos personales",
        ps: [
          "Vórtex Music no requiere registro, no utiliza cookies de seguimiento y no recopila datos personales (nombre, correo, teléfono, ubicación ni hábitos identificables). No hay publicidad ni perfiles de usuario: el servicio es gratuito y se financia por voluntad de su creador.",
        ],
      },
      {
        h: "2. Datos guardados solo en tu dispositivo",
        ps: [
          "Tus playlists, canciones favoritas, historial de reproducción, historial de búsqueda y preferencias (tema, volumen) se guardan exclusivamente en el almacenamiento local de tu navegador (localStorage y sessionStorage). Esa información nunca viaja a un servidor de Vórtex.",
          "Si borras los datos del navegador o usas el modo privado, esa información desaparece y nadie más —ni siquiera Vórtex— puede recuperarla.",
        ],
      },
      {
        h: "3. Identificador de sesión anónimo",
        ps: [
          "Para que cada visita te muestre canciones distintas, la app genera un identificador aleatorio (sid) que vive solo mientras dura la pestaña. No está vinculado a ninguna persona ni dispositivo: solo sirve para variar la selección musical y evitar repeticiones.",
        ],
      },
      {
        h: "4. Servicios de terceros",
        ps: [
          "El audio, las portadas y los metadatos provienen de catálogos públicos y legales: Audius, Jamendo, Openverse, ccMixter, Wikimedia Commons, Internet Archive y LRCLIB (letras). Al reproducir o buscar, tu navegador se comunica directamente con esos servicios, que aplican sus propias políticas de privacidad y reciben tu dirección IP como a cualquier sitio web que visites.",
          "Vórtex Music no les envía información tuya adicional: no hay cuentas, ni tokens, ni datos de contacto que compartir.",
        ],
      },
      {
        h: "5. Contacto",
        ps: [
          "Dudas sobre privacidad: vortexmusic.soporte.app@gmail.com",
        ],
      },
    ],
  },
  terminos: {
    titulo: "Términos y Servicios",
    descripcion: "Las reglas de uso del servicio. Al usar Vórtex Music aceptas estos términos.",
    secciones: [
      {
        h: "1. Qué es Vórtex Music",
        ps: [
          "Vórtex Music es un reproductor de música en línea, 100% gratuito y sin anuncios. Solo ofrece streaming: no permite descargar canciones ni reproducir archivos locales.",
          "El catálogo se obtiene en tiempo real de fuentes de distribución libre y legal: obras con licencia Creative Commons, grabaciones de dominio público y artistas que publican su música abiertamente (Audius, Jamendo, Openverse, ccMixter, Wikimedia Commons e Internet Archive).",
        ],
      },
      {
        h: "2. Uso aceptable",
        ps: [
          "Puedes escuchar, descubrir y organizar el contenido libremente para tu disfrute personal. No está permitido abusar de los servicios ajenos (saturar las APIs de las fuentes), intentar interrumpir el servicio ni redistribuir o comercializar las obras sin respetar la licencia de cada una.",
          "Cada canción conserva su licencia original (Creative Commons o dominio público). Para usos distintos al disfrute personal (vídeos, eventos, obras derivadas con fines comerciales) revisa los términos de la licencia de la obra y de la fuente que la hospeda.",
        ],
      },
      {
        h: "3. Propiedad intelectual",
        ps: [
          "Vórtex Music no reclama propiedad sobre el catálogo: los derechos de cada obra pertenecen a sus autores, intérpretes y sellos. La interfaz, el nombre Vórtex Music y su marca son propiedad de Vortex Company, y este proyecto fue creado por Vórtex Studio.",
        ],
      },
      {
        h: "4. Disponibilidad y responsabilidad",
        ps: [
          "El servicio se ofrece tal cual, sin garantía de disponibilidad continua: los catálogos externos pueden cambiar, moverse o dejar de estar disponibles sin aviso. Vórtex Music no es responsable del contenido hospedado por terceros ni de las decisiones de estas plataformas.",
        ],
      },
      {
        h: "5. Retiro de contenido (DMCA)",
        ps: [
          "Las fuentes utilizadas (por ejemplo, las colecciones de Internet Archive moderadas bajo DMCA) aceptan notificaciones de retiro. Si eres titular de derechos y consideras que una obra no debería estar disponible, escríbenos a vortexmusic.soporte.app@gmail.com indicando la obra y la fuente; la retiraremos de la app y te orientaremos para notificar a la plataforma que la hospeda.",
        ],
      },
      {
        h: "6. Cambios en los términos",
        ps: [
          "Estos términos pueden actualizarse para reflejar mejoras del servicio. Los cambios aplican desde su publicación en esta pantalla.",
        ],
      },
    ],
  },
  acerca: {
    titulo: "Acerca de Vórtex Music",
    descripcion: "El proyecto, sus fuentes y quién lo desarrolla.",
    secciones: [
      {
        h: "El proyecto",
        ps: [
          "Vórtex Music es un reproductor web de streaming 100% gratuito y sin anuncios, pensado para descubrir música legal: artistas independientes, netlabels Creative Commons, grabaciones de dominio público y acervos históricos de libre distribución. Sin cuentas, sin avances de 30 segundos: canciones completas, siempre.",
        ],
      },
      {
        h: "El lema",
        ps: [
          "Tu música, sin límites. Gratis y sin anuncios.",
        ],
      },
      {
        h: "Fuentes de audio (todas legales)",
        ps: [
          "Audius · Jamendo · Openverse (Jamendo + Wikimedia) · ccMixter · Wikimedia Commons · Internet Archive (netlabels, community audio, 78rpm y más). Las letras sincronizadas provienen de LRCLIB. Cada obra se reproduce según la licencia que su autor le otorgó.",
        ],
      },
      {
        h: "Funciones",
        ps: [
          "Reproducción continua, cola editable, radios por género con rotación, búsqueda con historial, letras sincronizadas, playlists y favoritos guardados en tu dispositivo, y álbumes completos de Internet Archive con su orden de disco original.",
        ],
      },
      {
        h: "Quién lo hace",
        ps: [
          "Vórtex Music es un proyecto desarrollado por Vórtex Studio y publicado por Vortex Company.",
          "Contacto: vortexmusic.soporte.app@gmail.com",
        ],
      },
    ],
  },
};

// Un documento legal en diálogo, con scroll interno para textos largos.
function LegalDialog({ doc, onClose }: { doc: LegalDoc | null; onClose: () => void }) {
  const d = doc ? DOCS[doc] : null;
  return (
    <Dialog open={!!d} onOpenChange={(o) => (o ? undefined : onClose())}>
      <DialogContent className="max-w-lg border-border bg-[#0b1220] p-0">
        <DialogHeader className="px-5 pb-1 pt-5">
          <DialogTitle>{d?.titulo}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">{d?.descripcion}</DialogDescription>
        </DialogHeader>
        <div className="scrollbar-thin max-h-[65vh] overflow-y-auto px-5 pb-5">
          {d?.secciones.map((s) => (
            <section key={s.h} className="mt-4 first:mt-1">
              <h3 className="text-sm font-bold text-foreground">{s.h}</h3>
              {s.ps.map((p, i) => (
                <p key={i} className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Footer() {
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const year = new Date().getFullYear();

  const linkCls =
    "rounded underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-muted-foreground";

  return (
    <footer className="mt-auto border-t border-white/5 bg-[#080d18]/70 px-4 py-8 sm:px-6" aria-label="Pie de página de Vórtex Music">
      {/* Marca + lema */}
      <div className="flex flex-col gap-2">
        <LogoWordmark size={26} />
        <p className="text-sm font-medium text-muted-foreground">
          Tu música, sin límites.{" "}
          <span className="text-muted-foreground/70">Gratis y sin anuncios.</span>
        </p>
      </div>

      {/* Enlaces legales */}
      <nav className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground" aria-label="Enlaces legales">
        <button onClick={() => setDoc("privacidad")} className={linkCls}>
          Políticas de Privacidad
        </button>
        <span aria-hidden="true" className="text-muted-foreground/40">•</span>
        <button onClick={() => setDoc("terminos")} className={linkCls}>
          Términos y Servicios
        </button>
        <span aria-hidden="true" className="text-muted-foreground/40">•</span>
        <button onClick={() => setDoc("acerca")} className={linkCls}>
          Acerca de Vórtex Music
        </button>
        <span aria-hidden="true" className="text-muted-foreground/40">•</span>
        <a href="mailto:vortexmusic.soporte.app@gmail.com" className={linkCls}>
          Contacto
        </a>
      </nav>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/60">
        Todo el audio proviene de fuentes de distribución libre y legal (Creative Commons y dominio público): Audius, Jamendo, Openverse, ccMixter, Wikimedia Commons e Internet Archive.
      </p>

      {/* Derechos y autoría */}
      <div className="mt-6 border-t border-white/5 pt-4 text-xs text-muted-foreground">
        <p>
          Derechos Reservados © <span suppressHydrationWarning>{year}</span> Vortex Company. Todos los derechos reservados.
        </p>
        <p className="mt-1 text-muted-foreground/70">
          Vórtex Studio
        </p>
      </div>

      <LegalDialog doc={doc} onClose={() => setDoc(null)} />
    </footer>
  );
}
