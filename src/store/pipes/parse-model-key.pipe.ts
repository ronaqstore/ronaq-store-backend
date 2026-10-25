import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { sanitizeQueryText } from '../../helpers/sanitize-query-text.helper.js';
import { parseModelKey } from '../../helpers/slug.helper.js';

const MODEL_KEY_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*--[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Injectable()
export class ParseModelKeyPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const cleaned = sanitizeQueryText(value, 160)?.toLowerCase();
    if (
      !cleaned ||
      !MODEL_KEY_PATTERN.test(cleaned) ||
      !parseModelKey(cleaned)
    ) {
      throw new BadRequestException('Invalid model key');
    }
    return cleaned;
  }
}
