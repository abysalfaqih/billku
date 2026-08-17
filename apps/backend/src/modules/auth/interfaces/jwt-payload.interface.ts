export interface JwtPayload {
  sub: number;       // user id
  tenantId: string;
  role: 'super_admin' | 'admin' | 'staff';
  email: string;
}