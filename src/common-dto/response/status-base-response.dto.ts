import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString } from 'class-validator';

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

  constructor(status: boolean, message: string) {
    this.status = status;
    this.message = message;
  }
}
