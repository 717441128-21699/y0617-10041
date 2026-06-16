import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { cacheGet, cacheSet } from '../lib/redis';
import { config } from '../config';

declare global {
  namespace Express {
    interface Request {
      tenant?: {
        id: string;
        name: string;
        schemaName: string;
        tier: string;
        theme: {
          primaryColor: string;
          secondaryColor: string;
          logoUrl: string;
        };
        settings: Record<string, unknown>;
      };
    }
  }
}

const TENANT_CACHE_TTL = 300;

export function extractSubdomain(host: string): string | null {
  const baseDomain = config.baseDomain;
  const hostParts = host.split(':')[0];
  
  if (hostParts === baseDomain) {
    return null;
  }

  if (hostParts.endsWith(`.${baseDomain}`)) {
    const subdomain = hostParts.replace(`.${baseDomain}`, '');
    return subdomain;
  }

  return hostParts;
}

export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const host = req.headers.host || '';
  const subdomain = extractSubdomain(host);

  if (!subdomain) {
    res.status(400).json({
      success: false,
      error: 'Invalid tenant domain',
    });
    return;
  }

  const cacheKey = `tenant:${subdomain}`;
  let tenant = await cacheGet(cacheKey);

  if (!tenant) {
    const tenantData = await prisma.tenant.findFirst({
      where: {
        OR: [
          { subdomain },
          { customDomain: subdomain },
        ],
      },
      select: {
        id: true,
        name: true,
        schemaName: true,
        tier: true,
        status: true,
        primaryColor: true,
        secondaryColor: true,
        logoUrl: true,
        settings: true,
      },
    });

    if (!tenantData) {
      res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
      return;
    }

    if (tenantData.status !== 'ACTIVE' && tenantData.status !== 'TRIAL') {
      res.status(403).json({
        success: false,
        error: 'Tenant is not active',
      });
      return;
    }

    tenant = {
      id: tenantData.id,
      name: tenantData.name,
      schemaName: tenantData.schemaName,
      tier: tenantData.tier,
      theme: {
        primaryColor: tenantData.primaryColor,
        secondaryColor: tenantData.secondaryColor,
        logoUrl: tenantData.logoUrl,
      },
      settings: tenantData.settings as Record<string, unknown>,
    };

    await cacheSet(cacheKey, tenant, TENANT_CACHE_TTL);
  }

  req.tenant = tenant;
  next();
}

export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.tenant) {
    res.status(400).json({
      success: false,
      error: 'Tenant context is required',
    });
    return;
  }
  next();
}
