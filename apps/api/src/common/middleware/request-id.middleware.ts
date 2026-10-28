import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const rawHeader = req.headers[REQUEST_ID_HEADER];
    const requestId =
      typeof rawHeader === 'string' && rawHeader.trim() !== ''
        ? rawHeader.trim()
        : uuidv4();

    // Attach to request and headers
    (req as any).id = requestId;
    req.headers[REQUEST_ID_HEADER] = requestId;

    // Echo back in response header
    res.setHeader('X-Request-Id', requestId);

    next();
  }
}
