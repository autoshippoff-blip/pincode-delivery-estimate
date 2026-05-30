import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, limit, ttl, throttler, blockDuration, generateKey } = requestProps;
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    let tracker = '';
    if (throttler.name === 'apiKey') {
      const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'] || req.headers['x-api-key'.toLowerCase()];
      // If API key is present in request headers, track by API key. Otherwise, track by IP fallback.
      tracker = apiKey && typeof apiKey === 'string' ? `apiKey:${apiKey.trim()}` : `ip:${req.ip}`;
    } else {
      tracker = `ip:${req.ip}`;
    }

    const key = generateKey(context, tracker, throttler.name || 'default');
    const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } = await this.storageService.increment(
      key,
      ttl,
      limit,
      blockDuration,
      throttler.name || 'default',
    );

    if (isBlocked) {
      res.header('Retry-After', Math.ceil(timeToExpire).toString());
      await this.throwThrottlingException(context, {
        limit,
        ttl,
        key,
        tracker,
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      });
    }

    return true;
  }
}
