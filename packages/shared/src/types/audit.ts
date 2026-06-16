export enum AuditAction {
  TENANT_CREATED = 'tenant.created',
  TENANT_UPDATED = 'tenant.updated',
  MEMBER_INVITED = 'member.invited',
  MEMBER_REMOVED = 'member.removed',
  MEMBER_ROLE_UPDATED = 'member.role_updated',
  ROLE_CREATED = 'role.created',
  ROLE_UPDATED = 'role.updated',
  ROLE_DELETED = 'role.deleted',
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  SETTINGS_UPDATED = 'settings.updated',
  BILLING_PLAN_CHANGED = 'billing.plan_changed',
  INVOICE_PAID = 'invoice.paid',
  API_EXCEEDED_QUOTA = 'api.exceeded_quota',
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId?: string;
  action: AuditAction;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface AuditLogFilter {
  tenantId?: string;
  userId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
}
