import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Phone, ArrowLeft, Wifi, CheckCircle2, AlertTriangle,
  XCircle, Clock, ChevronDown, ChevronUp, CreditCard,
  MapPin, Calendar, RefreshCw, Shield, User, Wallet,
  History, Receipt, HelpCircle, Bell, Search, LogOut,
  ArrowRight, Smartphone, Globe, Info
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

const C = {
  primary: '#0052FF', // Professional Fintech Blue
  primaryDark: '#003BB3',
  primaryLight: '#E6EFFF',
  secondary: '#050B20', // Deep Navy
  accent: '#00D1FF',
  bg: '#F5F7FA', // Light Grayish Blue
  white: '#FFFFFF',
  success: '#00BA88',
  successBg: '#E6F8F3',
  warning: '#F4A100',
  warningBg: '#FFF8E6',
  danger: '#FF3B30',
  dangerBg: '#FFEBEA',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray600: '#4B5563',
  gray800: '#1F2937',
  text: '#111827',
};

// ─── Types ──────────────────────────────────────────────────────────────────
interface TenantInfo {
  name: string; logoUrl: string | null; motto: string | null;
  phone: string; email: string; address: string | null;
}

interface Bill {
  id: number; billNumber: string; periodStart: string; periodEnd: string;
  dueDate: string; packageName: string; amount: string;
  taxAmount: string; totalAmount: string; status: string; createdAt: string;
}

interface Payment {
  id: number; paidAt: string; amount: string; paymentMethod: string; notes: string | null;
}

interface CustomerData {
  customer: {
    name: string; phone: string; address: string | null;
    status: string; billingDate: number; installationDate: string | null; area: string | null;
  };
  package: { name: string; speedDownload: number; speedUpload: number; price: string; } | null;
  activeBills: Bill[];
  bills: Bill[];
  payments: Payment[];
  tenant: TenantInfo;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatRp(v: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(Number(v));
}

function formatDate(d: string, short = false) {
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric', month: short ? 'short' : 'long', year: 'numeric',
  });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Tunai', transfer: 'Transfer Bank', other: 'Lainnya',
};

const METHOD_ICON: Record<string, any> = {
  cash: Wallet, transfer: CreditCard, other: Smartphone,
};

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Status Config ───────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  active:     { label: 'Aktif',        color: C.success, bg: C.successBg, icon: CheckCircle2 },
  isolated:   { label: 'Terisolir',    color: C.danger,  bg: C.dangerBg,  icon: XCircle },
  suspended:  { label: 'Ditangguhkan', color: C.warning, bg: C.warningBg, icon: AlertTriangle },
  terminated: { label: 'Berhenti',     color: C.gray600, bg: C.gray100,   icon: XCircle },
  paid:       { label: 'Lunas',        color: C.success, bg: C.successBg, icon: CheckCircle2 },
  unpaid:     { label: 'Belum Bayar',  color: C.warning, bg: C.warningBg, icon: Clock },
  overdue:    { label: 'Jatuh Tempo',  color: C.danger,  bg: C.dangerBg,  icon: AlertTriangle },
  cancelled:  { label: 'Dibatalkan',   color: C.gray400, bg: C.gray100,   icon: XCircle },
};

function StatusPill({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = STATUS_CFG[status] ?? STATUS_CFG.cancelled;
  const pad = size === 'sm' ? '4px 10px' : size === 'lg' ? '8px 16px' : '6px 12px';
  const fs = size === 'sm' ? 11 : size === 'lg' ? 14 : 12;
  const Icon = s.icon;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: pad, borderRadius: 12, fontSize: fs, fontWeight: 600,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      <Icon size={size === 'sm' ? 12 : 14} />
      {s.label}
    </span>
  );
}

// ─── Loading ─────────────────────────────────────────────────────────────────
function FullScreenLoader() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: C.bg,
    }}>
      <div style={{
        width: 48, height: 48, border: `4px solid ${C.gray200}`,
        borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 1s linear infinite',
      }} />
      <p style={{ marginTop: 16, fontSize: 14, color: C.gray600, fontWeight: 500 }}>Memuat...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Lookup Screen ───────────────────────────────────────────────────────────
