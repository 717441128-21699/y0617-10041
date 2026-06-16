import { prisma, getTenantClientById } from '../lib/prisma';
import { redis, cacheSet, cacheGet, cacheDel } from '../lib/redis';
import { BILLING_TIERS, getBillingTier, MonthlyUsage, Invoice, InvoiceItem } from '@saas/shared';
import EmailService from './email.service';
import { AuditService } from './audit.service';
import { AuditAction } from '@saas/shared';

export class BillingService {
  static async recordApiCall(tenantId: string, tier: string, endpoint: string, method: string): Promise<{ allowed: boolean; count: number; limit: number }> {
    const date = new Date().toISOString().split('T')[0];
    const monthKey = `usage:${tenantId}:${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const dailyKey = `usage:${tenantId}:${date}:${endpoint}:${method}`;
    const cacheKey = `monthly_usage:${tenantId}:${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const [monthlyCount, dailyCount] = await Promise.all([
      redis.incr(monthKey),
      redis.incr(dailyKey),
    ]);

    redis.expire(monthKey, 60 * 60 * 24 * 35);
    redis.expire(dailyKey, 60 * 60 * 24 * 2);

    const billingTier = getBillingTier(tier);
    const freeCalls = billingTier.freeCalls;

    if ((tier === 'free' || tier === 'FREE') && monthlyCount > freeCalls) {
      await cacheDel(cacheKey);
      await AuditService.log({
        tenantId,
        action: AuditAction.API_EXCEEDED_QUOTA,
        targetType: 'api',
        metadata: { count: monthlyCount, limit: freeCalls, endpoint, method },
      });
      return { allowed: false, count: monthlyCount, limit: freeCalls };
    }

    const tenantPrisma = await getTenantClientById(tenantId);
    await tenantPrisma.apiUsage.upsert({
      where: {
        date_endpoint_method: {
          date,
          endpoint,
          method,
        },
      },
      create: {
        date,
        endpoint,
        method,
        count: 1,
      },
      update: {
        count: {
          increment: 1,
        },
      },
    });

    await cacheDel(cacheKey);

    return { allowed: true, count: monthlyCount, limit: freeCalls };
  }

  static async getMonthlyUsage(tenantId: string, year?: number, month?: number): Promise<MonthlyUsage> {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || now.getMonth() + 1;
    const monthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

    const cacheKey = `monthly_usage:${tenantId}:${monthStr}`;
    const cached = await cacheGet<MonthlyUsage>(cacheKey);
    if (cached) return cached;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tier: true },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const tenantPrisma = await getTenantClientById(tenantId);
    const usageRecords = await tenantPrisma.apiUsage.findMany({
      where: {
        date: {
          gte: startDate.toISOString().split('T')[0],
          lte: endDate.toISOString().split('T')[0],
        },
      },
    });

    const totalCalls = usageRecords.reduce((sum: number, record: any) => sum + record.count, 0);
    const billingTier = getBillingTier(tenant.tier);
    const freeCalls = billingTier.freeCalls;
    const billableCalls = Math.max(0, totalCalls - freeCalls);

    const estimatedCost = this.calculateCost(billableCalls, tenant.tier);

    const result: MonthlyUsage = {
      tenantId,
      month: monthStr,
      totalCalls,
      freeCalls,
      billableCalls,
      estimatedCost,
    };

    await cacheSet(cacheKey, result, 3600);
    return result;
  }

  static calculateCost(billableCalls: number, tier: string): number {
    const billingTier = getBillingTier(tier);
    if (!billingTier || billingTier.tiers.length === 0 || billableCalls === 0) return 0;

    let remainingCalls = billableCalls;
    let totalCost = 0;

    for (const tierConfig of billingTier.tiers) {
      const maxCalls = tierConfig.maxCalls || Infinity;
      const callsInTier = Math.min(remainingCalls, maxCalls - tierConfig.minCalls + 1);
      
      if (callsInTier > 0) {
        totalCost += (callsInTier / 1000) * tierConfig.pricePerThousand;
        remainingCalls -= callsInTier;
      }

      if (remainingCalls <= 0) break;
    }

    return Math.round(totalCost * 100) / 100;
  }

