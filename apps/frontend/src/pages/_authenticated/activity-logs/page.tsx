import { useState } from 'react';
import { ClipboardList, ChevronRight } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { Spinner } from '@/components/ui/spinner';
import { Drawer } from '@/components/ui/drawer';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import type { ActivityLog } from '@/types';

const METHOD_COLOR: Record<string, { bg: string; color: string }> = {
  POST:   { bg: 'rgba(16,185,129,0.1)', color: '#059669' },
  PUT:    { bg: 'rgba(245,158,11,0.1)', color: '#D97706' },
  DELETE: { bg: 'rgba(239,68,68,0.1)',  color: '#DC2626' },
  GET:    { bg: 'rgba(99,102,241,0.1)', color: '#4F46E5' },
};

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// Baris label-value dipakai berkali-kali di panel detail
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '10px 0', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <div style={{ fontSize: 13, color: 'var(--text-1)' }}>{children}</div>
    </div>
  );
}

export default function ActivityLogsPage() {
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const { data, isLoading } = useActivityLogs({ page, limit: 50 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', flexShrink: 0, height: 60, display: 'flex', alignItems: 'center',
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>Activity Log</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
            {data?.meta.total ?? 0} aktivitas tercatat
          </p>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '16px 24px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Spinner size="lg" />
          </div>
        ) : !data?.data.length ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
          }}>
            <ClipboardList size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>Belum ada aktivitas</p>
          </div>
        ) : (
          <>
            <div style={{
              background: 'var(--surface)', borderRadius: 16,
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
              overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            }}>
              <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    {['Waktu', 'Pengguna', 'Aksi', 'Target', 'Method', 'IP Address', 'Status', 'Durasi', ''].map((h) => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left', fontSize: 11,
                        fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.05em',
                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((log) => {
                    const mc = METHOD_COLOR[log.method] ?? METHOD_COLOR.GET;
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                            {formatDateTime(log.createdAt)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                            {log.userEmail ?? <span style={{ color: 'var(--text-3)' }}>Sistem</span>}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          {log.targetId ? (
                            <span style={{
                              fontSize: 11, fontFamily: 'monospace', padding: '2px 8px',
                              borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-2)',
                            }}>
                              #{log.targetId}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                            background: mc.bg, color: mc.color,
                          }}>
                            {log.method}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-3)' }}>
                            {log.ipAddress ?? '—'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{
                            fontSize: 12, fontWeight: 600,
                            color: log.statusCode < 400 ? '#059669' : '#DC2626',
                          }}>
                            {log.statusCode}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{log.durationMs}ms</span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page} totalPages={data.meta.totalPages}
              total={data.meta.total} limit={data.meta.limit}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* Panel detail — muncul saat baris di-klik, isinya termasuk target id & metadata
          (body request yang sudah disensor di backend untuk field password/secret/token/dst) */}
      <Drawer
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog?.action ?? 'Detail Aktivitas'}
        subtitle={selectedLog ? formatDateTime(selectedLog.createdAt) : undefined}
        width={440}
      >
        {selectedLog && (
          <div>
            <DetailRow label="Pengguna">
              {selectedLog.userEmail ?? <span style={{ color: 'var(--text-3)' }}>Sistem</span>}
            </DetailRow>

            <DetailRow label="Endpoint">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: (METHOD_COLOR[selectedLog.method] ?? METHOD_COLOR.GET).bg,
                  color: (METHOD_COLOR[selectedLog.method] ?? METHOD_COLOR.GET).color,
                }}>
                  {selectedLog.method}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                  {selectedLog.path}
                </span>
              </span>
            </DetailRow>

            {selectedLog.targetId && (
              <DetailRow label="ID Target">
                <span style={{
                  fontFamily: 'monospace', fontSize: 12, padding: '2px 8px',
                  borderRadius: 6, background: 'var(--surface-2)',
                }}>
                  #{selectedLog.targetId}
                </span>
              </DetailRow>
            )}

            <DetailRow label="Status & Durasi">
              <span style={{ color: selectedLog.statusCode < 400 ? '#059669' : '#DC2626', fontWeight: 600 }}>
                {selectedLog.statusCode}
              </span>
              <span style={{ color: 'var(--text-3)' }}> · {selectedLog.durationMs}ms</span>
            </DetailRow>

            <DetailRow label="Alamat IP">
              <span style={{ fontFamily: 'monospace' }}>{selectedLog.ipAddress ?? '—'}</span>
            </DetailRow>

            <DetailRow label="User Agent">
              <span style={{ fontSize: 12, color: 'var(--text-2)', wordBreak: 'break-all' }}>
                {selectedLog.userAgent ?? '—'}
              </span>
            </DetailRow>

            <DetailRow label="Data Perubahan">
              {selectedLog.metadata ? (
                <pre style={{
                  margin: 0, fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all', background: 'var(--surface-2)', padding: 12,
                  borderRadius: 8, border: '1px solid var(--border)', maxHeight: 320, overflowY: 'auto',
                }}>
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              ) : (
                <span style={{ color: 'var(--text-3)' }}>Tidak ada data tambahan</span>
              )}
            </DetailRow>
          </div>
        )}
      </Drawer>
    </div>
  );
}