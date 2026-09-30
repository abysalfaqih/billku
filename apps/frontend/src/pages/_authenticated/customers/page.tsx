import { useState, useRef, useCallback } from 'react';
import { Plus, Search, MoreVertical, Edit2, Trash2, Wifi, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { CustomerForm } from './components/customer-form';
import { useCustomers, useDeleteCustomer } from '@/hooks/useCustomers';
import type { Customer } from '@/types';
import { useAreas } from '@/hooks/useAreas';
import { Link } from 'react-router-dom';
import { useExportCsv } from '@/hooks/useExportCsv';

// ─── Status Tabs ──────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { key: '', label: 'Semua' },
  { key: 'active', label: 'Aktif' },
  { key: 'isolated', label: 'Diisolir' },
  { key: 'suspended', label: 'Ditangguhkan' },
  { key: 'terminated', label: 'Berhenti' },
];

// ─── Row Actions Menu ─────────────────────────────────────────────────────────
function RowMenu({
  customer, onEdit, onDelete,
}: {
  customer: Customer;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleToggle = useCallback(() => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 140) });
    }
    setOpen((p) => !p);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        style={{
          width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
          background: 'var(--surface-2)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-3)',
        }}
      >
        <MoreVertical size={13} />
      </button>

      {open && pos && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 100 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'fixed', top: pos.top, left: pos.left, zIndex: 101,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 4, minWidth: 140,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          }}>
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: 'none', fontSize: 13, color: 'var(--text-2)', textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nav-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <Edit2 size={13} /> Edit
            </button>
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: 'none', fontSize: 13, color: '#EF4444', textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <Trash2 size={13} /> Hapus
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ search }: { search: string }) {
  return (
    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, background: 'var(--surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <Wifi size={24} style={{ color: 'var(--text-3)' }} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>
        {search ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan'}
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
        {search
          ? `Tidak ada hasil untuk "${search}"`
          : 'Tambahkan pelanggan pertama Anda'}
      </p>
    </div>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────
function CustomerRow({
  customer, onEdit, onDelete,
}: {
  customer: Customer;
  onEdit: (c: Customer) => void;
  onDelete: (c: Customer) => void;
}) {
  const statusVariant: Record<string, 'active' | 'isolated' | 'suspended' | 'terminated'> = {
    active: 'active', isolated: 'isolated',
    suspended: 'suspended', terminated: 'terminated',
  };

  return (
    <tr
      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* No Pelanggan */}
      <td style={{ padding: '12px 16px' }}>
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-2)' }}>
          {customer.customerCode ?? '—'}
        </span>
      </td>

      {/* Pelanggan */}
      <td style={{ padding: '12px 16px' }}>
        <div>
          <Link
            to={`/customers/${customer.id}`}
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--nav-active-text)', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            {customer.name}
          </Link>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
            {customer.phone}
          </p>
        </div>
      </td>

      {/* Area */}
      <td style={{ padding: '12px 16px' }}>
        {customer.areaName ? (
          <span style={{
            fontSize: 12,
            background: 'var(--nav-active-bg)',
            color: 'var(--nav-active-text)',
            padding: '2px 8px', borderRadius: 6,
          }}>
            {customer.areaName}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
        )}
      </td>

      {/* Tagihan */}
      <td style={{ padding: '12px 16px' }}>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
          Tgl. {customer.billingDate}
        </span>
      </td>

      {/* Status */}
      <td style={{ padding: '12px 16px' }}>
        <Badge variant={statusVariant[customer.status] ?? 'default'} />
      </td>

      {/* Actions */}
      <td style={{ padding: '12px 16px' }}>
        <RowMenu
          customer={customer}
          onEdit={() => onEdit(customer)}
          onDelete={() => onDelete(customer)}
        />
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [areaId, setAreaId] = useState('');
  const { data: areas } = useAreas(); 
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const { data, isLoading } = useCustomers({
    page, limit: 20, search, status: status || undefined,
    areaId: areaId ? Number(areaId) : undefined,
  });
  const deleteCustomer = useDeleteCustomer();

  const handleSearch = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setSearch(searchInput);
      setPage(1);
    }
  }, [searchInput]);

  const openAdd = () => { setSelectedCustomer(null); setDrawerOpen(true); };
  const openEdit = (c: Customer) => { setSelectedCustomer(c); setDrawerOpen(true); };
  const openDelete = (c: Customer) => setDeleteTarget(c);
  const exportCsv = useExportCsv('/customers/export', `pelanggan-${new Date().toISOString().split('T')[0]}.csv`);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteCustomer.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Page Header */}
        <div style={{
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          padding: '0 24px', flexShrink: 0,
        }}>
          {/* Title row */}
          <div style={{
            minHeight: 60, padding: '10px 0', display: 'flex', flexWrap: 'wrap',
            alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>Pelanggan</h1>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>
                {data?.meta.total ?? 0} total pelanggan terdaftar
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>
                Tambah Pelanggan
              </Button>
              <Button variant="outline" size="sm" icon={<Download size={14} />} loading={exportCsv.loading} onClick={exportCsv.download}>
                Export CSV
              </Button>
            </div> 
          </div>

          {/* Status tabs */}
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setStatus(tab.key); setPage(1); }}
                style={{
                  padding: '10px 16px', fontSize: 13, fontWeight: 500,
                  border: 'none', cursor: 'pointer', background: 'none',
                  borderBottom: `2px solid ${status === tab.key ? '#4F46E5' : 'transparent'}`,
                  color: status === tab.key ? '#4F46E5' : 'var(--text-3)',
                  whiteSpace: 'nowrap', transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div style={{ padding: '16px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
            borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', maxWidth: 400, flex: 1,
          }}>
            <Search size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <input
              type="text" placeholder="Cari nama, nomor HP, email... (Enter)"
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleSearch}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-1)', fontFamily: 'inherit' }}
            />
          </div>

          <select
            value={areaId}
            onChange={(e) => { setAreaId(e.target.value); setPage(1); }}
            style={{
              height: 38, padding: '0 12px', borderRadius: 10, fontSize: 13,
              background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)',
              cursor: 'pointer',
            }}
          >
            <option value="">Semua Area</option>
            {areas?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {/* Table */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '0 24px 24px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
              <Spinner size="lg" />
            </div>
          ) : !data?.data.length ? (
            <EmptyState search={search} />
          ) : (
            <>
              <div style={{
                background: 'var(--surface)', borderRadius: 16,
                border: '1px solid var(--border)', marginTop: 16,
                boxShadow: 'var(--shadow-sm)',
                overflowX: 'auto', WebkitOverflowScrolling: 'touch',
              }}>
                <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['No Pelanggan', 'Pelanggan', 'Area', 'Tgl. Tagihan', 'Status', ''].map((h) => (
                        <th key={h} style={{
                          padding: '10px 16px', textAlign: 'left', fontSize: 11,
                          fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.06em',
                          textTransform: 'uppercase', background: 'var(--surface-2)',
                          whiteSpace: 'nowrap',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((c) => (
                      <CustomerRow
                        key={c.id}
                        customer={c}
                        onEdit={openEdit}
                        onDelete={openDelete}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={page}
                totalPages={data.meta.totalPages}
                total={data.meta.total}
                limit={data.meta.limit}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>

      {/* Drawer */}
      <CustomerForm
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        customer={selectedCustomer}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteCustomer.isPending}
        title="Hapus Pelanggan?"
        description={`Pelanggan "${deleteTarget?.name}" akan dinonaktifkan. Data tagihan dan pembayaran tetap tersimpan.`}
        confirmLabel="Ya, Hapus"
      />
    </>
  );
}