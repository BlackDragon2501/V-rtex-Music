// ============ Guardián de formato MP3 (compartido servidor + navegador) ======
//
// Por qué existe: Internet Archive hospeda los originales en FLAC/WAV/OGG y
// genera derivados MP3. Si un archivo no-MP3 se cuela en la cola, el
// <audio> del navegador se rompe (error de códec, pista muerta, salto
// fantasma). Este módulo es la única definición de "audio reproducible":
//
//   1. isMp3FileName() → el ADAPTADOR de IA solo extrae archivos que terminan
//      en .mp3 (ignora .wav, .flac, .ogg, imágenes y texto).
//   2. isMp3Url() → validación de la URL final que se le pasa al reproductor:
//      el streamUrl de una pista de IA debe apuntar al archivo MP3 DIRECTO.
//   3. NoMp3Error → un álbum sin ni un solo MP3 lanza este error tipado; la
//      vista lo distingue de un fallo de red y muestra un mensaje claro en
//      lugar de "Algo salió mal".
//
// Es isomórfico a propósito: cero imports de Node, usable en archive.ts,
// ia-browser.ts, el PlayerProvider y cualquier vista.

// Extensión estricta: SOLO .mp3 (case-insensitive). Nada de .wav, .flac,
// .ogg/.oga, .m4a, .aiff, imágenes (.png/.jpg) ni texto (.txt/.pdf/.xml).
const MP3_EXT_RE = /\.mp3$/i;

// Mensaje visible cuando un disco entero no trae un solo MP3 reproducible.
export const NO_MP3_MESSAGE = "Este álbum no contiene archivos MP3 compatibles";

// Error tipado: la vista lo detecta sin depender de comparar texto libre.
export class NoMp3Error extends Error {
  constructor(message: string = NO_MP3_MESSAGE) {
    super(message);
    this.name = "NoMp3Error";
  }
}

// ¿El mensaje de un error (ya sea el objeto o su texto) es el de "sin MP3"?
// useAsync() entrega `error` como string; esta función unifica ambas formas.
export function isNoMp3Error(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) return err.name === "NoMp3Error" || err.message === NO_MP3_MESSAGE;
  return String(err) === NO_MP3_MESSAGE;
}

// Un archivo es candidato SOLO si su nombre termina en .mp3. Es el filtro
// ESTRICTO pedido: el campo `format` de IA puede venir vacío o mal etiquetado
// en subidas de usuarios; la extensión real no miente.
export function isMp3FileName(name?: string): boolean {
  if (!name) return false;
  return MP3_EXT_RE.test(name.trim());
}

// La URL que llega al <audio> debe ser el archivo MP3 directo: la ruta
// termina en .mp3 (ignorando querystring y hash). Acepta URLs absolutas y
// relativas; ante una URL imparsable devuelve false (denegar por defecto).
export function isMp3Url(url: string): boolean {
  if (!url) return false;
  try {
    const path = new URL(url, "https://vortex.local").pathname;
    return MP3_EXT_RE.test(path);
  } catch {
    return false;
  }
}

// Validez mínima para CUALQUIER fuente (Audius, Jamendo, ccMixter vía proxy,
// Wikimedia, Openverse): URL http(s) bien formada. Las pistas de Internet
// Archive además exigen isMp3Url() (ver streamUrlSegura()).
export function isStreamableUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url, "https://vortex.local");
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// Validación final antes de darle una URL al reproductor. source "archive" →
// MP3 directo obligatorio; el resto de fuentes solo necesitan http(s).
export function streamUrlSegura(url: string, source?: string): boolean {
  if (!isStreamableUrl(url)) return false;
  if (source === "archive") return isMp3Url(url);
  return true;
}
