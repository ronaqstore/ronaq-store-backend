import { BadRequestException } from '@nestjs/common';
import { CreateInventoryAdjustmentDto } from '../dto/create-inventory-adjustment.dto.js';
import {
  adjustmentNotAllowedForSerialized,
  countedQuantityRequired,
  quantityRequired,
  restoreNotAllowedForQuantity,
  unitIdRequired,
  unwantedAdjustmentField,
} from '../../errors/error.builder.js';
import type { InventoryAdjustmentProductShape } from '../services/inventory.service.types.js';

export function assertInventoryAdjustmentShape(
  product: InventoryAdjustmentProductShape,
  dto: CreateInventoryAdjustmentDto,
): void {
  if (dto.type === 'RESTORE') {
    if (product.trackingType !== 'SERIALIZED') {
      throw new BadRequestException(restoreNotAllowedForQuantity(product.name));
    }
    if (dto.inventoryUnitId === undefined) {
      throw new BadRequestException(unitIdRequired(product.name));
    }
    if (dto.quantity !== undefined) {
      throw new BadRequestException(
        unwantedAdjustmentField(product.name, 'RESTORE', 'quantity'),
      );
    }
    if (dto.countedQuantity !== undefined) {
      throw new BadRequestException(
        unwantedAdjustmentField(product.name, 'RESTORE', 'countedQuantity'),
      );
    }
    return;
  }

  if (dto.type === 'ADJUSTMENT') {
    if (product.trackingType === 'SERIALIZED') {
      throw new BadRequestException(
        adjustmentNotAllowedForSerialized(product.name),
      );
    }
    if (dto.countedQuantity === undefined) {
      throw new BadRequestException(countedQuantityRequired(product.name));
    }
    if (dto.quantity !== undefined) {
      throw new BadRequestException(
        unwantedAdjustmentField(product.name, 'ADJUSTMENT', 'quantity'),
      );
    }
    if (dto.inventoryUnitId !== undefined) {
      throw new BadRequestException(
        unwantedAdjustmentField(product.name, 'ADJUSTMENT', 'inventoryUnitId'),
      );
    }
    return;
  }

  if (product.trackingType === 'SERIALIZED') {
    if (dto.inventoryUnitId === undefined) {
      throw new BadRequestException(unitIdRequired(product.name));
    }
    if (dto.quantity !== undefined) {
      throw new BadRequestException(
        unwantedAdjustmentField(product.name, dto.type, 'quantity'),
      );
    }
    if (dto.countedQuantity !== undefined) {
      throw new BadRequestException(
        unwantedAdjustmentField(product.name, dto.type, 'countedQuantity'),
      );
    }
    return;
  }

  if (dto.quantity === undefined) {
    throw new BadRequestException(quantityRequired(product.name));
  }
  if (dto.countedQuantity !== undefined) {
    throw new BadRequestException(
      unwantedAdjustmentField(product.name, dto.type, 'countedQuantity'),
    );
  }
  if (dto.inventoryUnitId !== undefined) {
    throw new BadRequestException(
      unwantedAdjustmentField(product.name, dto.type, 'inventoryUnitId'),
    );
  }
}
