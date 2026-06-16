import { Router, Request, Response } from 'express';
import { AuditService } from '../services/audit.service';
import { requirePermission } from '../middleware/auth';
import { AuditAction } from '@saas/shared';

const router = Router();

router.get('/', requirePermission('audit:read'), async (req: Request, res: Response): Promise<void> => {
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
    
    const filter: any = {};
    
    if (req.query.userId) {
      filter.userId = req.query.userId as string;
    }
    
    if (req.query.action) {
      filter.action = req.query.action as AuditAction;
    }
    
    if (req.query.startDate) {
      filter.startDate = new Date(req.query.startDate as string);
    }
    
    if (req.query.endDate) {
      filter.endDate = new Date(req.query.endDate as string);
    }
    
    const logs = await AuditService.getLogs(req.tenant.id, filter, page, limit);
    
    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get audit logs',
    });
  }
});

export default router;
