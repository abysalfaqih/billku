import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 8,
      background: 'var(--bg)', textAlign: 'center', padding: 24,
    }}>
      <p style={{ fontSize: 48, fontWeight: 800, color: 'var(--text-1)' }}>404</p>
      <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 16 }}>
        Halaman yang Anda cari tidak ditemukan.
      </p>
      <Link
        to="/dashboard"
        style={{
          fontSize: 13, fontWeight: 600, color: '#4F46E5', textDecoration: 'none',
          padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)',
        }}
      >
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
