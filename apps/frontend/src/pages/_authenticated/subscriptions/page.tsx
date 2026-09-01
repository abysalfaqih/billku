import { useState } from 'react';
import { Plus, Layers, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { AssignDialog } from './components/assign-dialog';
import { PlanForm } from './components/plan-form';
import {
  useTenantSubscriptions, useSubscriptionPlans, useDeletePlan,
} from '@/hooks/useSubscriptions';
import type { SubscriptionPlan } from '@/types';

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const STATUS_VARIANT: Record<string, 'active' | 'isolated' | 'suspended' | 'terminated'> = {
  active: 'active', expired: 'isolated', trial: 'suspended', cancelled: 'terminated',
};

function PlanCard({
  plan, onEdit, onDelete,
}: {
  plan: SubscriptionPlan;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const limitText = (v: number) => (v === -1 ? 'Unlimited' : v.toLocaleString('id-ID'));

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: 16, position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{plan.name}</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#4F46E5', marginTop: 4 }}>
            Rp {Number(plan.priceMonthly).toLocaleString('id-ID')}
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)' }}>/bulan</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={onEdit}
            style={{
              width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Edit2 size={11} />
          </button>
          <button
            onClick={onDelete}
            style={{
              width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--surface-2)', cursor: 'pointer', color: '#EF4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 6 }}>
          {limitText(plan.maxCustomers)} pelanggan
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 6 }}>
          {limitText(plan.maxMikrotik)} Mikrotik
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {plan.hasWhatsapp && <Badge variant="info">WA</Badge>}
        {plan.hasReports && <Badge variant="info">Laporan</Badge>}
        {plan.hasApiAccess && <Badge variant="info">API</Badge>}
      </div>
    </div>
  );
}

export default function SubscriptionsPage() {
  const { data: rows, isLoading } = useTenantSubscriptions();
  const { data: plans } = useSubscriptionPlans();
  const deletePlan = useDeletePlan();

  const [assignOpen, setAssignOpen] = useState(false);
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null);

  const planName = (id: number | null) => plans?.find((p) => p.id === id)?.name ?? '—';

  const openAddPlan = () => { setSelectedPlan(null); setPlanFormOpen(true); };
  const openEditPlan = (p: SubscriptionPlan) => { setSelectedPlan(p); setPlanFormOpen(true); };

  return (
    <>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Langganan Mitra</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
              Kelola paket dan status berlangganan platform
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={openAddPlan}>
              Buat Paket
            </Button>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setAssignOpen(true)}>
              Aktifkan Langganan
            </Button>
          </div>
        </div>

        {/* Plan cards */}
        {plans && plans.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12, marginBottom: 24,
          }}>
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                onEdit={() => openEditPlan(p)}
                onDelete={() => setDeleteTarget(p)}
              />
            ))}
          </div>
        )}

        {/* Tenant subscriptions table */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Spinner size="lg" />
          </div>
        ) : !rows?.length ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
          }}>
            <Layers size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>Belum ada mitra</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
              Tambahkan mitra terlebih dahulu di halaman Mitra
            </p>
          </div>
        ) : (
          <div style={{
            background: 'var(--surface)', borderRadius: 16,
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          }}>
            <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['Mitra', 'Paket', 'Status', 'Berakhir', 'Sisa Hari'].map((h) => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left', fontSize: 11,
                      fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.05em',
                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const left = daysLeft(row.expiresAt);
                  return (
                    <tr key={row.tenantId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{row.tenantName}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>{row.tenantSlug}</p>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{planName(row.planId)}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {row.status ? (
                          <Badge variant={STATUS_VARIANT[row.status] ?? 'default'}>
                            {row.status === 'active' ? 'Aktif' : row.status === 'expired' ? 'Habis' : row.status === 'trial' ? 'Trial' : 'Dibatalkan'}
                          </Badge>
                        ) : (
                          <Badge variant="default">Belum Berlangganan</Badge>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{formatDate(row.expiresAt)}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {left !== null && (
                          <span style={{
                            fontSize: 12, fontWeight: 600,
                            color: left < 7 ? '#EF4444' : left < 30 ? '#F59E0B' : '#059669',
                          }}>
                            {left > 0 ? `${left} hari` : 'Habis'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AssignDialog open={assignOpen} onClose={() => setAssignOpen(false)} />

      <PlanForm
        open={planFormOpen}
        onClose={() => setPlanFormOpen(false)}
        plan={selectedPlan}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deletePlan.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
        loading={deletePlan.isPending}
        title="Nonaktifkan Paket?"
        description={`Paket "${deleteTarget?.name}" akan disembunyikan. Mitra yang sudah pakai paket ini tidak terpengaruh.`}
        confirmLabel="Nonaktifkan"
      />
    </>
  );
}