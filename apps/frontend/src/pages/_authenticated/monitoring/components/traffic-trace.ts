// Logika murni pembentuk garis grafik trafik (tanpa React) — dipisah supaya mudah diuji.

/** Lebar grafik: 60 detik terakhir. */
export const WINDOW_MS = 60_000;
/** Selang polling trafik ke backend. */
export const TRAFFIC_POLL_MS = 2_000;
/** Sampel yang disimpan: sedikit lebih panjang dari jendela agar garis masuk mulus dari tepi kiri. */
export const TRAFFIC_KEEP_MS = WINDOW_MS + 10_000;

// Ukuran kanvas SVG grafik (viewBox).
export const CHART_W = 300;
export const CHART_H = 110;
export const BASE_Y = 98; // garis dasar = 0 bps
export const TOP_Y = 12; // batas atas grafik
/**
 * Ujung garis (titik + cincin denyut) berhenti sedikit di dalam tepi kanan kanvas, supaya tidak
 * terpotong oleh tepi SVG.
 */
export const PLOT_W = CHART_W - 14;

const MIN_SCALE_BPS = 100_000; // skala minimum 100 Kbps supaya lalu lintas sepi tidak tampak "meledak"

export interface TracePoint {
  /** waktu sampel diterima (epoch ms) */
  t: number;
  /** bit per detik */
  v: number;
}

/** Satu pembacaan trafik, sudah dilihat dari sudut pandang PELANGGAN. */
export interface TrafficSample {
  t: number;
  /** kecepatan download pelanggan (bit/detik) */
  down: number;
  /** kecepatan upload pelanggan (bit/detik) */
  up: number;
}

/**
 * Satu-satunya tempat yang menerjemahkan data backend ke Download/Upload.
 *
 * MikroTik melaporkan dari sudut pandang ROUTER: `rx-bits-per-second` adalah yang DITERIMA
 * router dari pelanggan (= upload pelanggan), sedangkan `tx-bits-per-second` adalah yang
 * DIKIRIM router ke pelanggan (= download pelanggan). Backend meneruskan nama aslinya
 * (`rxBps`/`txBps`), jadi penerjemahan dilakukan di sini, khusus untuk tampilan.
 */
export function toSample(t: number, rxBps: number, txBps: number): TrafficSample {
  return { t, down: txBps, up: rxBps };
}

/**
 * Menambah sampel baru ke riwayat: membuang yang sudah di luar jendela, dan memulai ulang
 * riwayat bila ada celah panjang (tab sempat tersembunyi / koneksi putus) supaya garis tidak
 * menarik diagonal palsu melintasi celah itu.
 */
export function appendSample(
  prev: TrafficSample[],
  next: TrafficSample,
  intervalMs: number,
): TrafficSample[] {
  const last = prev[prev.length - 1];
  const base = last && next.t - last.t > intervalMs * 5 ? [] : prev;
  return [...base.filter((s) => next.t - s.t <= TRAFFIC_KEEP_MS), next];
}

export interface Trace {
  /** garis sudah punya cukup data untuk digambar */
  hasLine: boolean;
  /** nilai atribut `points` polyline */
  pts: string;
  /** posisi titik ujung garis */
  hx: number;
  hy: number;
  /** data masih baru (belum lewat 3x selang polling) — kalau tidak, denyut ujung garis dimatikan */
  fresh: boolean;
  /** sampel terbaru (untuk angka besar), null bila belum ada data */
  latest: number | null;
  /** puncak dan rata-rata sampel dalam jendela */
  peak: number;
  avg: number;
}

const EMPTY: Trace = {
  hasLine: false,
  pts: '',
  hx: PLOT_W,
  hy: BASE_Y,
  fresh: false,
  latest: null,
  peak: 0,
  avg: 0,
};

/**
 * Membentuk garis dari sampel hasil polling.
 *
 * Sampel datang tiap `intervalMs`, jadi kalau ujung garis langsung digambar ke sampel
 * terbaru, geraknya meloncat. Karena itu ujung garis sengaja TERTUNDA satu selang dan
 * diinterpolasi di antara dua sampel — hasilnya bergerak mulus walau datanya jarang.
 * Sampel terbaru tetap dipakai untuk angka besar, puncak, dan rata-rata.
 */
export function buildTrace(samples: TracePoint[], now: number, intervalMs: number): Trace {
  if (samples.length === 0) return EMPTY;

  const last = samples[samples.length - 1];
  const tHead = now - intervalMs;
  const tStart = tHead - WINDOW_MS;

  let peak = 0;
  let sum = 0;
  let n = 0;
  for (const s of samples) {
    if (s.t >= tStart) {
      if (s.v > peak) peak = s.v;
      sum += s.v;
      n++;
    }
  }
  const avg = n > 0 ? sum / n : 0;
  const fresh = now - last.t <= intervalMs * 3;
  const base: Trace = { ...EMPTY, latest: last.v, peak, avg, fresh };

  // Sampel terakhir yang waktunya sudah dilewati ujung (tertunda) garis.
  let iHead = -1;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i].t <= tHead) {
      iHead = i;
      break;
    }
  }
  // Sampel pertama baru datang; ujung garis (yang tertunda) belum sampai ke sana.
  if (iHead < 0) return base;

  const a = samples[iHead];
  const b = samples[iHead + 1];
  const vHead = b ? a.v + (b.v - a.v) * ((tHead - a.t) / (b.t - a.t)) : a.v;

  // Mulai dari satu sampel sebelum jendela supaya garis masuk dari tepi kiri tanpa celah.
  let iFirst = 0;
  for (let i = 0; i <= iHead; i++) {
    iFirst = i;
    if (samples[i].t >= tStart) {
      iFirst = Math.max(0, i - 1);
      break;
    }
  }

  let max = vHead;
  for (let i = iFirst; i <= iHead; i++) if (samples[i].v > max) max = samples[i].v;
  const scale = Math.max(MIN_SCALE_BPS, max * 1.15);
  const yOf = (v: number) => BASE_Y - (v / scale) * (BASE_Y - TOP_Y);

  const pts: string[] = [];
  for (let i = iFirst; i <= iHead; i++) {
    const x = ((samples[i].t - tStart) / WINDOW_MS) * PLOT_W;
    pts.push(`${x.toFixed(1)},${yOf(samples[i].v).toFixed(1)}`);
  }
  pts.push(`${PLOT_W},${yOf(vHead).toFixed(1)}`);

  return { ...base, hasLine: true, pts: pts.join(' '), hx: PLOT_W, hy: yOf(vHead) };
}

/** Angka dan satuannya dipisah supaya bisa ditampilkan dengan ukuran huruf berbeda. */
export function formatBpsParts(bps: number): { num: string; unit: string } {
  if (bps >= 999_995_000) return { num: (bps / 1e9).toFixed(2), unit: 'Gbps' };
  if (bps >= 999_500) return { num: (bps / 1e6).toFixed(2), unit: 'Mbps' };
  if (bps >= 1_000) return { num: (bps / 1e3).toFixed(0), unit: 'Kbps' };
  return { num: String(Math.round(bps)), unit: 'bps' };
}

export function formatBps(bps: number): string {
  const { num, unit } = formatBpsParts(bps);
  return `${num} ${unit}`;
}
