import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api-client';

// ============================================================================
// Types
// ============================================================================

export type SystemConfig = {
  systemName: string;
  organizationName: string;
  systemLanguage: string;
  timezone: string;
  currency: string;
  currencySymbol: string;
  fiscalYearStart: number;
  dateFormat: string;
  numberFormat: string;
  maintenanceMode: boolean;
  allowRegistrations: boolean;
  requireEmailVerification: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
  enforce2FA: boolean;
  allowGoogleAuth: boolean;
  allowMagicLink: boolean;
};

export type FinancialConfig = {
  fondoNacionalPercentage: number;
  honorariosPastoralesDefault: number;
  requiredApprovals: number;
  autoGenerateReports: boolean;
  reportDeadlineDay: number;
  reminderDaysBefore: number;
  allowNegativeBalances: boolean;
  requireReceipts: boolean;
  receiptMinAmount: number;
  autoCalculateTotals: boolean;
  roundingMethod: string;
  enableBudgets: boolean;
  budgetWarningThreshold: number;
  allowManualEntries: boolean;
  requireDoubleEntry: boolean;
};

export type NotificationConfig = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  reportSubmissionNotify: boolean;
  reportApprovalNotify: boolean;
  lowBalanceNotify: boolean;
  lowBalanceThreshold: number;
  monthlyReminderEnabled: boolean;
  weeklyDigestEnabled: boolean;
  notifyAdminsOnErrors: boolean;
  notifyOnNewRegistration: boolean;
  notifyOnLargeTransaction: boolean;
  largeTransactionThreshold: number;
};

export type DefaultFund = {
  name: string;
  percentage: number;
  required: boolean;
  autoCalculate: boolean;
  fundId?: number | string;
  fundType?: string;
  isActive?: boolean;
};

export type FundRecord = {
  id: number | string;
  name: string;
  type?: string;
  is_active?: boolean;
};

export type FundsConfig = {
  defaultFunds: DefaultFund[];
  allowCustomFunds: boolean;
  maxCustomFunds: number;
  trackFundHistory: boolean;
  allowInterFundTransfers: boolean;
  requireTransferApproval: boolean;
  liveFunds?: FundRecord[];
};

export type RoleDefinition = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  editable: boolean;
};

export type RolesConfig = {
  roles: RoleDefinition[];
  permissionMatrix?: Array<{
    role: string;
    permission: string;
    scope?: string | null;
  }>;
};

export type IntegrationConfig = {
  apiEnabled: boolean;
  apiRateLimit: number;
  apiRateLimitWindow: number;
  webhooksEnabled: boolean;
  webhookUrl: string;
  exportEnabled: boolean;
  exportFormats: string[];
  backupEnabled: boolean;
  backupFrequency: string;
  backupRetention: number;
  googleSheetsIntegration: boolean;
  googleSheetsId: string;
  supabaseProjectUrl: string;
  supabaseAnonKey: string;
};

type ConfigSection =
  | 'general'
  | 'financial'
  | 'security'
  | 'integration'
  | 'notifications'
  | 'funds'
  | 'roles';

type ConfigData =
  | SystemConfig
  | FinancialConfig
  | NotificationConfig
  | FundsConfig
  | RolesConfig
  | IntegrationConfig;

// ============================================================================
// Query Functions
// ============================================================================

async function fetchConfigSection<T>(section: ConfigSection): Promise<T | null> {
  const response = await fetchJson<{ data?: { [key: string]: T } }>(
    `/api/admin/configuration?section=${section}`
  );
  return response.data?.[section] ?? null;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch general/system configuration
 */
export function useSystemConfig() {
  return useQuery({
    queryKey: ['admin-config', 'general'],
    queryFn: () => fetchConfigSection<Partial<SystemConfig>>('general'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch financial configuration
 */
export function useFinancialConfig() {
  return useQuery({
    queryKey: ['admin-config', 'financial'],
    queryFn: () => fetchConfigSection<Partial<FinancialConfig>>('financial'),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch security configuration
 */
export function useSecurityConfig() {
  return useQuery({
    queryKey: ['admin-config', 'security'],
    queryFn: () => fetchConfigSection<Partial<SystemConfig>>('security'),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch integration configuration
 */
export function useIntegrationConfig() {
  return useQuery({
    queryKey: ['admin-config', 'integration'],
    queryFn: () => fetchConfigSection<Partial<IntegrationConfig>>('integration'),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch notification configuration
 */
export function useNotificationConfig() {
  return useQuery({
    queryKey: ['admin-config', 'notifications'],
    queryFn: () => fetchConfigSection<Partial<NotificationConfig>>('notifications'),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch funds configuration
 */
export function useFundsConfig() {
  return useQuery({
    queryKey: ['admin-config', 'funds'],
    queryFn: () => fetchConfigSection<Partial<FundsConfig>>('funds'),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch roles configuration
 */
export function useRolesConfig() {
  return useQuery({
    queryKey: ['admin-config', 'roles'],
    queryFn: () => fetchConfigSection<Partial<RolesConfig>>('roles'),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to save configuration for any section
 */
export function useSaveConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ section, data }: { section: ConfigSection; data: ConfigData }) => {
      return await fetchJson('/api/admin/configuration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, data }),
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific section that was updated
      queryClient.invalidateQueries({ queryKey: ['admin-config', variables.section] });
    },
  });
}

/**
 * Composite hook to load all configurations in parallel
 * Use this when you need multiple sections at once
 */
export function useAllConfigs() {
  const systemConfig = useSystemConfig();
  const financialConfig = useFinancialConfig();
  const securityConfig = useSecurityConfig();
  const integrationConfig = useIntegrationConfig();
  const notificationConfig = useNotificationConfig();
  const fundsConfig = useFundsConfig();
  const rolesConfig = useRolesConfig();

  return {
    systemConfig,
    financialConfig,
    securityConfig,
    integrationConfig,
    notificationConfig,
    fundsConfig,
    rolesConfig,
    isLoading:
      systemConfig.isLoading ||
      financialConfig.isLoading ||
      securityConfig.isLoading ||
      integrationConfig.isLoading ||
      notificationConfig.isLoading ||
      fundsConfig.isLoading ||
      rolesConfig.isLoading,
    isError:
      systemConfig.isError ||
      financialConfig.isError ||
      securityConfig.isError ||
      integrationConfig.isError ||
      notificationConfig.isError ||
      fundsConfig.isError ||
      rolesConfig.isError,
  };
}
