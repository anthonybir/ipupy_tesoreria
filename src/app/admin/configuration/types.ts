import type { PastorUserAccess } from '@/types/api';
import type { DefaultFund } from '@/hooks/useAdminConfiguration';

export type SafeDefaultFund = DefaultFund;

export type SafePastorAccessDialogProps = {
  pastorId: number;
  pastor?: PastorUserAccess | undefined;
  onClose: () => void;
};
