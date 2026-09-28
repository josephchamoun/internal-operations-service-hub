import { INestApplication, RequestMethod } from '@nestjs/common';

export function useApiPrefix(app: INestApplication): void {
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.ALL }],
  });
}
