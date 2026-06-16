import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { prisma } from '../lib/prisma';
import { loginSchema } from '@saas/shared';
import { z } from 'zod';

const router = Router();

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const input = loginSchema.parse(req.body);
    const tenantId = req.tenant?.id;
    
    const result = await AuthService.login(input, tenantId);
    
    res.json({
      success: true,
      data: result,
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
    
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    });
  }
});

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const input = refreshTokenSchema.parse(req.body);
    const tokens = await AuthService.refreshToken(input.refreshToken);
    
    res.json({
      success: true,
      data: tokens,
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
    
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid refresh token',
    });
  }
});

router.get('/me', async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Not authenticated',
    });
    return;
  }

  const tenants = await AuthService.getUserTenants(req.user.id);
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      emailVerified: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  res.json({
    success: true,
    data: {
      user,
      tenants,
      currentTenant: req.tenant,
    },
  });
});

export default router;
