import { All, Controller, Get } from '@nestjs/common';
import { DomainError } from '../../common/errors';

/**
 * AI gateway placeholder. No model, no outbound call, no proposal storage in M1.
 * Every mutating AI route answers 503 so the UI can show an honest "unavailable" state.
 */
@Controller('ai')
export class AiController {
  @Get('status')
  status() {
    return {
      enabled: false,
      mode: 'disabled',
      message: 'AI Assist is not connected in this build. Manual tools are fully available.',
      requires: 'Explicit approval of an AI endpoint and data policy (milestone M4).',
    };
  }

  @All(['proposals', 'proposals/*path'])
  proposals() {
    throw new DomainError(503, 'AI_UNAVAILABLE', 'AI gateway is disabled; no suggestions can be generated', {
      milestone: 'M4',
    });
  }
}
