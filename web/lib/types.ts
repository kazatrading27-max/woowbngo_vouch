export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'AGENT';
export type VoucherStatus = 'ACTIVE' | 'REDEEMED' | 'REVOKED' | 'EXPIRED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Station {
  id: string;
  uuid: string;
  uuidClean: string;
  label: string;
  ownerName: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  voucherCount: number;
  createdAt: string;
}

export interface VoucherStation {
  id: string;
  uuid: string;
  label: string;
  ownerName: string;
  phone: string | null;
  address?: string | null;
}

export interface Voucher {
  id: string;
  code: string;
  formattedCode: string;
  amount: number;
  share: number;
  daysValid: number;
  expiresAt: string | null;
  status: Exclude<VoucherStatus, 'EXPIRED'>;
  effectiveStatus: VoucherStatus;
  note: string | null;
  createdAt: string;
  redeemedAt: string | null;
  station: VoucherStation;
  issuedBy: { id: string; name: string } | undefined;
}

export interface VoucherPage {
  items: Voucher[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface Stats {
  stations: number;
  vouchersTotal: number;
  vouchersActive: number;
  vouchersExpired: number;
  vouchersRedeemed: number;
  vouchersRevoked: number;
  creditsIssued: number;
  creditsActive: number;
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  amount?: number;
  share?: number;
  expiry?: number;
  dbRecord?: {
    id: string;
    status: VoucherStatus;
    note: string | null;
    createdAt: string;
    station: { id: string; label: string; ownerName: string; uuid: string };
    issuedBy: string | null;
  } | null;
}
