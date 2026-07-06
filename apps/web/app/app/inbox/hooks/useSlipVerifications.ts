import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../../lib/api-client";

export interface SlipVerification {
  id: string;
  tenantId: string;
  conversationId: string;
  messageId: string | null;
  r2ImageKey: string;
  ocrText: string | null;
  bankName: string | null;
  amount: number | string | null;
  transactionRef: string | null;
  transferDate: string | null;
  slipScore: number;
  detectStatus: string;
  verifyStatus: string; // PENDING, VERIFIED, INVALID, DUPLICATE, MANUAL_REVIEW
  intent: string | null;
  qrDecodedRaw: string | null;
  qrDecodeStatus: string;
  verifyProvider: string | null;
  verifyPayload: any;
  slipokCostCharged: boolean;
  createdAt: string;
}

export function useSlipVerifications(conversationId: string | null) {
  const [slips, setSlips] = useState<SlipVerification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSlips = useCallback(async (convId: string) => {
    setIsLoading(true);
    try {
      const data = await apiFetch<SlipVerification[]>(
        `/api/v1/inbox/conversations/${convId}/slip-verifications`
      );
      setSlips(Array.isArray(data) ? data : []);
    } catch {
      setSlips([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (conversationId) {
      void loadSlips(conversationId);
    } else {
      setSlips([]);
    }
  }, [conversationId, loadSlips]);

  return { slips, isLoading, refetch: loadSlips };
}
