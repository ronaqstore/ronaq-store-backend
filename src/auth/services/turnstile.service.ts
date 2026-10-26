import { Injectable, BadRequestException } from '@nestjs/common';
import { AppConfigurationService } from '../../app-configuration/app-configuration.service.js';
import { TURNSTILE_SITEVERIFY_URL } from '../../app-configuration/turnstile.url.js';
import { turnstileFailed } from '../../errors/error.builder.js';
import { logError } from '../../helpers/logger-helper.js';
import type { TurnstileSiteverifyResponse } from './turnstile.service.types.js';

@Injectable()
export class TurnstileService {
  constructor(private readonly config: AppConfigurationService) {}

  async assertValidToken(token: string | undefined | null): Promise<void> {
    if (!this.config.turnstileEnabled) {
      return;
    }

    const trimmed = token?.trim() ?? '';
    if (!trimmed) {
      throw new BadRequestException(turnstileFailed());
    }

    const secret = this.config.turnstileSecretKey;
    if (!secret) {
      throw new BadRequestException(turnstileFailed());
    }

    let result: TurnstileSiteverifyResponse;
    try {
      const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret,
          response: trimmed,
        }),
      });
      result = (await response.json()) as TurnstileSiteverifyResponse;
    } catch (error) {
      logError('turnstile.service.ts', 'assertValidToken', error);
      throw new BadRequestException(turnstileFailed());
    }

    if (result.success !== true) {
      throw new BadRequestException(turnstileFailed());
    }
  }
}
