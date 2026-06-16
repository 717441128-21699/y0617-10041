export interface BillingTier {
  name: string;
  freeCalls: number;
  pricePerThousandCalls: number;
  tiers: Array<{
    minCalls: number;
    maxCalls: number | null;
    pricePerThousand: number;
  }>;
}

export const BILLING_TIERS: Record<string, BillingTier> = {
  free: {
    name: 'Free',
    freeCalls: 1000,
    pricePerThousandCalls: 0,
    tiers: [],
  },
  basic: {
    name: 'Basic',
    freeCalls: 10000,
    pricePerThousandCalls: 0.5,
    tiers: [
      { minCalls: 0, maxCalls: 100000, pricePerThousand: 0.5 },
      { minCalls: 100001, maxCalls: 500000, pricePerThousand: 0.4 },
      { minCalls: 500001, maxCalls: null, pricePerThousand: 0.3 },
    ],
  },
  pro: {
    name: 'Pro',
    freeCalls: 100000,
    pricePerThousandCalls: 0.3,
    tiers: [
      { minCalls: 0, maxCalls: 500000, pricePerThousand: 0.3 },
      { minCalls: 500001, maxCalls: 1000000, pricePerThousand: 0.25 },
      { minCalls: 1000001, maxCalls: null, pricePerThousand: 0.2 },
    ],
  },
  enterprise: {
    name: 'Enterprise',
    freeCalls: 1000000,
    pricePerThousandCalls: 0.15,
    tiers: [
      { minCalls: 0, maxCalls: null, pricePerThousand: 0.15 },
    ],
  },
};

export interface ApiUsage {
  tenantId: string;
  date: string;
  endpoint: string;
  method: string;
  count: number;
}

export interface MonthlyUsage {
  tenantId: string;
  month: string;
  totalCalls: number;
  freeCalls: number;
  billableCalls: number;
  estimatedCost: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  totalCalls: number;
  freeCalls: number;
  billableCalls: number;
  amount: number;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'void';
  paidAt?: Date;
  createdAt: Date;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}
