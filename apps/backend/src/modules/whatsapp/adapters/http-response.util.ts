/**
 * Membaca badan respons provider WA sebagai objek JSON.
 *
 * Kalau badannya bukan JSON (provider/proxy membalas halaman error HTML, domain
 * salah sehingga yang menjawab situs web biasa, atau badan kosong), galatnya
 * dijelaskan dengan bahasa yang bisa langsung ditindaklanjuti admin. Dulu
 * `response.json()` dipanggil langsung sehingga yang muncul hanya
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` — tanpa petunjuk
 * provider mana, status HTTP-nya apa, atau apa yang harus diperiksa.
 *
 * Tidak pernah menyertakan token/kunci API pada pesan galat.
 */
export async function readJsonResponse(
  response: Response,
  provider: string,
  hint?: string,
): Promise<Record<string, unknown>> {
  const raw = await response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }

  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  throw new Error(describeNonJsonResponse(raw, response, provider, hint));
}

function describeNonJsonResponse(
  raw: string,
  response: Response,
  provider: string,
  hint?: string,
): string {
  const trimmed = raw.trim();
  const contentType = response.headers.get('content-type') ?? '';
  const isHtml =
    /^<(!doctype|html|head|body)/i.test(trimmed) ||
    /text\/html/i.test(contentType);

  let what: string;
  if (trimmed === '') {
    what = 'membalas dengan badan kosong';
  } else if (isHtml) {
    const title = /<title[^>]*>\s*([^<]{1,80}?)\s*<\/title>/i.exec(
      trimmed,
    )?.[1];
    what = `membalas halaman web (HTML)${title ? ` "${title}"` : ''}, bukan jawaban API`;
  } else {
    what = `membalas data yang tidak dikenali: "${trimmed.replace(/\s+/g, ' ').slice(0, 100)}"`;
  }

  return `${provider} ${what} (HTTP ${response.status})${hint ? ` — ${hint}` : ''}`;
}
