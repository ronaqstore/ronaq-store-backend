import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class ErrorResponseDTO {
  @ApiProperty()
  @IsString()
  error: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  message: string[];

  @ApiProperty()
  @IsNumber()
  statusCode: number;

  @ApiPropertyOptional({
    description: 'Stable machine code for clients to map field-level errors.',
  })
  @IsOptional()
  @IsString()
  code?: string;

  constructor(
    error: string,
    message: string[],
    statusCode: number,
    code?: string,
  ) {
    this.error = error;
    this.message = message;
    this.statusCode = statusCode;
    if (code) this.code = code;
  }
}
