import { Router, Request, Response } from 'express';
import { BillingService } from '../services/billing.service';
import { requirePermission } from '../middleware/auth';
import { auditLog } from '../services/audit.service';
import { AuditAction } from '@saas/shared';
import { z } from 'zod';

const router = Router();

const updateTierSchema = z.object({
  tier: z.enum(['free', 'basic', 'pro', 'enterprise']),
});

router.get('/usage', requirePermission('billing:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.tenant) {
      res.status(400).json({
        success: false,
        error: 'Missing tenant context',
      });
      return;
    }
    
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const month = req.query.month ? parseInt(req.query.month as string) : undefined;
    
    const usage = await BillingService.getMonthlyUsage(req.tenant.id, year, month);
    
    res.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get usage',
    });
  }
});

router.get('/invoices', requirePermission('billing:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.tenant) {
      res.status(400).json({
        success: false,
        error: 'Missing tenant context',
      });
      return;
    }
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const result = await BillingService.getInvoices(req.tenant.id, page, limit);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get invoices',
    });
  }
});

router.put('/tier', requirePermission('billing:update'), auditLog(AuditAction.BILLING_PLAN_CHANGED, 'billing'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.tenant || !req.user) {
      res.status(400).json({
        success: false,
        error: 'Missing tenant or user context',
      });
      return;
    }
    
    const input = updateTierSchema.parse(req.body);
    await BillingService.updateTier(req.tenant.id, input.tier, req.user.id);
    
    res.json({
      success: true,
      message: 'Tier updated successfully',
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
      error: error instanceof Error ? error.message : 'Failed to update tier',
    });
  }
});

router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    
    res.json({
      success: true,
      message: 'Webhook received',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook error',
    });
  }
});

export default router;
