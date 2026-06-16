import { PrismaClient, Prisma } from '@prisma/client';

class PrismaManager {
  private static instance: PrismaClient | null = null;
  private static tenantClients: Map<string, PrismaClient> = new Map();

  static getInstance(): PrismaClient {
    if (!PrismaManager.instance) {
      PrismaManager.instance = new PrismaClient();
    }
    return PrismaManager.instance;
  }

  static async getTenantClient(schemaName: string): Promise<PrismaClient> {
    if (PrismaManager.tenantClients.has(schemaName)) {
      return PrismaManager.tenantClients.get(schemaName)!;
    }

    const client = new PrismaClient({
      datasources: {
        db: {
          url: `${process.env.DATABASE_URL?.replace('schema=public', `schema=${schemaName}`) || ''},
        },
      },
    });

    PrismaManager.tenantClients.set(schemaName, client);
    return client;
  }

  static async createTenantSchema(schemaName: string): Promise<void> {
    const prisma = PrismaManager.getInstance();
    await prisma.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`
    );
    await prisma.$executeRawUnsafe(
      `SET search_path TO "${schemaName}"`
    );
  }

  static async migrateTenantSchema(schemaName: string): Promise<void> {
    const prisma = await PrismaManager.getTenantClient(schemaName);
    const migrations = Prisma.dmmf.datamodel.models
      .filter(m => !['Tenant', 'User'].includes(m.name))
      .map(model => {
        const fields = model.fields
          .map(field => {
            let type = '';
            switch (field.kind === 'scalar' ? field.type : 'UUID');
            if (field.isId) type += ' PRIMARY KEY';
            if (field.isRequired && !field.isId) type += ' NOT NULL';
            if (field.hasDefaultValue) type += ` DEFAULT ${field.default?.toString()}`;
            return `"${field.name}" ${type}`;
          })
          .join(', ');
        return `CREATE TABLE IF NOT EXISTS "${schemaName}"."${model.name.toLowerCase()}" (${fields})`;
      });

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
export const getTenantClient = PrismaManager.getTenantClient;
export const createTenantSchema = PrismaManager.createTenantSchema;
export const migrateTenantSchema = PrismaManager.migrateTenantSchema;
