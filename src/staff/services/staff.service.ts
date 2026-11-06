import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AppConfigurationService } from '../../app-configuration/app-configuration.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserRole, UserStatus } from '../../generated/prisma/enums.js';
import { normalizePhone } from '../../helpers/phone.helper.js';
import { findLoginPhoneConflict } from '../../helpers/login-phone.helper.js';
import { CreateStaffDto } from '../dto/create-staff.dto.js';
import { UpdateStaffDto } from '../dto/update-staff.dto.js';
import { ResponseStaffDto } from '../dto/response-staff.dto.js';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: AppConfigurationService,
  ) {}

  async listStaff(shopId: string): Promise<ResponseStaffDto[]> {
    const users = await this.prisma.user.findMany({
      where: { shopId },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        shopId: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return users;
  }

  async createStaff(
    shopId: string,
    dto: CreateStaffDto,
  ): Promise<ResponseStaffDto> {
    if (dto.role === UserRole.OWNER) {
      throw new BadRequestException('Cannot create staff user with role OWNER');
    }

    const canonicalPhone = normalizePhone(dto.phone);
    if (!canonicalPhone) {
      throw new BadRequestException(
        'phone must be a valid Pakistani mobile number',
      );
    }

    const conflict = await findLoginPhoneConflict(this.prisma, canonicalPhone);
    if (conflict) {
      throw new ConflictException(
        'This phone number is already registered to another account',
      );
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      this.configService.bcryptRounds,
    );

    const user = await this.prisma.user.create({
      data: {
        shopId,
        name: dto.name.trim(),
        phone: canonicalPhone,
        passwordHash,
        role: dto.role,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        shopId: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async updateStaff(
    id: string,
    shopId: string,
    dto: UpdateStaffDto,
  ): Promise<ResponseStaffDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, shopId },
    });

    if (!user) {
      throw new NotFoundException('Staff user not found');
    }

    if (user.role === UserRole.OWNER) {
      if (dto.role && dto.role !== UserRole.OWNER) {
        throw new BadRequestException('Cannot demote shop owner');
      }
      if (dto.status === UserStatus.SUSPENDED) {
        throw new BadRequestException('Cannot suspend shop owner');
      }
    }

    let passwordHash: string | undefined;
    if (dto.password && dto.password.trim().length > 0) {
      passwordHash = await bcrypt.hash(
        dto.password.trim(),
        this.configService.bcryptRounds,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: {
        id: true,
        shopId: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  async deleteStaff(
    id: string,
    shopId: string,
    currentUserId: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id, shopId },
    });

    if (!user) {
      throw new NotFoundException('Staff user not found');
    }

    if (id === currentUserId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    if (user.role === UserRole.OWNER) {
      throw new BadRequestException('Cannot delete shop owner');
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.SUSPENDED },
    });

    return {
      success: true,
      message: 'Staff member suspended successfully',
    };
  }
}
