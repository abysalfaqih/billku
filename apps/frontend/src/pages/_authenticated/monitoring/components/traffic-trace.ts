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
const SCALE_HEADROOM = 1.08; // ruang kecil di atas puncak data agar garis tidak menempel di batas atas

/** Garis tengah grafik (setengah skala). */
export const MID_Y = (TOP_Y + BASE_Y) / 2;

/** Posisi vertikal (koordinat SVG) untuk kecepatan `v` pada skala `scale`. */
export function yFor(v: number, scale: number): number {
  return BASE_Y - (v / scale) * (BASE_Y - TOP_Y);
}

/**
 * Pembulatan ke atas ke angka yang enak dibaca (1, 2, 4, 5, 8 × 10^n). Dipakai sebagai nilai
 * garis batas teratas, sehingga garis skala selalu bernilai bulat (mis. 10 / 5 / 0 Mbps).
 */
export function niceCeil(x: number): number {
  if (!(x > 0)) return MIN_SCALE_BPS;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  for (const m of [1, 2, 4, 5, 8, 10]) {
    if (m * p >= x * (1 - 1e-9)) return m * p;
  }
  return 10 * p;
}

/**
 * Memilih skala grafik. Naik seketika bila data melampauinya, tetapi baru turun bila data sudah
 * kurang dari separuhnya — supaya garis skala tidak berkedip-kedip tiap kali polling.
 */
export function pickScale(prev: number | null, max: number): number {
  const need = Math.max(MIN_SCALE_BPS, niceCeil(max * SCALE_HEADROOM));
  if (prev === null || need > prev || need < prev * 0.5) return need;
  return prev;
}

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
  /** skala yang dipakai (bit/detik di garis batas teratas); garis tengah = setengahnya */
  scale: number;
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
  scale: MIN_SCALE_BPS,
};

/**
 * Membentuk garis dari sampel hasil polling.
 *
 * Sampel datang tiap `intervalMs`, jadi kalau ujung garis langsung digambar ke sampel
 * terbaru, geraknya meloncat. Karena itu ujung garis sengaja TERTUNDA satu selang dan
 * diinterpolasi di antara dua sampel — hasilnya bergerak mulus walau datanya jarang.
 * Sampel terbaru tetap dipakai untuk angka besar, puncak, dan rata-rata.
 */
export function buildTrace(
  samples: TracePoint[],
  now: number,
  intervalMs: number,
  prevScale: number | null = null,
): Trace {
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
  const base: Trace = { ...EMPTY, latest: last.v, peak, avg, fresh, scale: prevScale ?? MIN_SCALE_BPS };

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
  const scale = pickScale(prevScale, max);
  const yOf = (v: number) => yFor(v, scale);

  const pts: string[] = [];
  for (let i = iFirst; i <= iHead; i++) {
    const x = ((samples[i].t - tStart) / WINDOW_MS) * PLOT_W;
    pts.push(`${x.toFixed(1)},${yOf(samples[i].v).toFixed(1)}`);
  }
  pts.push(`${PLOT_W},${yOf(vHead).toFixed(1)}`);

  return { ...base, hasLine: true, pts: pts.join(' '), hx: PLOT_W, hy: yOf(vHead), scale };
}

export interface Probe {
  /** posisi titik di grafik (koordinat SVG) */
  x: number;
  y: number;
  /** kecepatan di titik itu (bit/detik) */
  v: number;
  /** berapa detik sebelum tepi kanan grafik ("sekarang") */
  ageSec: number;
}

/**
 * Nilai garis pada posisi horizontal `x` (koordinat SVG) — untuk info saat kursor diarahkan.
 * Memakai interpolasi yang sama dengan `buildTrace`, jadi titik yang ditunjuk selalu tepat
 * berada di garis yang tergambar. Null bila di posisi itu belum ada data.
 */
export function probeAt(
  samples: TracePoint[],
  now: number,
  intervalMs: number,
  x: number,
  scale: number,
): Probe | null {
  if (samples.length === 0) return null;
  const px = Math.min(PLOT_W, Math.max(0, x));
  const tau = now - intervalMs - ((PLOT_W - px) / PLOT_W) * WINDOW_MS;
  if (tau < samples[0].t) return null;

  let v = samples[samples.length - 1].v;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i].t <= tau) {
      const a = samples[i];
      const b = samples[i + 1];
      v = b ? a.v + (b.v - a.v) * ((tau - a.t) / (b.t - a.t)) : a.v;
      break;
    }
  }
  return {
    x: px,
    y: yFor(v, scale),
    v,
    ageSec: Math.round(((PLOT_W - px) / PLOT_W) * (WINDOW_MS / 1000)),
  };
}

/** Angka di garis skala: bulat dan ringkas ("10 Mbps", "2.5 Mbps", "500 Kbps", "0"). */
export function formatAxis(bps: number): string {
  if (bps <= 0) return '0';
  if (bps >= 1e9) return `${+(bps / 1e9).toFixed(2)} Gbps`;
  if (bps >= 1e6) return `${+(bps / 1e6).toFixed(2)} Mbps`;
  if (bps >= 1e3) return `${+(bps / 1e3).toFixed(1)} Kbps`;
  return `${Math.round(bps)} bps`;
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
