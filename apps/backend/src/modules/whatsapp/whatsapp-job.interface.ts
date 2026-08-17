export interface WhatsAppJobData {
  tenantId: string;
  phone: string;
  message: string;
  trigger: 'registration' | 'reminder' | 'isolir' | 'payment';
  customerId?: number;
  billId?: number;
}