function LookupScreen({
  tenant, onSubmit, loading, error,
}: {
  tenant: TenantInfo;
  onSubmit: (phone: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const [phone, setPhone] = useState('');
  const [focused, setFocused] = useState(false);
  const ready = phone.replace(/\D/g, '').length >= 9;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && ready) onSubmit(phone);
  };

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Top Banner - Fintech Style */}
      <div style={{
        width: '100%', maxWidth: 500, background: C.secondary, padding: '60px 24px 80px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
        borderBottomLeftRadius: 40, borderBottomRightRadius: 40,
      }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(0,82,255,0.1)' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(0,209,255,0.05)' }} />
        
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24, margin: '0 auto 20px',
            background: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 24px rgba(0,0,0,0.2)', overflow: 'hidden',
          }}>
            {tenant.logoUrl
              ? <img src={tenant.logoUrl} alt="logo" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
              : <Wifi size={36} color={C.primary} />
            }
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.white, marginBottom: 8 }}>{tenant.name}</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Portal Pelanggan</p>
        </div>
      </div>

      {/* Login Card */}
      <div style={{
        width: '90%', maxWidth: 420, background: C.white, borderRadius: 32,
        marginTop: -50, padding: '32px 24px', boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
        position: 'relative', zIndex: 10,
      }}>
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>Cek Tagihan</h2>
          <p style={{ fontSize: 14, color: C.gray600 }}>Masukkan nomor ponsel yang terdaftar</p>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.gray400, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Nomor Ponsel
          </label>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, height: 64, padding: '0 20px',
            borderRadius: 16, background: C.gray50, border: `2px solid ${error ? C.danger : focused ? C.primary : 'transparent'}`,
            transition: 'all 0.2s ease',
          }}>
            <Phone size={20} color={focused ? C.primary : C.gray400} />
            <input
              type="tel" inputMode="numeric" placeholder="08xxxxxxxxxx"
              value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 13))}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onKeyDown={handleKeyDown}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 18, fontWeight: 600, color: C.text, width: '100%',
              }}
            />
          </div>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: C.danger }}>
              <AlertTriangle size={14} />
              <p style={{ fontSize: 12, fontWeight: 500 }}>{error}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => ready && !loading && onSubmit(phone)}
          disabled={!ready || loading}
          style={{
            width: '100%', height: 64, borderRadius: 16, border: 'none',
            background: ready ? C.primary : C.gray200,
            color: ready ? C.white : C.gray400,
            fontSize: 16, fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all 0.3s ease',
            boxShadow: ready ? '0 10px 20px rgba(0,82,255,0.2)' : 'none',
          }}
        >
          {loading ? (
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <>
              <span>Lanjutkan</span>
              <ArrowRight size={20} />
            </>
          )}
        </button>

        <div style={{
          marginTop: 32, padding: 16, borderRadius: 16, background: C.primaryLight,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Shield size={20} color={C.primary} />
          <p style={{ fontSize: 12, color: C.primaryDark, fontWeight: 600, lineHeight: 1.4 }}>
            Data pribadi Anda terlindungi sepenuhnya.
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div style={{ marginTop: 'auto', padding: '40px 24px', textAlign: 'center', width: '100%' }}>
        <p style={{ fontSize: 13, color: C.gray400, marginBottom: 16 }}>Butuh bantuan atau informasi lebih lanjut?</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
          {tenant.phone && (
            <a href={`tel:${tenant.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.primary, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
              <Phone size={16} /> Hubungi Kami
            </a>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.gray600, fontSize: 14, fontWeight: 600 }}>
            <Globe size={16} /> Bantuan
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Dashboard Screen ────────────────────────────────────────────────────────
function DashboardScreen({ data, onBack }: { data: CustomerData; onBack: () => void }) {
  const { customer, package: pkg, activeBills, bills, payments, tenant } = data;
  const [tab, setTab] = useState<'tagihan' | 'bayar'>('tagihan');
  const [expanded, setExpanded] = useState<number | null>(null);

  const totalUnpaid = activeBills.reduce((s, b) => s + Number(b.totalAmount), 0);

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Dashboard Header */}
      <div style={{
        background: C.secondary, padding: '24px 24px 60px', color: C.white,
        borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.white }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Pelanggan</p>
            <p style={{ fontSize: 14, fontWeight: 700 }}>{customer.name}</p>
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Total Tagihan</p>
          <h2 style={{ fontSize: 32, fontWeight: 800 }}>{formatRp(totalUnpaid)}</h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusPill status={customer.status} size="sm" />
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{pkg?.name ?? 'Tanpa Paket'}</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '0 20px 40px', marginTop: -30, flex: 1, maxWidth: 800, margin: '-30px auto 0', width: '100%' }}>
        {/* Quick Info Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: C.white, padding: 20, borderRadius: 24, boxShadow: '0 10px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Wifi size={20} color={C.primary} />
            </div>
            <p style={{ fontSize: 12, color: C.gray400, marginBottom: 4 }}>Koneksi</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{pkg ? `${pkg.speedDownload} Mbps` : '-'}</p>
          </div>
          <div style={{ background: C.white, padding: 20, borderRadius: 24, boxShadow: '0 10px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: C.warningBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Calendar size={20} color={C.warning} />
            </div>
            <p style={{ fontSize: 12, color: C.gray400, marginBottom: 4 }}>Siklus Tagihan</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Tgl {customer.billingDate}</p>
          </div>
        </div>

        {/* Unpaid Bills Section */}
        {activeBills.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Tagihan Aktif</h3>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.danger, background: C.dangerBg, padding: '4px 8px', borderRadius: 8 }}>{activeBills.length} Perlu Dibayar</span>
            </div>
            {activeBills.map(bill => {
              const days = daysUntil(bill.dueDate);
              const isOverdue = days < 0;
              return (
                <div key={bill.id} style={{ background: C.white, borderRadius: 24, padding: 20, marginBottom: 12, border: `1px solid ${isOverdue ? C.danger + '22' : 'transparent'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <p style={{ fontSize: 12, color: C.gray400, marginBottom: 2 }}>No. Tagihan</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{bill.billNumber}</p>
                    </div>
                    <StatusPill status={bill.status} size="sm" />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <p style={{ fontSize: 12, color: C.gray600, marginBottom: 4 }}>
                        Periode: {formatDate(bill.periodStart, true)} - {formatDate(bill.periodEnd, true)}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isOverdue ? C.danger : C.warning }}>
                        <Clock size={14} />
                        <p style={{ fontSize: 12, fontWeight: 600 }}>
                          {isOverdue ? `Terlambat ${Math.abs(days)} hari` : days === 0 ? 'Jatuh tempo hari ini' : `Jatuh tempo ${days} hari lagi`}
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 20, fontWeight: 800, color: C.primary }}>{formatRp(bill.totalAmount)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabs for History */}
        <div style={{ background: C.white, borderRadius: 28, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', padding: 8, gap: 8, background: C.gray50 }}>
            <button
              onClick={() => setTab('tagihan')}
              style={{
                flex: 1, height: 48, borderRadius: 20, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: tab === 'tagihan' ? C.white : 'transparent',
                color: tab === 'tagihan' ? C.primary : C.gray400,
                fontWeight: 700, fontSize: 14, transition: 'all 0.2s',
                boxShadow: tab === 'tagihan' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              <Receipt size={18} />
              <span>Tagihan</span>
            </button>
            <button
              onClick={() => setTab('bayar')}
              style={{
                flex: 1, height: 48, borderRadius: 20, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: tab === 'bayar' ? C.white : 'transparent',
                color: tab === 'bayar' ? C.primary : C.gray400,
                fontWeight: 700, fontSize: 14, transition: 'all 0.2s',
                boxShadow: tab === 'bayar' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              <History size={18} />
              <span>Riwayat</span>
            </button>
          </div>

          <div style={{ padding: '8px 0' }}>
            {tab === 'tagihan' ? (
              bills.length === 0 ? (
                <EmptyState icon={Receipt} text="Belum ada riwayat tagihan" />
              ) : (
                bills.map((bill, i) => {
                  const isEx = expanded === bill.id;
                  return (
                    <div key={bill.id} style={{ borderBottom: i < bills.length - 1 ? `1px solid ${C.gray100}` : 'none' }}>
                      <button
                        onClick={() => setExpanded(isEx ? null : bill.id)}
                        style={{ width: '100%', padding: '20px 24px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}
                      >
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: STATUS_CFG[bill.status]?.bg ?? C.gray100, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {(() => {
                            const Icon = STATUS_CFG[bill.status]?.icon ?? Info;
                            return <Icon size={20} color={STATUS_CFG[bill.status]?.color ?? C.gray400} />;
                          })()}
                        </div>
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{bill.packageName}</p>
                          <p style={{ fontSize: 12, color: C.gray400 }}>{formatDate(bill.periodStart, true)} - {formatDate(bill.periodEnd, true)}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4 }}>{formatRp(bill.totalAmount)}</p>
                          <StatusPill status={bill.status} size="sm" />
                        </div>
                        <div style={{ color: C.gray200 }}>{isEx ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
                      </button>
                      {isEx && (
                        <div style={{ padding: '0 24px 20px', background: C.gray50 }}>
                          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.gray100}`, overflow: 'hidden' }}>
                            {[
                              { label: 'No. Tagihan', value: bill.billNumber, mono: true },
                              { label: 'Jatuh Tempo', value: formatDate(bill.dueDate) },
                              { label: 'Harga Paket', value: formatRp(bill.amount) },
                              ...(Number(bill.taxAmount) > 0 ? [{ label: 'PPN', value: formatRp(bill.taxAmount) }] : []),
                              { label: 'Total Pembayaran', value: formatRp(bill.totalAmount), highlight: true },
                            ].map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: idx < 4 ? `1px solid ${C.gray50}` : 'none' }}>
                                <span style={{ fontSize: 12, color: C.gray400, fontWeight: 500 }}>{item.label}</span>
                                <span style={{ fontSize: item.highlight ? 14 : 12, fontWeight: item.highlight ? 800 : 600, color: item.highlight ? C.primary : C.text, fontFamily: item.mono ? 'monospace' : 'inherit' }}>{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )
            ) : (
              payments.length === 0 ? (
                <EmptyState icon={History} text="Belum ada riwayat pembayaran" />
              ) : (
                payments.map((pay, i) => {
                  const Icon = METHOD_ICON[pay.paymentMethod] ?? Wallet;
                  return (
                    <div key={pay.id} style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: i < payments.length - 1 ? `1px solid ${C.gray100}` : 'none' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: C.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={20} color={C.success} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{METHOD_LABEL[pay.paymentMethod] ?? pay.paymentMethod}</p>
                        <p style={{ fontSize: 12, color: C.gray400 }}>{formatDateTime(pay.paidAt)}</p>
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 800, color: C.success }}>{formatRp(pay.amount)}</p>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* Support Section */}
        <div style={{ marginTop: 32, background: C.white, borderRadius: 24, padding: 24, display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HelpCircle size={28} color={C.primary} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Butuh Bantuan?</h4>
            <p style={{ fontSize: 13, color: C.gray600 }}>Hubungi layanan pelanggan kami jika ada kendala pembayaran.</p>
          </div>
          <a href={`https://wa.me/${tenant.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ padding: '10px 20px', borderRadius: 12, background: C.primary, color: C.white, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
            WhatsApp
          </a>
        </div>
      </div>

      {/* Desktop Footer */}
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: C.gray400 }}>&copy; 2024 {tenant.name}. All rights reserved.</p>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 24, background: C.gray50, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Icon size={32} color={C.gray200} />
      </div>
      <p style={{ fontSize: 14, color: C.gray400, fontWeight: 500 }}>{text}</p>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function PortalPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [tenantError, setTenantError] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/portal/${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setTenant(d); document.title = `${d.name} — Payment Portal`; })
      .catch(() => setTenantError(true));
  }, [slug]);

  const handleLookup = useCallback(async (phone: string) => {
    setLoading(true);
    setLookupError(null);
    try {
      const res = await fetch(`${API}/portal/${slug}/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const err = await res.json();
        setLookupError(err.message ?? 'Nomor tidak ditemukan');
        return;
      }
      setCustomerData(await res.json());
    } catch {
      setLookupError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  if (tenantError) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: C.bg, padding: 24, textAlign: 'center',
      }}>
        <div style={{ width: 80, height: 80, borderRadius: 32, background: C.dangerBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <XCircle size={40} color={C.danger} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 8 }}>Halaman Tidak Ditemukan</h2>
        <p style={{ fontSize: 15, color: C.gray600, maxWidth: 300, lineHeight: 1.6 }}>
          Portal untuk layanan <span style={{ color: C.primary, fontWeight: 700 }}>{slug}</span> tidak tersedia atau telah dinonaktifkan.
        </p>
      </div>
    );
  }

  if (!tenant) return <FullScreenLoader />;

  if (customerData) {
    return (
      <DashboardScreen
        data={customerData}
        onBack={() => { setCustomerData(null); setLookupError(null); }}
      />
    );
  }

  return (
    <LookupScreen
      tenant={tenant}
      onSubmit={handleLookup}
      loading={loading}
      error={lookupError}
    />
  );
}
