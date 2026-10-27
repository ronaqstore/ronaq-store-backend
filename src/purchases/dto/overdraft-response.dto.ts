import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsString } from 'class-validator';

export class PurchaseOverdraftResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  confirmOverdraft: true;

  @ApiProperty({
    description:
      'Paisa the drawer would go below zero by. Divide by 100 to display.',
    example: 500000,
  })
  @IsNumber()
  shortfall: number;

  @ApiProperty({
    example:
      'Warning: You have insufficient cash in your drawer (Shortfall: Rs 5,000). Paying this will make your cash balance negative. Do you want to proceed?',
  })
  @IsString()
  message: string;

  constructor(shortfall: number, subject: string = 'payment') {
    this.confirmOverdraft = true;
    this.shortfall = shortfall;
    const shortfallRs = Math.round(shortfall / 100).toLocaleString('en-PK');
    this.message = `Warning: You have insufficient cash in your drawer (Shortfall: Rs ${shortfallRs}). This ${subject} will make your cash balance negative. Do you want to proceed?`;
  }
}
