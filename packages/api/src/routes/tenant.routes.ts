import { Router, Request, Response } from 'express';
import { TenantService } from '../services/tenant.service';
import { MemberService } from '../services/member.service';
import { requirePermission, requireRole } from '../middleware/auth';
import { createTenantSchema, updateTenantSchema, inviteMemberSchema } from '@saas/shared';
import { z } from 'zod';

const router = Router();

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const input = createTenantSchema.parse(req.body);
    const result = await TenantService.createTenant(input);
    
    res.status(201).json({
      success: true,
      data: result,
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

router.get('/', requirePermission('tenant:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.tenant) {
      res.status(400).json({
        success: false,
        error: 'Tenant not found',
      });
      return;
    }
    
    const tenant = await TenantService.getTenantById(req.tenant.id);
    
    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get tenant',
    });
  }
});

router.put('/', requirePermission('tenant:update'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.tenant || !req.user) {
      res.status(400).json({
        success: false,
        error: 'Missing tenant or user context',
      });
      return;
    }
    
    const input = updateTenantSchema.parse(req.body);
    const tenant = await TenantService.updateTenant(req.tenant.id, input, req.user.id);
    
    res.json({
      success: true,
      data: tenant,
      message: 'Tenant updated successfully',
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
      error: error instanceof Error ? error.message : 'Failed to update tenant',
    });
  }
});

router.post('/members/invite', requirePermission('member:invite'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.tenant || !req.user) {
      res.status(400).json({
        success: false,
        error: 'Missing tenant or user context',
      });
      return;
    }
    
    const input = inviteMemberSchema.parse(req.body);
    const result = await MemberService.inviteMember(
      req.tenant.id,
      input,
      req.user.id,
      req.user.email
    );
    
    res.json({
      success: true,
      data: result,
      message: 'Invitation sent successfully',
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
      error: error instanceof Error ? error.message : 'Failed to send invitation',
    });
  }
});

router.get('/members', requirePermission('member:read'), async (req: Request, res: Response): Promise<void> => {
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
    
    const result = await MemberService.getMembers(req.tenant.id, page, limit);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get members',
    });
  }
});

router.put('/members/:id/role', requirePermission('member:role:update'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.tenant || !req.user) {
      res.status(400).json({
        success: false,
        error: 'Missing tenant or user context',
      });
      return;
    }
    
    const { roleId } = req.body;
    await MemberService.updateMemberRole(
      req.tenant.id,
      req.params.id,
      roleId,
      req.user.id
    );
    
    res.json({
      success: true,
      message: 'Member role updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update member role',
    });
  }
});

router.delete('/members/:id', requirePermission('member:remove'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.tenant || !req.user) {
      res.status(400).json({
        success: false,
        error: 'Missing tenant or user context',
      });
      return;
    }
    
    await MemberService.removeMember(req.tenant.id, req.params.id, req.user.id);
    
    res.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove member',
    });
  }
});

router.get('/roles', requirePermission('role:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.tenant) {
      res.status(400).json({
        success: false,
        error: 'Missing tenant context',
      });
      return;
    }
    
    const roles = await MemberService.getRoles(req.tenant.id);
    
    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get roles',
    });
  }
});

router.post('/roles', requirePermission('role:create'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.tenant || !req.user) {
      res.status(400).json({
        success: false,
        error: 'Missing tenant or user context',
      });
      return;
    }
    
    const { name, description, permissions } = req.body;
    const role = await MemberService.createRole(
      req.tenant.id,
      name,
      description,
      permissions,
      req.user.id
    );
    
    res.status(201).json({
      success: true,
      data: role,
      message: 'Role created successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create role',
    });
  }
});

export default router;
