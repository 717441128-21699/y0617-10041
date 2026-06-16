import { Request, Response, NextFunction } from 'express';
import { BillingService } from '../services/billing.service';

const METERED_ENDPOINTS = [
  { method: 'GET', path: /^\/api\/.*/ },
  { method: 'POST', path: /^\/api\/.*/ },
  { method: 'PUT', path: /^\/api\/.*/ },
  { method: 'DELETE', path: /^\/api\/.*/ },
  { method: 'PATCH', path: /^\/api\/.*/ },
];

const EXCLUDED_ENDPOINTS = [
  /^\/api\/auth\/.*/,
  /^\/api\/billing\/webhook/,
];

export function isMeteredEndpoint(method: string, path: string): boolean {
  const isExcluded = EXCLUDED_ENDPOINTS.some(pattern => pattern.test(path));
  if (isExcluded) return false;

  return METERED_ENDPOINTS.some(
    endpoint =>
      endpoint.method === method.toUpperCase() &&
      endpoint.path.test(path)
  );
}

export async function apiMeterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.tenant) {
    next();
    return;
  }

  if (!isMeteredEndpoint(req.method, req.path)) {
    next();
    return;
  }

  const result = await BillingService.recordApiCall(
    req.tenant.id,
    req.tenant.tier,
    req.path,
    req.method
  );

  res.setHeader('X-RateLimit-Limit', result.limit.toString());
  res.setHeader('X-RateLimit-Count', result.count.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, result.limit - result.count).toString());

  if (!result.allowed) {
    res.status(429).json({
      success: false,
      error: 'API quota exceeded. Please upgrade your plan.',
      data: {
        count: result.count,
        limit: result.limit,
      },
    });
    return;
  }

  next();
}
