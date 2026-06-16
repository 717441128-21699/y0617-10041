import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma, getTenantClientById } from '../lib/prisma';
import { config } from '../config';
import { LoginInput, AuthTokens, JwtPayload, User, AuditAction } from '@saas/shared';
import { AuditService } from './audit.service';

export class AuthService {
  static async login(input: LoginInput, tenantId?: string): Promise<AuthTokens & { user: User; tenantId?: string; role?: string }> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('User account is not active');
    }

    let role: string | undefined;
    let permissions: string[] = [];

    if (tenantId) {
      const tenantPrisma = await getTenantClientById(tenantId);
      const membership = await tenantPrisma.tenantMember.findUnique({
        where: { userId: user.id },
        include: {
          role: true,
        },
      });

      if (!membership) {
        throw new Error('User is not a member of this tenant');
      }

      role = membership.role.name;
      permissions = membership.role.permissions;
    }

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      tenantId,
      role,
      permissions,
    };

    const accessToken = jwt.sign(payload as object, config.jwt.secret as jwt.Secret, {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      config.jwt.secret as jwt.Secret,
      { expiresIn: '30d' as jwt.SignOptions['expiresIn'] }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    if (tenantId) {
      await AuditService.log({
        tenantId,
        userId: user.id,
        action: AuditAction.USER_LOGIN,
        actorEmail: user.email,
        metadata: { email: input.email },
      });
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status as any,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt || undefined,
      },
      tenantId,
      role,
    };
  }

  static async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as { userId: string; type: string };

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new Error('User not found or inactive');
      }

      const payload: JwtPayload = {
        userId: user.id,
        email: user.email,
      };

      const accessToken = jwt.sign(payload as object, config.jwt.secret as jwt.Secret, {
        expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
      });

      const newRefreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        config.jwt.secret as jwt.Secret,
        { expiresIn: '30d' as jwt.SignOptions['expiresIn'] }
      );

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 7 * 24 * 60 * 60,
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  static async getUserTenants(userId: string): Promise<Array<{
    tenantId: string;
    tenantName: string;
    role: string;
    permissions: string[];
    subdomain: string;
  }>> {
    const allTenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        schemaName: true,
      },
    });

    const results: Array<{
      tenantId: string;
      tenantName: string;
      role: string;
      permissions: string[];
      subdomain: string;
    }> = [];

    for (const tenant of allTenants) {
      try {
        const tenantPrisma = await getTenantClientById(tenant.id);
        const membership = await tenantPrisma.tenantMember.findUnique({
          where: { userId },
          include: {
            role: {
              select: {
                name: true,
                permissions: true,
              },
            },
          },
        });

        if (membership && membership.role) {
          results.push({
            tenantId: tenant.id,
            tenantName: tenant.name,
            role: membership.role.name,
            permissions: membership.role.permissions,
            subdomain: tenant.subdomain,
          });
        }
      } catch (e) {
        // skip tenants without valid schema
      }
    }

    return results;
  }
}
