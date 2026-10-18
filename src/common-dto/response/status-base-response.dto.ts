import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class StatusBaseResponseDTO {
  @ApiProperty({ example: true, description: 'Whether the mutation succeeded' })
  @IsBoolean()
  status: boolean;

  @ApiProperty({
    example: 'Brand created successfully',
    description: 'Human friendly result message to show the shop owner',
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-000000000000',
    description: 'Optional ID of the created or affected entity',
  })
  @IsOptional()
  @IsString()
  id?: string;

  constructor(status: boolean, message: string, id?: string) {
    this.status = status;
    this.message = message;
    if (id) {
      this.id = id;
    }
  }
}
