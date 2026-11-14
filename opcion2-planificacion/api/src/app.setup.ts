import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as fs from 'fs';
import * as path from 'path';
import * as swaggerUi from 'swagger-ui-express';
import * as yaml from 'yaml';
import { ProblemDetailsFilter } from './common/errors/problem-details.filter';
import { validationExceptionFactory } from './common/errors/validation-exception.factory';
import { requestIdMiddleware } from './common/http/request-id.middleware';

export function setupApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(requestIdMiddleware);
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());

  const specPath = path.resolve(process.cwd(), '../../openapi.yaml');
  if (fs.existsSync(specPath)) {
    const spec = yaml.parse(fs.readFileSync(specPath, 'utf8'));
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(
      '/api/docs',
      swaggerUi.serve,
      swaggerUi.setup(spec, {
        swaggerOptions: { persistAuthorization: true },
        customSiteTitle: 'API Fogonería — Órdenes',
      }),
    );
  }
}
