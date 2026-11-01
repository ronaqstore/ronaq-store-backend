import { Prisma } from '../../generated/prisma/client.js';
import { ResponseConsignmentDto } from '../dto/response-consignment.dto.js';
import { businessToday } from '../../helpers/date.helper.js';

export const CONSIGNMENT_INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      brand: { select: { name: true } },
      trackingType: true,
    },
  },
  customer: { select: { id: true, name: true, phone: true } },
  inventoryUnits: { select: { id: true, status: true, askingPrice: true } },
  saleItem: { select: { id: true, saleId: true } },
} satisfies Prisma.ConsignmentInclude;

export type ConsignmentWithRelations = Prisma.ConsignmentGetPayload<{
  include: typeof CONSIGNMENT_INCLUDE;
}>;

export function mapConsignmentToResponse(
  row: ConsignmentWithRelations,
): ResponseConsignmentDto {
  const activeUnit = row.inventoryUnits?.[0];
  const dto = new ResponseConsignmentDto();
  dto.id = row.id;
  dto.consignmentNo = row.consignmentNo;
  dto.customerId = row.customerId;
  dto.customerName = row.customer?.name ?? null;
  dto.consignorName = row.consignorName;
  dto.consignorPhone = row.consignorPhone;
  dto.consignorCnic = row.consignorCnic;
  dto.productId = row.productId;
  dto.productName = row.product.name;
  dto.imei1 = row.imei1;
  dto.imei2 = row.imei2;
  dto.condition = row.condition;
  dto.batteryHealth = row.batteryHealth;
  dto.defectNotes = row.defectNotes;
  dto.agreedPayout = Number(row.agreedPayout);
  dto.targetSellingPrice =
    row.targetSellingPrice != null ? Number(row.targetSellingPrice) : null;
  dto.status = row.status;
  dto.intakeDate = businessToday(row.intakeDate);
  dto.inventoryUnitId = activeUnit?.id ?? null;
  dto.saleItemId = row.saleItemId;
  dto.soldAt = row.soldAt;
  dto.soldPrice = row.soldPrice != null ? Number(row.soldPrice) : null;
  dto.settledAt = row.settledAt;
  dto.settledAmount =
    row.settledAmount != null ? Number(row.settledAmount) : null;
  dto.payoutMethod = row.payoutMethod;
  dto.payoutReference = row.payoutReference;
  dto.returnedAt = row.returnedAt;
  dto.returnReason = row.returnReason;
  dto.cancelledAt = row.cancelledAt;
  dto.cancelReason = row.cancelReason;
  dto.notes = row.notes;
  dto.createdAt = row.createdAt;
  dto.updatedAt = row.updatedAt;
  return dto;
}
