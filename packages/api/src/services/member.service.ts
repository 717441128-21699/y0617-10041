import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma, getTenantClientById } from '../lib/prisma';
import EmailService from './email.service';
import { AuditService } from './audit.service';
import { InviteMemberInput, AuditAction, PaginatedResponse } from '@saas/shared';

export class MemberService {
  static async inviteMember(
    tenantId: string,
    input: InviteMemberInput,
    invitedBy: string,
    inviterName: string
  ): Promise<{ invitationId: string; token: string }> {
    const tenantPrisma = await getTenantClientById(tenantId);

    const role = await tenantPrisma.role.findUnique({
      where: { id: input.roleId },
    });

    if (!role) {
      throw new Error('Invalid role');
    }

    const inviter = await prisma.user.findUnique({ where: { id: invitedBy } });

    const existingPublicUser = await prisma.user.findUnique({ where: { email: input.email } });
    let existingMember: any = null;
    if (existingPublicUser) {
      existingMember = await tenantPrisma.tenantMember.findUnique({
        where: { userId: existingPublicUser.id },
      });
    }

    if (existingMember) {
      throw new Error('User is already a member of this tenant');
    }

    const existingInvitation = await tenantPrisma.invitation.findFirst({
      where: {
        email: input.email,
        status: 'PENDING',
      },
    });

    if (existingInvitation) {
      await tenantPrisma.invitation.update({
        where: { id: existingInvitation.id },
        data: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      });

      const token = this.generateInvitationToken(existingInvitation.id, tenantId);
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

      await EmailService.sendInvitation(
        input.email,
        tenant?.name || '',
        token,
        inviterName
      );

      await AuditService.log({
        tenantId,
        userId: invitedBy,
        action: AuditAction.MEMBER_INVITED,
        actorEmail: inviter?.email || inviterName,
        targetType: 'member',
        metadata: { email: input.email, role: role.name },
      });

      return { invitationId: existingInvitation.id, token };
    }

    const invitation = await tenantPrisma.invitation.create({
      data: {
        email: input.email,
        roleId: input.roleId,
        invitedBy,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const token = this.generateInvitationToken(invitation.id, tenantId);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

    await EmailService.sendInvitation(
      input.email,
      tenant?.name || '',
      token,
      inviterName
    );

    await AuditService.log({
      tenantId,
      userId: invitedBy,
      action: AuditAction.MEMBER_INVITED,
      actorEmail: inviter?.email || inviterName,
      targetType: 'member',
      metadata: { email: input.email, role: role.name },
    });

    return { invitationId: invitation.id, token };
  }

  static async acceptInvitation(token: string, password: string, name: string): Promise<{ userId: string; tenantId: string }> {
    const { invitationId, tenantId } = this.verifyInvitationToken(token);

    const tenantPrisma = await getTenantClientById(tenantId);

    const invitation = await tenantPrisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) throw new Error('Invalid invitation');

    if (invitation.status !== 'PENDING') {
      throw new Error('Invitation has already been used or expired');
    }

    if (invitation.expiresAt < new Date()) {
      await tenantPrisma.invitation.update({
        where: { id: invitationId },
        data: { status: 'EXPIRED' },
      });
      throw new Error('Invitation has expired');
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      if (existingUser.status === 'PENDING') {
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'ACTIVE', name },
        });
      }
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: {
          email: invitation.email,
          name,
          passwordHash,
          status: 'ACTIVE',
          emailVerified: true,
        },
      });
      userId = user.id;
    }

    const existingMember = await tenantPrisma.tenantMember.findUnique({
      where: { userId },
    });

    if (!existingMember) {
      await tenantPrisma.tenantMember.create({
        data: {
          userId,
          roleId: invitation.roleId,
          invitedBy: invitation.invitedBy,
        },
      });
    }

    await tenantPrisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    return { userId, tenantId };
  }

  static async getMembers(
    tenantId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<any>> {
    const tenantPrisma = await getTenantClientById(tenantId);
    const [members, total] = await Promise.all([
      tenantPrisma.tenantMember.findMany({
        include: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      tenantPrisma.tenantMember.count(),
    ]);

    const userIds = members.map((m: any) => m.userId).filter(Boolean);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true, status: true },
    });
    const userMap: Record<string, any> = {};
    for (const u of users) userMap[u.id] = u;

    const data = members.map((m: any) => ({
      ...m,
      user: userMap[m.userId] || { id: m.userId, email: '', name: '', status: '' },
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async updateMemberRole(
    tenantId: string,
    memberId: string,
    roleId: string,
    updatedBy: string
  ): Promise<void> {
    const tenantPrisma = await getTenantClientById(tenantId);

    const role = await tenantPrisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new Error('Invalid role');
    }

    await tenantPrisma.tenantMember.update({
      where: { id: memberId },
      data: { roleId },
    });

    const user = await prisma.user.findUnique({ where: { id: updatedBy } });
    await AuditService.log({
      tenantId,
      userId: updatedBy,
      action: AuditAction.MEMBER_ROLE_UPDATED,
      actorEmail: user?.email || '',
      targetType: 'member',
      targetId: memberId,
      metadata: { newRoleId: roleId, newRoleName: role.name },
    });
  }

  static async removeMember(tenantId: string, memberId: string, removedBy: string): Promise<void> {
    const tenantPrisma = await getTenantClientById(tenantId);

    const member = await tenantPrisma.tenantMember.findUnique({
      where: { id: memberId },
      include: { role: true },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    if (member.role.isSystem && member.role.name === 'Owner') {
      throw new Error('Cannot remove the owner');
    }

    const removedUser = await prisma.user.findUnique({ where: { id: member.userId } });

    await tenantPrisma.tenantMember.delete({
      where: { id: memberId },
    });

    const user = await prisma.user.findUnique({ where: { id: removedBy } });
    await AuditService.log({
      tenantId,
      userId: removedBy,
      action: AuditAction.MEMBER_REMOVED,
      actorEmail: user?.email || '',
      targetType: 'member',
      targetId: memberId,
      metadata: { removedEmail: removedUser?.email || '', roleName: member.role.name },
    });
  }

  static async getRoles(tenantId: string): Promise<any[]> {
    const tenantPrisma = await getTenantClientById(tenantId);
    return tenantPrisma.role.findMany({
      orderBy: { isSystem: 'desc' },
    });
  }

  static async createRole(tenantId: string, name: string, description: string | undefined, permissions: string[], createdBy: string): Promise<any> {
    const tenantPrisma = await getTenantClientById(tenantId);

    const existingRole = await tenantPrisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      throw new Error('Role already exists');
    }

    const role = await tenantPrisma.role.create({
      data: {
        name,
        description,
        permissions,
        isSystem: false,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: createdBy } });
    await AuditService.log({
      tenantId,
      userId: createdBy,
      action: AuditAction.ROLE_CREATED,
      actorEmail: user?.email || '',
      targetType: 'role',
      targetId: role.id,
      metadata: { name, permissions },
    });

    return role;
  }

  private static generateInvitationToken(invitationId: string, tenantId: string): string {
    return jwt.sign({ invitationId, tenantId, type: 'invitation' }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '7d',
    });
  }

  private static verifyInvitationToken(token: string): { invitationId: string; tenantId: string } {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { invitationId: string; tenantId: string; type: string };
      if (decoded.type !== 'invitation') {
        throw new Error('Invalid token type');
      }
      return { invitationId: decoded.invitationId, tenantId: decoded.tenantId };
    } catch (error) {
      throw new Error('Invalid or expired invitation token');
    }
  }
}
