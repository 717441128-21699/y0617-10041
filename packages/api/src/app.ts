import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { z } from 'zod';
import { tenantMiddleware, requireTenant } from './middleware/tenant';
import { authMiddleware } from './middleware/auth';
import { apiMeterMiddleware } from './middleware/apiMeter';
import authRoutes from './routes/auth.routes';
import tenantRoutes from './routes/tenant.routes';
import billingRoutes from './routes/billing.routes';
import auditRoutes from './routes/audit.routes';
import invitationRoutes from './routes/invitation.routes';
import { TenantService } from './services/tenant.service';
import { createTenantSchema } from '@saas/shared';

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

app.use('/api/invitation', invitationRoutes);
app.post('/api/tenant/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const input = createTenantSchema.parse(req.body);
    const result = await TenantService.createTenant(input);

    res.status(201).json({
      success: true,
      data: {
        tenantId: result.tenant.id,
        subdomain: result.tenant.subdomain,
        name: result.tenant.name,
        userId: result.userId,
      },
      message: 'Tenant created successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create tenant',
    });
  }
});

app.use(tenantMiddleware);
app.use(requireTenant);
app.use(apiMeterMiddleware);

app.get('/api/theme', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      theme: req.tenant!.theme,
      tenantName: req.tenant!.name,
    },
  });
});

app.use('/api/auth/me', authMiddleware);
app.use('/api/auth', authRoutes);
app.use('/api/tenant', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/register') {
    res.status(405).json({ success: false, error: 'Method not allowed on protected route' });
    return;
  }
  next();
}, tenantRoutes);
app.use('/api/billing', authMiddleware, billingRoutes);
app.use('/api/audit', authMiddleware, auditRoutes);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

export default app;