  static async generateMonthlyInvoices(): Promise<Invoice[]> {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const periodEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

    const tenants = await prisma.tenant.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'TRIAL'],
        },
      },
    });

    const invoices: Invoice[] = [];

    for (const tenant of tenants) {
      const usage = await this.getMonthlyUsage(
        tenant.id,
        lastMonth.getFullYear(),
        lastMonth.getMonth() + 1
      );

      const tenantPrisma = await getTenantClientById(tenant.id);
      const existingInvoice = await tenantPrisma.invoice.findFirst({
        where: {
          periodStart,
          periodEnd,
        },
      });

      if (existingInvoice) {
        invoices.push(existingInvoice as any);
        continue;
      }

      const invoice = await tenantPrisma.invoice.create({
        data: {
          periodStart,
          periodEnd,
          totalCalls: usage.totalCalls,
          freeCalls: usage.freeCalls,
          billableCalls: usage.billableCalls,
          amount: usage.estimatedCost,
          status: 'DRAFT',
        },
      });

      if (usage.billableCalls > 0) {
        const billingTier = getBillingTier(tenant.tier);
        const items: Array<{ description: string; quantity: number; unitPrice: number; amount: number }> = [];
        let remainingCalls = usage.billableCalls;

        for (const tierConfig of billingTier.tiers) {
          const maxCalls = tierConfig.maxCalls || Infinity;
          const callsInTier = Math.min(remainingCalls, maxCalls - tierConfig.minCalls + 1);

          if (callsInTier > 0) {
            const amount = Math.round((callsInTier / 1000) * tierConfig.pricePerThousand * 100) / 100;
            items.push({
              description: `API Calls (${tierConfig.minCalls.toLocaleString()} - ${tierConfig.maxCalls?.toLocaleString() || '∞'})`,
              quantity: callsInTier,
              unitPrice: tierConfig.pricePerThousand / 1000,
              amount,
            });
            remainingCalls -= callsInTier;
          }

          if (remainingCalls <= 0) break;
        }

        for (const item of items) {
          await tenantPrisma.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.amount,
            },
          });
        }
      }

      await tenantPrisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'PENDING' },
      });

      const member = await tenantPrisma.tenantMember.findFirst({
        include: { role: true },
      });
      let owner: any = null;
      if (member) {
        const user = await prisma.user.findUnique({ where: { id: member.userId } });
        if (user && member.role?.name === 'Owner') owner = { user };
      }

      if (owner && usage.estimatedCost > 0) {
        await EmailService.sendInvoice(
          owner.user.email,
          tenant.name,
          invoice.id,
          usage.estimatedCost,
          `${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}`
        );
      }

      invoices.push(invoice as any);
    }

    return invoices;
  }

  static async getInvoices(tenantId: string, page: number = 1, limit: number = 20): Promise<any> {
    const tenantPrisma = await getTenantClientById(tenantId);
    const [invoices, total] = await Promise.all([
      tenantPrisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          items: true,
        },
      }),
      tenantPrisma.invoice.count(),
    ]);

    return {
      data: invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async updateTier(tenantId: string, newTier: string, updatedBy: string): Promise<void> {
    const tierUpper = newTier.toUpperCase();
    const validTiers = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'];
    if (!validTiers.includes(tierUpper)) {
      throw new Error('Invalid tier');
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { tier: tierUpper as any },
    });

    await cacheDel(`tenant:${tenant.subdomain}`);
    if (tenant.customDomain) {
      await cacheDel(`tenant:${tenant.customDomain}`);
    }
    await cacheDel(`monthly_usage:${tenantId}:${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);

    const user = await prisma.user.findUnique({ where: { id: updatedBy } });
    await AuditService.log({
      tenantId,
      userId: updatedBy,
      action: AuditAction.BILLING_PLAN_CHANGED,
      actorEmail: user?.email || '',
      targetType: 'billing',
      metadata: { newTier: tierUpper },
    });
  }
}
