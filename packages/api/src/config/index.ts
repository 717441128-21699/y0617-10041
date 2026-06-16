import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  baseDomain: process.env.BASE_DOMAIN || 'localhost',
  database: {
    url: process.env.DATABASE_URL || '',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
};

export const SYSTEM_PERMISSIONS = [
  'tenant:read',
  'tenant:update',
  'member:read',
  'member:invite',
  'member:remove',
  'member:role:update',
  'role:read',
  'role:create',
  'role:update',
  'role:delete',
  'billing:read',
  'billing:update',
  'audit:read',
  'settings:read',
  'settings:update',
  'api:read',
  'api:write',
];

export const DEFAULT_ROLES = [
  {
    name: 'Owner',
    description: 'Full access to all resources',
    permissions: SYSTEM_PERMISSIONS,
    isSystem: true,
  },
  {
    name: 'Admin',
    description: 'Manage members and settings',
    permissions: [
      'tenant:read',
      'tenant:update',
      'member:read',
      'member:invite',
      'member:remove',
      'member:role:update',
      'role:read',
      'role:create',
      'role:update',
      'role:delete',
      'billing:read',
      'audit:read',
      'settings:read',
      'settings:update',
      'api:read',
      'api:write',
    ],
    isSystem: true,
  },
  {
    name: 'Member',
    description: 'Basic member access',
    permissions: [
      'tenant:read',
      'member:read',
      'api:read',
      'api:write',
    ],
    isSystem: true,
  },
];
