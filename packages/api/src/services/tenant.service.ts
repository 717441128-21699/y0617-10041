import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma, createTenantSchema } from '../lib/prisma';
import { cacheDel } from '../lib/redis';
import { DEFAULT_ROLES } from '../config';
import { CreateTenantInput, UpdateTenantInput, Tenant, AuditAction } from '@saas/shared';
import { AuditService } from './audit.service';

export class TenantService {
  static async createTenant(input: CreateTenantInput): Promise<{ tenant: Tenant; userId: string }> {
    const existingTenant = await prisma.tenant.findUnique({
      where: { subdomain: input.subdomain },
    });

    if (existingTenant) {
      throw new Error('Subdomain is already taken');
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: input.adminEmail },
    });

    if (existingUser) {
      throw new Error('Email is already registered');
    }

    const schemaName = `tenant_${uuidv4().replace(/-/g, '_')}`;

    const result = await prisma.$transaction(async (tx: any) => {
      const passwordHash = await bcrypt.hash(input.adminPassword, 12);

      const user = await tx.user.create({
        data: {
          email: input.adminEmail,
          name: input.adminName,
          passwordHash,
          status: 'ACTIVE',
          emailVerified: true,
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          subdomain: input.subdomain,
          schemaName,
          status: 'ACTIVE',
          tier: 'FREE',
        },
      });

      await createTenantSchema(schemaName);

      const roles: Array<{ id: string; name: string }> = [];
      for (const roleData of DEFAULT_ROLES) {
        const role = await tx.role.create({
          data: {
            tenantId: tenant.id,
            name: roleData.name,
            description: roleData.description,
            permissions: roleData.permissions,
            isSystem: roleData.isSystem,
          },
        });
        roles.push(role);
      }

      const ownerRole = roles.find(r => r.name === 'Owner');
      if (!ownerRole) {
        throw new Error('Owner role not created');
      }

      await tx.tenantMember.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: ownerRole.id,
        },
      });

      await AuditService.log({
        tenantId: tenant.id,
        userId: user.id,
        action: AuditAction.TENANT_CREATED,
        actorEmail: user.email,
        targetType: 'tenant',
        targetId: tenant.id,
        metadata: { name: input.name, subdomain: input.subdomain },
      });

      return { tenant, userId: user.id };
    });

    return result;
  }

  static async getTenantById(tenantId: string): Promise<Tenant | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) return null;
    return {
      ...tenant,
      theme: {
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        logoUrl: tenant.logoUrl,
      },
    } as unknown as Tenant;
  }

  static async updateTenant(tenantId: string, input: UpdateTenantInput, userId: string): Promise<Tenant> {
    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.customDomain !== undefined) updateData.customDomain = input.customDomain || null;
    if (input.settings) updateData.settings = input.settings;
    if (input.theme) {
      if (input.theme.primaryColor !== undefined) updateData.primaryColor = input.theme.primaryColor;
      if (input.theme.secondaryColor !== undefined) updateData.secondaryColor = input.theme.secondaryColor;
      if (input.theme.logoUrl !== undefined) updateData.logoUrl = input.theme.logoUrl || '/default-logo.png';
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    await cacheDel(`tenant:${tenant.subdomain}`);
    if (tenant.customDomain) {
      await cacheDel(`tenant:${tenant.customDomain}`);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    await AuditService.log({
      tenantId,
      userId,
      action: AuditAction.TENANT_UPDATED,
      actorEmail: user?.email || '',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: input,
    });

    return {
      ...tenant,
      theme: {
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        logoUrl: tenant.logoUrl,
      },
    } as unknown as Tenant;
  }

  static async getTenantTheme(tenantId: string): Promise<{
    primaryColor: string;
    secondaryColor: string;
    logoUrl: string;
  }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        primaryColor: true,
        secondaryColor: true,
        logoUrl: true,
      },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    return {
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      logoUrl: tenant.logoUrl,
    };
  }
}
