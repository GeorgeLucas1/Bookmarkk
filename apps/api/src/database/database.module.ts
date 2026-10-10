import { Global, Inject, Logger, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';
import { Pool } from 'pg';
import * as schema from './schema';

export const PG_POOL = 'PG_POOL';
export const DRIZZLE = 'DRIZZLE';

export type Database = NodePgDatabase<typeof schema>;

/** Migrations geradas pelo drizzle-kit; o caminho funciona tanto a partir de src/ quanto de dist/. */
const MIGRATIONS_FOLDER = join(__dirname, '..', '..', 'drizzle');

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Pool => {
        const connectionString = config.get<string>(
          'DATABASE_URL',
          'postgres://postgres:postgres@localhost:5432/bookmark',
        );
        return new Pool({ connectionString });
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Database => drizzle(pool, { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  async onModuleInit(): Promise<void> {
    await migrate(this.db, { migrationsFolder: MIGRATIONS_FOLDER });
    this.logger.log('Database migrations are applied');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
