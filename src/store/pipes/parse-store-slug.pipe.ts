import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { sanitizeQueryText } from '../../helpers/sanitize-query-text.helper.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Injectable()
export class ParseStoreSlugPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const cleaned = sanitizeQueryText(value, 80)?.toLowerCase();
    if (!cleaned || !SLUG_PATTERN.test(cleaned)) {
      throw new BadRequestException('Invalid store slug');
    }
    return cleaned;
  }
}
