import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
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
    const role = await prisma.role.findUnique({
      where: { id: input.roleId },
    });

    if (!role || role.tenantId !== tenantId) {
      throw new Error('Invalid role');
    }

    const existingMember = await prisma.tenantMember.findFirst({
      where: {
        tenantId,
        user: { email: input.email },
      },
    });

    if (existingMember) {
      throw new Error('User is already a member of this tenant');
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        tenantId,
        email: input.email,
        status: 'PENDING',
      },
    });

    if (existingInvitation) {
      await prisma.invitation.update({
        where: { id: existingInvitation.id },
        data: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      });

      const token = this.generateInvitationToken(existingInvitation.id);
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
        actorEmail: inviterName,
        targetType: 'member',
        metadata: { email: input.email, role: role.name },
      });

      return { invitationId: existingInvitation.id, token };
    }

    const invitation = await prisma.invitation.create({
      data: {
        tenantId,
        email: input.email,
        roleId: input.roleId,
        invitedBy,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const token = this.generateInvitationToken(invitation.id);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

    await EmailService.sendInvitation(
      input.email,
      tenant?.name || '',
      token,
      inviterName
    );

    const inviter = await prisma.user.findUnique({ where: { id: invitedBy } });
    await AuditService.log({
      tenantId,
      userId: invitedBy,
      action: AuditAction.MEMBER_INVITED,
      actorEmail: inviter?.email || '',
      targetType: 'member',
      metadata: { email: input.email, role: role.name },
    });

    return { invitationId: invitation.id, token };
  }

  static async acceptInvitation(token: string, password: string, name: string): Promise<{ userId: string; tenantId: string }> {
    const invitationId = this.verifyInvitationToken(token);

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { tenant: true },
    });

    if (!invitation) {
      throw new Error('Invalid invitation');
    }

    if (invitation.status !== 'PENDING') {
      throw new Error('Invitation has already been used or expired');
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
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

    const existingMember = await prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: invitation.tenantId,
          userId,
        },
      },
    });

    if (!existingMember) {
      await prisma.tenantMember.create({
        data: {
          tenantId: invitation.tenantId,
          userId,
          roleId: invitation.roleId,
          invitedBy: invitation.invitedBy,
        },
      });
    }

    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    return { userId, tenantId: invitation.tenantId };
  }

  static async getMembers(
    tenantId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<any>> {
    const [members, total] = await Promise.all([
      prisma.tenantMember.findMany({
        where: { tenantId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              status: true,
            },
          },
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
      prisma.tenantMember.count({ where: { tenantId } }),
    ]);

    return {
      data: members,
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
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role || role.tenantId !== tenantId) {
      throw new Error('Invalid role');
    }

    await prisma.tenantMember.update({
      where: {
        id: memberId,
        tenantId,
      },
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
    const member = await prisma.tenantMember.findUnique({
      where: { id: memberId },
      include: { user: true, role: true },
    });

    if (!member || member.tenantId !== tenantId) {
      throw new Error('Member not found');
    }

    if (member.role.isSystem && member.role.name === 'Owner') {
      throw new Error('Cannot remove the owner');
    }

    await prisma.tenantMember.delete({
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
      metadata: { removedEmail: member.user.email, roleName: member.role.name },
    });
  }

  static async getRoles(tenantId: string): Promise<any[]> {
    return prisma.role.findMany({
      where: { tenantId },
      orderBy: { isSystem: 'desc' },
    });
  }

  static async createRole(tenantId: string, name: string, description: string | undefined, permissions: string[], createdBy: string): Promise<any> {
    const existingRole = await prisma.role.findUnique({
      where: { tenantId_name: { tenantId, name } },
    });

    if (existingRole) {
      throw new Error('Role already exists');
    }

    const role = await prisma.role.create({
      data: {
        tenantId,
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

  private static generateInvitationToken(invitationId: string): string {
    return jwt.sign({ invitationId, type: 'invitation' }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '7d',
    });
  }

  private static verifyInvitationToken(token: string): string {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { invitationId: string; type: string };
      if (decoded.type !== 'invitation') {
        throw new Error('Invalid token type');
      }
      return decoded.invitationId;
    } catch (error) {
      throw new Error('Invalid or expired invitation token');
    }
  }
}
