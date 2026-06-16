import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { tenantMiddleware, requireTenant } from './middleware/tenant';
import { authMiddleware } from './middleware/auth';
import { apiMeterMiddleware } from './middleware/apiMeter';
import authRoutes from './routes/auth.routes';
import tenantRoutes from './routes/tenant.routes';
import billingRoutes from './routes/billing.routes';
import auditRoutes from './routes/audit.routes';
import invitationRoutes from './routes/invitation.routes';

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
app.use('/api/tenant/register', tenantRoutes);

app.use(tenantMiddleware);
app.use(requireTenant);
app.use(apiMeterMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/tenant', authMiddleware, tenantRoutes);
app.use('/api/billing', authMiddleware, billingRoutes);
app.use('/api/audit', authMiddleware, auditRoutes);

app.get('/api/theme', async (req: Request, res: Response) => {
  if (!req.tenant) {
    res.status(404).json({
      success: false,
      error: 'Tenant not found',
    });
    return;
  }

  res.json({
    success: true,
    data: {
      theme: req.tenant.theme,
      tenantName: req.tenant.name,
    },
  });
});

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
