import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MigrationService } from './migration.service';
import { Logger } from '@nestjs/common';

async function runCliMigrations() {
  const logger = new Logger('MigrationCLI');
  logger.log('Bootstrapping application context for database migrations...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const migrationService = app.get(MigrationService);
    const results = await migrationService.runMigrations();
    logger.log(`Summary: ${results.length} migration(s) evaluated.`);
    await app.close();
    process.exit(0);
  } catch (error) {
    logger.error(`Migration execution failed: ${error.message}`, error.stack);
    await app.close();
    process.exit(1);
  }
}

if (require.main === module) {
  runCliMigrations();
}
