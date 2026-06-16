import { Request, Response } from 'express';
import { getTenantClientById } from '../lib/prisma';
import { AuditAction, AuditLogFilter, PaginatedResponse } from '@saas/shared';

interface CreateAuditLogParams {
  tenantId: string;
  userId?: string;
  action: AuditAction;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export class AuditService {
  static async log(params: CreateAuditLogParams): Promise<void> {
    const { tenantId, userId, action, actorEmail, targetType, targetId, metadata, req } = params;

    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    if (req) {
      ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      userAgent = req.headers['user-agent'];
    }

    try {
      const tenantPrisma = await getTenantClientById(tenantId);
      await tenantPrisma.auditLog.create({
        data: {
          userId,
          action: action as any,
          actorEmail,
          targetType,
          targetId,
          metadata: (metadata || {}) as any,
          ipAddress,
          userAgent,
        },
      });
    } catch (err) {
      console.error('[AuditService.log] failed:', err);
    }
  }

  static async getLogs(
    tenantId: string,
    filter: AuditLogFilter,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<any>> {
    const tenantPrisma = await getTenantClientById(tenantId);
    const where: any = {};

    if (filter.userId) {
      where.userId = filter.userId;
    }

    if (filter.action) {
      where.action = filter.action;
    }

    if (filter.startDate) {
      where.timestamp = {
        ...where.timestamp,
        gte: filter.startDate,
      };
    }

    if (filter.endDate) {
      where.timestamp = {
        ...where.timestamp,
        lte: filter.endDate,
      };
    }

    const [logs, total] = await Promise.all([
      tenantPrisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      tenantPrisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export function auditLog(action: AuditAction, targetType?: string) {
  return (req: Request, res: Response, next: Function): void => {
    const originalJson = res.json;

    res.json = function(this: Response, body: any): Response {
      if (body.success && req.tenant && req.user) {
        const targetId = req.params.id || (body.data && body.data.id);

        AuditService.log({
          tenantId: req.tenant.id,
          userId: req.user.id,
          action,
          actorEmail: req.user.email,
          targetType,
          targetId,
          metadata: {
            method: req.method,
            path: req.path,
            body: Object.keys(req.body).length > 0 ? req.body : undefined,
            query: Object.keys(req.query).length > 0 ? req.query : undefined,
          },
          req,
        }).catch(console.error);
      }

      return originalJson.call(this, body);
    };

    next();
  };
}
