export interface AuthUser {
  userId: number;
  tenantId: string;
  role: 'super_admin' | 'admin' | 'staff';
  email: string;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  path: string;
  timestamp: string;
}

// Customer
export interface Customer {
  id: number;
  tenantId: string;
  packageId: number | null;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  nik: string | null;
  usernamePppoe: string | null;
  ipAddress: string | null;
  billingDate: number;
  installationDate: string | null;
  status: 'active' | 'isolated' | 'suspended' | 'terminated';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  areaId: number | null;
  taxEnabled: boolean;
  taxPercent: string | null;
  areaName?: string | null;
  connectionType: 'pppoe' | 'hotspot';
  mikrotikConfigId: number | null;
  hotspotProfile: string | null;
}

// Package
export interface Package {
  id: number;
  tenantId: string;
  ipPoolId: number | null;
  name: string;
  description: string | null;
  speedDownload: number;
  speedUpload: number;
  price: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Bill
export interface Bill {
  id: number;
  tenantId: string;
  customerId: number;
  customerName: string | null;
  billNumber: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amount: string;
  packageName: string;
  status: 'unpaid' | 'paid' | 'overdue' | 'cancelled';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  taxPercent: string | null;
  taxAmount: string;
  totalAmount: string;
}

// Payment
export interface Payment {
  id: number;
  tenantId: string;
  billId: number;
  customerId: number;
  customerName: string | null;
  amount: string;
  paymentMethod: 'cash' | 'transfer' | 'other';
  paidAt: string;
  notes: string | null;
  createdBy: number;
  createdAt: string;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface MikrotikConfig {
  id: number;
  tenantId: string;
  name: string;
  host: string;
  port: number;
  username: string;
  radiusSecret: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IpPool {
  id: number;
  tenantId: string;
  mikrotikConfigId: number;
  displayName: string;
  name: string;
  network: string;
  gateway: string;
  ipStart: string;
  ipEnd: string;
  dnsPrimary: string;
  dnsSecondary: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappConfig {
  id: number;
  tenantId: string;
  provider: 'fonnte' | 'wablast' | 'meta';
  name: string;
  apiKey: string;
  senderNumber: string;
  extraConfig: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WhatsappTemplateType = 'registration' | 'reminder' | 'isolir' | 'payment';

export interface WhatsappTemplateVariable {
  key: string;
  description: string;
}

export interface WhatsappTemplate {
  type: WhatsappTemplateType;
  label: string;
  variables: WhatsappTemplateVariable[];
  content: string;
  defaultContent: string;
  isCustom: boolean;
  updatedAt: string | null;
}

export interface ActivityLog {
  id: number;
  tenantId: string | null;
  userId: number | null;
  userEmail: string | null;
  method: string;
  path: string;
  action: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  statusCode: number;
  durationMs: number;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  address: string | null;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlan {
  id: number;
  name: string;
  description: string | null;
  priceMonthly: string;
  maxCustomers: number;
  maxMikrotik: number;
  maxIpPools: number;
  maxUsers: number;
  hasWhatsapp: boolean;
  hasApiAccess: boolean;
  hasReports: boolean;
  isActive: boolean;
}

export interface TenantSubscriptionRow {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  subscriptionId: number | null;
  planId: number | null;
  status: 'active' | 'expired' | 'trial' | 'cancelled' | null;
  expiresAt: string | null;
  durationMonths: number | null;
  amountPaid: string | null;
}

export interface Area {
  id: number;
  tenantId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string;
  address: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  motto: string | null;
  about: string | null;
  bankAccounts: string | null;
}