import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { sanitizeQueryText } from '../../helpers/sanitize-query-text.helper.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ParseProductIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const cleaned = sanitizeQueryText(value, 36);
    if (!cleaned || !UUID_PATTERN.test(cleaned)) {
      throw new BadRequestException('Invalid product id');
    }
    return cleaned.toLowerCase();
  }
}
