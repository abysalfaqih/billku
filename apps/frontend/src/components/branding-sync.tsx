import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTenantProfile } from '@/hooks/useTenantProfile';

export function BrandingSync() {
  const { data } = useTenantProfile();
  const pathname = useLocation().pathname;
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    if (!data?.name) return;

    const brandName = data.name;
    const faviconUrl = data.faviconUrl;

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

    // Hentikan observer lama kalau ada
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Watch: Next.js sering ganti <title> saat navigasi — kita kembalikan setiap kali berubah
    const titleEl = document.head.querySelector('title');
    if (titleEl) {
      const observer = new MutationObserver(() => {
        applyTitle();
      });
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
      observerRef.current = observer;
    }

    // Fallback: cek ulang setelah 300ms (Next.js selesai render metadata)
    const timeout = setTimeout(() => {
      applyTitle();
      applyFavicon();
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [data, pathname]); // ← re-run setiap pindah halaman

  return null;
}