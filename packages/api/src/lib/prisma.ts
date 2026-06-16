import { PrismaClient, Prisma } from '@prisma/client';

export interface TenantScopedPrisma extends PrismaClient {
  role: any;
  tenantMember: any;
  apiUsage: any;
  invoice: any;
  invoiceItem: any;
  auditLog: any;
}

const TENANT_SCHEMA_CACHE_KEY = 'tenant_schema_name:';

class PrismaManager {
  private static instance: PrismaClient | null = null;
  private static tenantClients: Map<string, TenantScopedPrisma> = new Map();

  static getInstance(): PrismaClient {
    if (!PrismaManager.instance) {
      PrismaManager.instance = new PrismaClient();
    }
    return PrismaManager.instance;
  }

  static async getTenantClientById(tenantId: string): Promise<TenantScopedPrisma> {
    const cacheKey = `${TENANT_SCHEMA_CACHE_KEY}${tenantId}`;
    const { cacheGet, cacheSet } = await import('./redis');
    let schemaName = await cacheGet<string>(cacheKey);
    
    if (!schemaName) {
      const tenant = await PrismaManager.getInstance().tenant.findUnique({
        where: { id: tenantId },
        select: { schemaName: true },
      });
      if (!tenant) throw new Error('Tenant not found');
      schemaName = tenant.schemaName;
      await cacheSet(cacheKey, schemaName, 3600);
    }
    
    return PrismaManager.getTenantClient(schemaName);
  }

  static async getTenantClient(schemaName: string): Promise<TenantScopedPrisma> {
    if (PrismaManager.tenantClients.has(schemaName)) {
      return PrismaManager.tenantClients.get(schemaName)!;
    }

    const baseUrl = process.env.DATABASE_URL || '';
    const schemaUrl = baseUrl.replace('schema=public', `schema=${schemaName}`);
    const client = new PrismaClient({
      datasources: {
        db: {
          url: schemaUrl,
        },
      },
    }) as unknown as TenantScopedPrisma;

    PrismaManager.tenantClients.set(schemaName, client);
    return client;
  }

  static async createTenantSchema(schemaName: string): Promise<void> {
    const prisma = PrismaManager.getInstance();
    await prisma.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`
    );
  }

  static async migrateTenantSchema(schemaName: string): Promise<void> {
    const prisma = await PrismaManager.getTenantClient(schemaName);
    const typeMap: Record<string, string> = {
      String: 'VARCHAR(255)',
      Boolean: 'BOOLEAN',
      Int: 'INTEGER',
      Float: 'FLOAT',
      DateTime: 'TIMESTAMP',
      Json: 'JSONB',
      UUID: 'UUID',
      Decimal: 'DECIMAL(12,2)',
    };

    const prismaDmmf = (Prisma as any).dmmf;
    const migrations: string[] = [];
    if (prismaDmmf && prismaDmmf.datamodel && prismaDmmf.datamodel.models) {
      const models = prismaDmmf.datamodel.models as any[];
      const PUBLIC_ONLY_MODELS = ['Tenant', 'User', 'Invitation'];
      for (const model of models) {
        if (PUBLIC_ONLY_MODELS.includes(model.name)) continue;
        const fields: string[] = [];
        for (const field of model.fields as any[]) {
          if (field.kind !== 'scalar') continue;
          const dbType = typeMap[field.type] || 'VARCHAR(255)';
          const parts: string[] = [`"${field.name}" ${dbType}`];
          if (field.isId) parts.push('PRIMARY KEY');
          if (field.isRequired && !field.isId) parts.push('NOT NULL');
          fields.push(parts.join(' '));
        }
        migrations.push(`CREATE TABLE IF NOT EXISTS "${schemaName}"."${model.name.toLowerCase()}" (${fields.join(', ')})`);
      }
    }

    for (const migration of migrations) {
      await prisma.$executeRawUnsafe(migration);
    }
  }

  static async releaseTenantClient(schemaName: string): Promise<void> {
    const client = PrismaManager.tenantClients.get(schemaName);
    if (client) {
      await client.$disconnect();
      PrismaManager.tenantClients.delete(schemaName);
    }
  }
}

export const prisma = PrismaManager.getInstance();
export const getTenantClientById = PrismaManager.getTenantClientById;
export const getTenantClient = PrismaManager.getTenantClient;
export const createTenantSchema = PrismaManager.createTenantSchema;
export const migrateTenantSchema = PrismaManager.migrateTenantSchema;
