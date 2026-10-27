import type { ResponseRefundDto } from '../returns/dto/response-return.dto.js';

type RefundRow = {
  id: string;
  amount: bigint;
  refundDate: Date;
  method: string;
  notes: string | null;
  clientRequestId?: string | null;
};

export function mapRefundRows(refunds: RefundRow[]): ResponseRefundDto[] {
  return refunds.map((refund) => ({
    id: refund.id,
    amount: Number(refund.amount),
    refundDate: refund.refundDate,
    method: refund.method,
    notes: refund.notes,
    clientRequestId: refund.clientRequestId ?? null,
  }));
}
