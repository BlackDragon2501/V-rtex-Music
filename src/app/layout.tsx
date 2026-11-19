import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vórtex Music — Tu música, sin límites",
  description:
    "Vórtex Music: reproductor de música online 100% gratis y sin anuncios. Canciones completas y legales de artistas independientes, letras sincronizadas, playlists y radios por género.",
  keywords: ["Vórtex Music", "música online", "música gratis", "sin anuncios", "streaming", "playlists"],
  applicationName: "Vórtex Music",
  icons: {
    icon: "/vortex.svg",
  },
  openGraph: {
    title: "Vórtex Music",
    description: "Tu música, sin límites. Gratis y sin anuncios.",
    siteName: "Vórtex Music",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Aplica el modo de colores guardado ANTES del primer pintado (sin parpadeo).
const THEME_BOOT = `try{var s=localStorage.getItem("vortex-theme");if(s&&JSON.parse(s).state.theme==="esmeralda")document.documentElement.dataset.theme="esmeralda";}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Preconexiones: aceleran la primera carga de portadas, audio y letras */}
        <link rel="preconnect" href="https://api.audius.co" crossOrigin="" />
        <link rel="preconnect" href="https://api.openverse.org" crossOrigin="" />
        <link rel="preconnect" href="https://prod-1.storage.jamendo.com" crossOrigin="" />
        <link rel="preconnect" href="https://ccmixter.org" crossOrigin="" />
        <link rel="preconnect" href="https://upload.wikimedia.org" crossOrigin="" />
        <link rel="preconnect" href="https://commons.wikimedia.org" crossOrigin="" />
        <link rel="preconnect" href="https://lrclib.net" crossOrigin="" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {children}
      </body>
    </html>
  );
}
