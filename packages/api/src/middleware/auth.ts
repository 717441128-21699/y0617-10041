import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { JwtPayload } from '@saas/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role?: string;
        permissions: string[];
      };
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authorization header is required',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({
        success: false,
        error: 'Invalid or inactive user',
      });
      return;
    }

    let permissions: string[] = [];
    let role: string | undefined;

    if (req.tenant && payload.tenantId === req.tenant.id) {
      const membership = await prisma.tenantMember.findUnique({
        where: {
          tenantId_userId: {
            tenantId: req.tenant.id,
            userId: user.id,
          },
        },
        include: {
          role: {
            select: {
              name: true,
              permissions: true,
            },
          },
        },
      });

      if (membership) {
        role = membership.role.name;
        permissions = membership.role.permissions;
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      role,
      permissions,
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
    });
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!req.user.permissions.includes(permission)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

export function requireRole(roleName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (req.user.role !== roleName) {
      res.status(403).json({
        success: false,
        error: `Role ${roleName} required`,
      });
      return;
    }

    next();
  };
}
