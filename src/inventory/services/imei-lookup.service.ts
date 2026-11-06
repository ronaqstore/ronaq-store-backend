import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InventoryMovementType } from '../../generated/prisma/enums.js';
import { businessToday, shiftDays } from '../../helpers/date.helper.js';
import { daysBetween } from '../../dashboard/helpers/dashboard-date.helper.js';
import {
  ImeiDeviceInfoDto,
  ImeiIntakeInfoDto,
  ImeiSaleInfoDto,
  ImeiTimelineEventDto,
  ResponseImeiLookupDto,
} from '../dto/imei-lookup.dto.js';

const IMEI_UNIT_LOOKUP_INCLUDE = {
  product: {
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
    },
  },
  purchaseItem: {
    include: {
      purchase: {
        include: {
          supplier: {
            select: { id: true, name: true, phone: true },
          },
        },
      },
    },
  },
  consignment: true,
  saleItems: {
    include: {
      sale: {
        include: {
          customer: {
            select: { id: true, name: true, phone: true },
          },
        },
      },
    },
    orderBy: { id: 'desc' as const },
  },
  returnItems: {
    include: {
      saleReturn: true,
    },
    orderBy: { id: 'desc' as const },
  },
  movements: {
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

@Injectable()
export class ImeiLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async lookupImei(
    rawImei: string,
    shopId: string,
  ): Promise<ResponseImeiLookupDto> {
    const trimmed = rawImei?.trim() ?? '';
    if (!trimmed) {
      return {
        found: false,
        message: 'No IMEI provided',
        salesHistory: [],
        timeline: [],
      };
    }

    const cleaned = trimmed.replace(/[-\s]/g, '');
    const tokens = trimmed.split(/[/,;\s]+/).filter((t) => t.length > 0);
    const candidateSet = new Set<string>([trimmed, cleaned, ...tokens]);
    const candidates = Array.from(candidateSet);

    let unit = await this.prisma.inventoryUnit.findFirst({
      where: {
        shopId,
        OR: [{ imei1: { in: candidates } }, { imei2: { in: candidates } }],
      },
      include: IMEI_UNIT_LOOKUP_INCLUDE,
    });

    if (!unit && cleaned.length >= 8) {
      unit = await this.prisma.inventoryUnit.findFirst({
        where: {
          shopId,
          OR: [
            { imei1: { startsWith: cleaned } },
            { imei2: { startsWith: cleaned } },
          ],
        },
        include: IMEI_UNIT_LOOKUP_INCLUDE,
      });
    }

    if (!unit) {
      return {
        found: false,
        message: `Device with IMEI "${trimmed}" not found in this shop`,
        salesHistory: [],
        timeline: [],
      };
    }

    const today = businessToday();
    const purchase = unit.purchaseItem?.purchase;
    const consignment = unit.consignment;

    let intakeDateStr = unit.createdAt.toISOString().slice(0, 10);
    let intake: ImeiIntakeInfoDto;

    if (purchase) {
      intakeDateStr = purchase.purchaseDate
        ? purchase.purchaseDate.toISOString().slice(0, 10)
        : intakeDateStr;
      intake = {
        type: 'PURCHASE',
        purchaseId: purchase.id,
        purchaseNo: purchase.purchaseNo,
        purchaseDate: intakeDateStr,
        supplierInvoiceRef: purchase.supplierInvoiceRef ?? null,
        supplierId: purchase.supplier?.id ?? null,
        supplierName: purchase.supplier?.name ?? null,
        supplierPhone: purchase.supplier?.phone ?? null,
      };
    } else if (consignment) {
      intakeDateStr = consignment.intakeDate
        ? consignment.intakeDate.toISOString().slice(0, 10)
        : intakeDateStr;
      intake = {
        type: 'CONSIGNMENT',
        consignmentId: consignment.id,
        consignmentNo: consignment.consignmentNo,
        intakeDate: intakeDateStr,
        consignorName: consignment.consignorName,
        consignorPhone: consignment.consignorPhone,
        agreedPayout: Number(consignment.agreedPayout),
      };
    } else {
      intake = {
        type: 'PURCHASE',
      };
    }

    const salesHistory: ImeiSaleInfoDto[] = unit.saleItems.map((si) => {
      const sale = si.sale;
      const salePrice = Number(si.unitPrice);
      const unitCost = Number(unit.unitCost);
      const profitAmount = salePrice - unitCost;
      const profitMarginPercent =
        salePrice > 0
          ? Math.round(((salePrice - unitCost) / salePrice) * 1000) / 10
          : 0;

      const saleDateStr = sale.saleDate
        ? sale.saleDate.toISOString().slice(0, 10)
        : today;

      let warrantyType: 'SHOP_WARRANTY' | 'OFFICIAL_WARRANTY' | 'NO_WARRANTY' =
        'NO_WARRANTY';
      let warrantyEndsAt: string | null = null;
      let warrantyDaysLeft: number | null = null;
      let isWarrantyActive = false;

      if (si.warrantyDays && si.warrantyDays > 0) {
        warrantyType = 'SHOP_WARRANTY';
        warrantyEndsAt = shiftDays(saleDateStr, si.warrantyDays);
        const dayDiff = Math.round(
          (new Date(warrantyEndsAt).getTime() - new Date(today).getTime()) /
            86400000,
        );
        isWarrantyActive = sale.status === 'ACTIVE' && warrantyEndsAt >= today;
        warrantyDaysLeft = isWarrantyActive ? Math.max(0, dayDiff) : 0;
      } else if (unit.condition === 'NEW') {
        warrantyType = 'OFFICIAL_WARRANTY';
        isWarrantyActive = sale.status === 'ACTIVE';
      }

      return {
        saleId: sale.id,
        saleNo: sale.saleNo,
        saleDate: saleDateStr,
        saleStatus: sale.status,
        customerId: sale.customer?.id ?? null,
        customerName: sale.customer?.name ?? 'Walk-in Customer',
        customerPhone: sale.customer?.phone ?? null,
        salePrice,
        profitAmount,
        profitMarginPercent,
        warrantyType,
        warrantyDays: si.warrantyDays ?? null,
        warrantyEndsAt,
        warrantyDaysLeft,
        isWarrantyActive,
      };
    });

    const activeSale = salesHistory.find((s) => s.saleStatus === 'ACTIVE');
    const latestSale = activeSale ?? salesHistory[0] ?? null;

    let daysOnShelf: number;
    if (unit.status === 'SOLD' && latestSale) {
      daysOnShelf = Math.max(
        1,
        daysBetween(intakeDateStr, latestSale.saleDate),
      );
    } else {
      daysOnShelf = Math.max(1, daysBetween(intakeDateStr, today));
    }

    const defaultSelling = Number(unit.product.defaultSellingPrice);
    const asking = unit.askingPrice != null ? Number(unit.askingPrice) : null;
    const effectivePrice = asking ?? defaultSelling;

    const device: ImeiDeviceInfoDto = {
      id: unit.id,
      productId: unit.productId,
      productName: unit.product.name,
      brandName: unit.product.brand?.name ?? null,
      categoryName: unit.product.category?.name ?? null,
      model: unit.product.model ?? null,
      color: unit.product.color ?? null,
      storage: unit.product.storage ?? null,
      ram: unit.product.ram ?? null,
      sku: unit.product.sku ?? null,
      barcode: unit.product.barcode ?? null,
      ptaStatus: unit.product.ptaStatus ?? null,
      imei1: unit.imei1,
      imei2: unit.imei2 ?? null,
      condition: unit.condition,
      status: unit.status,
      unitCost: Number(unit.unitCost),
      askingPrice: asking,
      effectivePrice,
      batteryHealth: unit.batteryHealth ?? null,
      defectNotes: unit.defectNotes ?? null,
      createdAt: unit.createdAt.toISOString(),
      daysOnShelf,
    };

    const timeline: ImeiTimelineEventDto[] = [];

    for (const m of unit.movements) {
      let title = m.type as string;
      let description = m.reason ?? '';
      let referenceNo: string | null = null;

      if (m.type === InventoryMovementType.PURCHASE) {
        title = purchase?.supplier?.name
          ? `Purchased from ${purchase.supplier.name}`
          : 'Purchased Stock';
        referenceNo = purchase?.purchaseNo ?? null;
        description = referenceNo
          ? `Purchase Bill #${referenceNo}`
          : description;
      } else if (m.type === InventoryMovementType.CONSIGNMENT_INTAKE) {
        title = consignment?.consignorName
          ? `Intake on Consignment from ${consignment.consignorName}`
          : 'Consignment Intake';
        referenceNo = consignment?.consignmentNo ?? null;
        description = referenceNo ? `Consignment #${referenceNo}` : description;
      } else if (m.type === InventoryMovementType.SALE) {
        const matchingSaleItem = unit.saleItems.find(
          (si) => si.sale.id === m.referenceId || si.id === m.referenceId,
        );
        const saleRef = matchingSaleItem?.sale;
        const custName = saleRef?.customer?.name ?? 'Walk-in';
        referenceNo = saleRef?.saleNo ?? null;
        title = `Sold to ${custName}`;
        description = referenceNo
          ? `Sale Invoice #${referenceNo}`
          : description;
      } else if (m.type === InventoryMovementType.CUSTOMER_RETURN) {
        title = 'Returned by Customer';
        description = m.reason ?? 'Device returned to store';
      } else if (m.type === InventoryMovementType.SALE_CANCEL) {
        title = 'Sale Cancelled';
        description = m.reason ?? 'Restored to inventory';
      } else if (m.type === InventoryMovementType.PURCHASE_CANCEL) {
        title = 'Purchase Cancelled';
        description = m.reason ?? 'Removed from inventory';
      } else if (m.type === InventoryMovementType.DAMAGED) {
        title = 'Marked Damaged';
        description = m.reason ?? 'Written off as damaged';
      } else if (m.type === InventoryMovementType.LOST) {
        title = 'Marked Lost';
        description = m.reason ?? 'Written off as lost';
      } else if (m.type === InventoryMovementType.ADJUSTMENT) {
        title = 'Stock Adjustment';
        description = m.reason ?? 'Inventory adjustment';
      } else if (m.type === InventoryMovementType.CONSIGNMENT_RETURN) {
        title = 'Returned to Consignor';
        description = m.reason ?? 'Returned back to owner';
      }

      timeline.push({
        id: m.id,
        date: m.createdAt.toISOString(),
        type: m.type,
        title,
        description,
        referenceType: m.referenceType ?? null,
        referenceId: m.referenceId ?? null,
        referenceNo,
      });
    }

    timeline.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return {
      found: true,
      device,
      intake,
      latestSale,
      salesHistory,
      timeline,
    };
  }
}
