import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTenantProfile } from '@/hooks/useTenantProfile';

// Browser MERAPIKAN spasi pada document.title: spasi di awal/akhir dibuang, dan
// deretan spasi/tab/baris-baru dijadikan satu spasi. Kalau nama mitra
// mengandung spasi ganda atau spasi di ujung (mis. "Tenjo  Net " — sangat
// mudah terjadi saat mengetik), maka `document.title !== nama` SELALU benar:
// observer menulis ulang title → memicu observer lagi → menulis ulang … tanpa
// henti. Tab membeku total (loading berputar, tidak bisa diklik) di semua
// perangkat yang membuka mitra itu. Karena itu nama dirapikan dengan aturan
// yang sama SEBELUM ditulis dan dibandingkan.
export function normalizeTitle(raw: string): string {
  return raw.replace(/[\t\n\f\r ]+/g, ' ').trim();
}

// Batas pengaman: kalau karena sebab apa pun <title> berubah lebih dari ini
// dalam 1 detik, observer dihentikan — jangan pernah sampai membekukan tab.
const MAX_TITLE_REAPPLY_PER_SECOND = 20;

export function BrandingSync() {
  const { data } = useTenantProfile();
  const pathname = useLocation().pathname;

  useEffect(() => {
    const brandName = data?.name ? normalizeTitle(data.name) : '';
    if (!brandName) return;

    const faviconUrl = data?.faviconUrl;

    const applyTitle = () => {
      if (document.title !== brandName) {
        document.title = brandName;
      }
    };

    const applyFavicon = () => {
      if (!faviconUrl) return;
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      if (link.href !== faviconUrl) {
        link.href = faviconUrl;
      }
    };

    // Apply langsung
    applyTitle();
    applyFavicon();

    // Watch: halaman lain bisa saja mengganti <title> saat navigasi — kita kembalikan setiap kali berubah
    let observer: MutationObserver | null = null;
    const titleEl = document.head.querySelector('title');
    if (titleEl) {
      let windowStart = Date.now();
      let count = 0;
      observer = new MutationObserver(() => {
        const now = Date.now();
        if (now - windowStart > 1000) {
          windowStart = now;
          count = 0;
        }
        if (++count > MAX_TITLE_REAPPLY_PER_SECOND) {
          observer?.disconnect();
          console.warn('BrandingSync: <title> berubah terlalu sering, observer dihentikan');
          return;
        }
        applyTitle();
      });
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    // Fallback: cek ulang setelah 300ms (kalau ada yang menimpa title/favicon saat halaman selesai render)
    const timeout = setTimeout(() => {
      applyTitle();
      applyFavicon();
    }, 300);

    return () => {
      clearTimeout(timeout);
      // Lepas observer saat komponen dilepas / efek dijalankan ulang — dulu observer
      // lama baru dilepas di efek berikutnya, dan tidak pernah dilepas saat logout.
      observer?.disconnect();
    };
  }, [data, pathname]); // ← re-run setiap pindah halaman

  return null;
}
