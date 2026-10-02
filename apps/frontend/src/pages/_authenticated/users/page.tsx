import { Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, UserCog, Power, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { UserForm } from './components/user-form';
import { useUsers, useToggleUserActive, useDeleteUser } from '@/hooks/useUsers';
import type { UserRow } from '@/hooks/useUsers';
import { useAuthStore } from '@/stores/auth.store';

const ROLE_LABEL: Record<string, string> = { super_admin: 'Super Admin', admin: 'Admin', staff: 'Staff' };

function UsersContent() {
  const [params] = useSearchParams();
  const tenantId = params.get('tenantId') ?? undefined;
  const { user: currentUser } = useAuthStore();
  const { data: users, isLoading } = useUsers(tenantId);
  const toggleActive = useToggleUserActive(tenantId);
  const deleteUser = useDeleteUser(tenantId);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const openAdd = () => { setSelectedUser(null); setFormOpen(true); };
  const openEdit = (u: UserRow) => { setSelectedUser(u); setFormOpen(true); };

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Pengguna</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
            {tenantId ? 'Kelola admin/staff untuk mitra ini' : 'Kelola admin/staff di tim Anda'}
          </p>
        </div>
        <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>
          Tambah Pengguna
        </Button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <Spinner size="lg" />
        </div>
      ) : !users?.length ? (
        <div style={{
          textAlign: 'center', padding: '60px 24px',
          background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
        }}>
          <UserCog size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>Belum ada pengguna</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Tambahkan admin atau staff pertama</p>
          <Button size="sm" icon={<Plus size={14} />} onClick={openAdd} style={{ marginTop: 16 }}>
            Tambah Pengguna
          </Button>
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Nama', 'Email', 'Role', 'Login Terakhir', 'Status', ''].map((h) => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', fontSize: 11,
                    fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.05em',
                    textTransform: 'uppercase', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.userId;
                const isSuperAdmin = u.role === 'super_admin';

                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 9,
                          background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
                        }}>
                          {u.name[0]?.toUpperCase()}
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                          {u.name} {isSelf && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(Anda)</span>}
                        </p>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{u.email}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={u.role === 'super_admin' ? 'info' : u.role === 'admin' ? 'success' : 'default'}>
                        {ROLE_LABEL[u.role]}
                      </Badge>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('id-ID') : 'Belum pernah'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={u.isActive ? 'active' : 'terminated'}>{u.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {!isSuperAdmin && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => openEdit(u)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4,
                              padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)',
                              background: 'var(--surface-2)', cursor: 'pointer',
                              fontSize: 12, color: 'var(--text-2)',
                            }}
                          >
                            <Edit2 size={11} /> Edit
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => toggleActive.mutate(u.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)',
                                background: 'var(--surface-2)', cursor: 'pointer',
                                fontSize: 12, color: 'var(--text-2)',
                              }}
                            >
                              <Power size={11} /> {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                          )}
                          {!isSelf && (
                            <button
                              onClick={() => setDeleteTarget(u)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)',
                                background: 'var(--surface-2)', cursor: 'pointer',
                                fontSize: 12, color: '#EF4444',
                              }}
                            >
                              <Trash2 size={11} /> Hapus
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <UserForm open={formOpen} onClose={() => setFormOpen(false)} tenantId={tenantId} user={selectedUser} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteUser.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
        loading={deleteUser.isPending}
        title="Hapus Pengguna Permanen?"
        description={`Akun "${deleteTarget?.name}" akan dihapus PERMANEN dan tidak bisa dikembalikan. Riwayat pembayaran/aktivitas yang pernah dibuat pengguna ini tetap tersimpan, tapi tidak lagi tertaut ke akunnya.`}
        confirmLabel="Hapus Permanen"
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Memuat...</div>}>
      <UsersContent />
    </Suspense>
  );
}