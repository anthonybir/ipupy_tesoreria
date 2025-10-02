'use client';

import React, { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { rawValueToNumber } from '@/lib/utils/currency';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Settings,
  Users,
  Building,
  DollarSign,
  Shield,
  Database,
  Bell,
  UserPlus,
  Save,
  RefreshCw,
} from 'lucide-react';
import { BanknotesIcon } from '@heroicons/react/24/outline';
import { PageHeader } from '@/components/Shared';
import {
  useSystemConfig,
  useFinancialConfig,
  useSecurityConfig,
  useIntegrationConfig,
  useNotificationConfig,
  useFundsConfig,
  useRolesConfig,
  useSaveConfig,
  type SystemConfig,
  type FinancialConfig,
  type NotificationConfig,
  type FundsConfig,
  type RolesConfig,
  type IntegrationConfig,
} from '@/hooks/useAdminConfiguration';
import { usePastorAccess } from '@/hooks/usePastorAccess';
import { GrantAccessDialog, ChangeRoleDialog, RevokeAccessDialog } from '@/components/Admin/PastorAccessDialogs';
import type { ChurchRecord } from '@/types/api';
import toast from 'react-hot-toast';

type AdminUser = {
  id: number | string;
  full_name?: string | null;
  email: string;
  role: string;
  church_name?: string | null;
  is_active?: boolean;
};

type AdminChurch = ChurchRecord & {
  last_report?: string | null;
};

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

type SetConfig<T> = Dispatch<SetStateAction<T>>;

type SecurityConfigurationSectionProps = {
  config: SystemConfig;
  setConfig: SetConfig<SystemConfig>;
  onSave: () => void;
  loading: boolean;
};

type IntegrationConfigurationSectionProps = {
  config: IntegrationConfig;
  setConfig: SetConfig<IntegrationConfig>;
  onSave: () => void;
  loading: boolean;
};

// Configuration sections
const ConfigurationPage = () => {
  const [activeTab, setActiveTab] = useState('general');

  // Load all configurations using TanStack Query hooks
  const systemConfigQuery = useSystemConfig();
  const financialConfigQuery = useFinancialConfig();
  const securityConfigQuery = useSecurityConfig();
  const integrationConfigQuery = useIntegrationConfig();
  const notificationConfigQuery = useNotificationConfig();
  const fundsConfigQuery = useFundsConfig();
  const rolesConfigQuery = useRolesConfig();

  // Save mutation
  const saveConfig = useSaveConfig();

  // Default values
  const defaultSystemConfig: SystemConfig = {
    systemName: 'IPU PY Tesorería',
    organizationName: 'Iglesia Pentecostal Unida del Paraguay',
    systemLanguage: 'es',
    timezone: 'America/Asuncion',
    currency: 'PYG',
    currencySymbol: '₲',
    fiscalYearStart: 1,
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'es-PY',
    maintenanceMode: false,
    allowRegistrations: false,
    requireEmailVerification: true,
    sessionTimeout: 60,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    enforce2FA: false,
    allowGoogleAuth: true,
    allowMagicLink: true,
  };

  const defaultFinancialConfig: FinancialConfig = {
    fondoNacionalPercentage: 10,
    honorariosPastoralesDefault: 0,
    requiredApprovals: 2,
    autoGenerateReports: true,
    reportDeadlineDay: 5,
    reminderDaysBefore: 3,
    allowNegativeBalances: false,
    requireReceipts: true,
    receiptMinAmount: 100000,
    autoCalculateTotals: true,
    roundingMethod: 'nearest',
    enableBudgets: true,
    budgetWarningThreshold: 80,
    allowManualEntries: true,
    requireDoubleEntry: true,
  };

  const defaultNotificationConfig: NotificationConfig = {
    emailEnabled: true,
    smsEnabled: false,
    whatsappEnabled: false,
    reportSubmissionNotify: true,
    reportApprovalNotify: true,
    lowBalanceNotify: true,
    lowBalanceThreshold: 500000,
    monthlyReminderEnabled: true,
    weeklyDigestEnabled: false,
    notifyAdminsOnErrors: true,
    notifyOnNewRegistration: true,
    notifyOnLargeTransaction: true,
    largeTransactionThreshold: 10000000,
  };

  const defaultFundsConfig: FundsConfig = {
    defaultFunds: [
      { name: 'Fondo Nacional', percentage: 10, required: true, autoCalculate: true },
      { name: 'Misiones', percentage: 0, required: false, autoCalculate: false },
      { name: 'Instituto Bíblico', percentage: 0, required: false, autoCalculate: false },
      { name: 'Caballeros', percentage: 0, required: false, autoCalculate: false },
      { name: 'Damas', percentage: 0, required: false, autoCalculate: false },
      { name: 'Niños', percentage: 0, required: false, autoCalculate: false },
      { name: 'APY', percentage: 0, required: false, autoCalculate: false },
      { name: 'Lazos de Amor', percentage: 0, required: false, autoCalculate: false },
      { name: 'Misión Posible', percentage: 0, required: false, autoCalculate: false },
    ],
    allowCustomFunds: true,
    maxCustomFunds: 10,
    trackFundHistory: true,
    allowInterFundTransfers: true,
    requireTransferApproval: true,
    liveFunds: [],
  };

  const defaultRolesConfig: RolesConfig = {
    roles: [
      {
        id: 'admin',
        name: 'Administrador',
        description: 'Acceso completo al sistema',
        permissions: ['all'],
        editable: false,
      },
      {
        id: 'district_supervisor',
        name: 'Supervisor de Distrito',
        description: 'Gestión de múltiples iglesias',
        permissions: ['churches.view', 'reports.view', 'reports.approve', 'funds.view'],
        editable: true,
      },
      {
        id: 'treasurer',
        name: 'Tesorero',
        description: 'Gestión financiera',
        permissions: ['reports.create', 'reports.edit', 'transactions.manage', 'funds.view'],
        editable: true,
      },
      {
        id: 'pastor',
        name: 'Pastor',
        description: 'Gestión de iglesia local',
        permissions: ['reports.create', 'reports.view.own', 'members.manage.own'],
        editable: true,
      },
      {
        id: 'secretary',
        name: 'Secretario',
        description: 'Asistencia administrativa',
        permissions: ['reports.view', 'members.view', 'documents.manage'],
        editable: true,
      },
      {
        id: 'fund_director',
        name: 'Director de Fondos',
        description: 'Acceso de solo lectura a fondos asignados',
        permissions: ['funds.view.assigned', 'transactions.view.assigned', 'reports.view.assigned'],
        editable: false,
      },
      {
        id: 'member',
        name: 'Miembro',
        description: 'Acceso básico de solo lectura',
        permissions: ['reports.view.own', 'profile.edit'],
        editable: true,
      },
    ],
  };

  const defaultIntegrationConfig: IntegrationConfig = {
    apiEnabled: true,
    apiRateLimit: 1000,
    apiRateLimitWindow: 3600,
    webhooksEnabled: false,
    webhookUrl: '',
    exportEnabled: true,
    exportFormats: ['excel', 'pdf', 'csv'],
    backupEnabled: true,
    backupFrequency: 'daily',
    backupRetention: 30,
    googleSheetsIntegration: false,
    googleSheetsId: '',
    supabaseProjectUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  };

  // Merge loaded data with defaults
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(defaultSystemConfig);
  const [financialConfig, setFinancialConfig] = useState<FinancialConfig>(defaultFinancialConfig);
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>(defaultNotificationConfig);
  const [fundsConfig, setFundsConfig] = useState<FundsConfig>(defaultFundsConfig);
  const [rolesConfig, setRolesConfig] = useState<RolesConfig>(defaultRolesConfig);
  const [integrationConfig, setIntegrationConfig] = useState<IntegrationConfig>(defaultIntegrationConfig);

  // Update state when queries complete
  useEffect(() => {
    if (systemConfigQuery.data) {
      setSystemConfig((prev) => ({ ...prev, ...systemConfigQuery.data }));
    }
  }, [systemConfigQuery.data]);

  useEffect(() => {
    if (securityConfigQuery.data) {
      setSystemConfig((prev) => ({ ...prev, ...securityConfigQuery.data }));
    }
  }, [securityConfigQuery.data]);

  useEffect(() => {
    if (financialConfigQuery.data) {
      setFinancialConfig((prev) => ({ ...prev, ...financialConfigQuery.data }));
    }
  }, [financialConfigQuery.data]);

  useEffect(() => {
    if (notificationConfigQuery.data) {
      setNotificationConfig((prev) => ({ ...prev, ...notificationConfigQuery.data }));
    }
  }, [notificationConfigQuery.data]);

  useEffect(() => {
    if (fundsConfigQuery.data) {
      setFundsConfig((prev) => ({ ...prev, ...fundsConfigQuery.data }));
    }
  }, [fundsConfigQuery.data]);

  useEffect(() => {
    if (rolesConfigQuery.data) {
      setRolesConfig((prev) => ({ ...prev, ...rolesConfigQuery.data }));
    }
  }, [rolesConfigQuery.data]);

  useEffect(() => {
    if (integrationConfigQuery.data) {
      setIntegrationConfig((prev) => ({ ...prev, ...integrationConfigQuery.data }));
    }
  }, [integrationConfigQuery.data]);

  const handleSaveConfiguration = async (
    section:
      | 'general'
      | 'financial'
      | 'security'
      | 'integration'
      | 'notifications'
      | 'funds'
      | 'roles',
  ) => {
    try {
      const data = section === 'general' ? systemConfig :
            section === 'financial' ? financialConfig :
            section === 'security' ? systemConfig :
            section === 'notifications' ? notificationConfig :
            section === 'funds' ? fundsConfig :
            section === 'roles' ? rolesConfig :
            integrationConfig;

      await saveConfig.mutateAsync({ section, data });
      toast.success('Configuración guardada correctamente');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al guardar configuración');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <PageHeader
        title="Configuración del sistema"
        subtitle="Gestione la configuración global del sistema IPU PY Tesorería"
        badge={{ label: 'Panel administrativo', tone: 'info' }}
        actions={
          <Button type="button" variant="ghost" size="sm" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Volver arriba
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 gap-2 h-auto p-2">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Financiero
          </TabsTrigger>
          <TabsTrigger value="funds" className="flex items-center gap-2">
            <BanknotesIcon className="h-4 w-4" />
            Fondos
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificaciones
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="pastor-access" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Acceso Pastores
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="churches" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Iglesias
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Seguridad
          </TabsTrigger>
          <TabsTrigger value="integration" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Integración
          </TabsTrigger>
        </TabsList>

        {/* General Configuration Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Configuración General del Sistema</CardTitle>
              <CardDescription>
                Configure los parámetros básicos del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="systemName">Nombre del Sistema</Label>
                  <Input
                    id="systemName"
                    value={systemConfig.systemName}
                    onChange={(e) => setSystemConfig({...systemConfig, systemName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organizationName">Nombre de la Organización</Label>
                  <Input
                    id="organizationName"
                    value={systemConfig.organizationName}
                    onChange={(e) => setSystemConfig({...systemConfig, organizationName: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="language">Idioma del Sistema</Label>
                  <Select value={systemConfig.systemLanguage} onValueChange={(value) => setSystemConfig({...systemConfig, systemLanguage: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="gn">Guaraní</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Zona Horaria</Label>
                  <Select value={systemConfig.timezone} onValueChange={(value) => setSystemConfig({...systemConfig, timezone: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Asuncion">Paraguay (Asunción)</SelectItem>
                      <SelectItem value="America/Buenos_Aires">Argentina</SelectItem>
                      <SelectItem value="America/Sao_Paulo">Brasil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda</Label>
                  <Select value={systemConfig.currency} onValueChange={(value) => setSystemConfig({...systemConfig, currency: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PYG">Guaraní (₲)</SelectItem>
                      <SelectItem value="USD">Dólar ($)</SelectItem>
                      <SelectItem value="EUR">Euro (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Modo de Mantenimiento</Label>
                    <p className="text-sm text-muted-foreground">
                      Desactiva el acceso al sistema excepto para administradores
                    </p>
                  </div>
                  <Switch
                    checked={systemConfig.maintenanceMode}
                    onCheckedChange={(checked) => setSystemConfig({...systemConfig, maintenanceMode: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Permitir Registros</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite que nuevas iglesias se registren en el sistema
                    </p>
                  </div>
                  <Switch
                    checked={systemConfig.allowRegistrations}
                    onCheckedChange={(checked) => setSystemConfig({...systemConfig, allowRegistrations: checked})}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSaveConfiguration('general')} disabled={saveConfig.isPending} loading={saveConfig.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Configuración General
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Configuration Tab */}
        <TabsContent value="financial">
          <Card>
            <CardHeader>
              <CardTitle>Configuración Financiera</CardTitle>
              <CardDescription>
                Configure los parámetros financieros y contables del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fondoNacional">% Fondo Nacional</Label>
                  <Input
                    id="fondoNacional"
                    type="number"
                    min="0"
                    max="100"
                    value={financialConfig.fondoNacionalPercentage}
                    onChange={(e) => setFinancialConfig({...financialConfig, fondoNacionalPercentage: parseInt(e.target.value)})}
                  />
                  <p className="text-xs text-muted-foreground">Porcentaje automático del fondo nacional</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reportDeadline">Día de Cierre de Informes</Label>
                  <Input
                    id="reportDeadline"
                    type="number"
                    min="1"
                    max="31"
                    value={financialConfig.reportDeadlineDay}
                    onChange={(e) => setFinancialConfig({...financialConfig, reportDeadlineDay: parseInt(e.target.value)})}
                  />
                  <p className="text-xs text-muted-foreground">Día del mes para entregar informes</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiptMin">Monto Mínimo para Recibo</Label>
                  <CurrencyInput
                    id="receiptMin"
                    value={String(financialConfig.receiptMinAmount)}
                    onValueChange={(rawValue) =>
                      setFinancialConfig({
                        ...financialConfig,
                        receiptMinAmount: rawValueToNumber(rawValue),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">Monto mínimo que requiere recibo</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Generar Informes Automáticamente</Label>
                    <p className="text-sm text-muted-foreground">
                      Crea informes mensuales automáticamente
                    </p>
                  </div>
                  <Switch
                    checked={financialConfig.autoGenerateReports}
                    onCheckedChange={(checked) => setFinancialConfig({...financialConfig, autoGenerateReports: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Permitir Balances Negativos</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite que los fondos tengan balance negativo
                    </p>
                  </div>
                  <Switch
                    checked={financialConfig.allowNegativeBalances}
                    onCheckedChange={(checked) => setFinancialConfig({...financialConfig, allowNegativeBalances: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Requerir Recibos</Label>
                    <p className="text-sm text-muted-foreground">
                      Exige recibos para todas las transacciones
                    </p>
                  </div>
                  <Switch
                    checked={financialConfig.requireReceipts}
                    onCheckedChange={(checked) => setFinancialConfig({...financialConfig, requireReceipts: checked})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Contabilidad de Doble Entrada</Label>
                    <p className="text-sm text-muted-foreground">
                      Requiere balance de débitos y créditos
                    </p>
                  </div>
                  <Switch
                    checked={financialConfig.requireDoubleEntry}
                    onCheckedChange={(checked) => setFinancialConfig({...financialConfig, requireDoubleEntry: checked})}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSaveConfiguration('financial')} disabled={saveConfig.isPending} loading={saveConfig.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Configuración Financiera
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Management Tab */}
        <TabsContent value="users">
          <UserManagementSection />
        </TabsContent>

        {/* Churches Management Tab */}
        <TabsContent value="churches">
          <ChurchManagementSection />
        </TabsContent>

        {/* Security Configuration Tab */}
        <TabsContent value="security">
          <SecurityConfigurationSection
            config={systemConfig}
            setConfig={setSystemConfig}
            onSave={() => handleSaveConfiguration('security')}
            loading={saveConfig.isPending}
          />
        </TabsContent>

        {/* Notifications Configuration Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Notificaciones</CardTitle>
              <CardDescription>
                Configure las notificaciones y alertas del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificaciones por Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar notificaciones por correo electrónico
                    </p>
                  </div>
                  <Switch
                    checked={notificationConfig.emailEnabled}
                    onCheckedChange={(checked) =>
                      setNotificationConfig({ ...notificationConfig, emailEnabled: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificar Envío de Informes</Label>
                    <p className="text-sm text-muted-foreground">
                      Alertar cuando se envíen nuevos informes
                    </p>
                  </div>
                  <Switch
                    checked={notificationConfig.reportSubmissionNotify}
                    onCheckedChange={(checked) =>
                      setNotificationConfig({ ...notificationConfig, reportSubmissionNotify: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Recordatorios Mensuales</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar recordatorios para informes mensuales
                    </p>
                  </div>
                  <Switch
                    checked={notificationConfig.monthlyReminderEnabled}
                    onCheckedChange={(checked) =>
                      setNotificationConfig({ ...notificationConfig, monthlyReminderEnabled: checked })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSaveConfiguration('notifications')} disabled={saveConfig.isPending} loading={saveConfig.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Notificaciones
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Funds Configuration Tab */}
        <TabsContent value="funds">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Fondos</CardTitle>
              <CardDescription>
                Gestione los fondos y porcentajes predeterminados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {fundsConfig.defaultFunds.map((fund, index) => (
                  <div key={fund.fundId ?? `${fund.name}-${index}`} className="grid grid-cols-4 gap-4 items-end">
                    <div className="space-y-2">
                      <Label>Nombre del Fondo</Label>
                      <Input value={fund.name} readOnly disabled />
                      <div className="flex flex-wrap gap-2 text-xs">
                        {fund.fundType ? (
                          <Badge variant="outline" className="uppercase">
                            {fund.fundType.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                        ) : null}
                        {typeof fund.isActive === 'boolean' ? (
                          <Badge variant={fund.isActive ? 'success' : 'secondary'}>
                            {fund.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Porcentaje (%)</Label>
                      <Input
                        type="number"
                        value={fund.percentage}
                        onChange={(e) => {
                          const newFunds = [...fundsConfig.defaultFunds];
                          newFunds[index].percentage = Number(e.target.value);
                          setFundsConfig({ ...fundsConfig, defaultFunds: newFunds });
                        }}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={fund.autoCalculate}
                        onCheckedChange={(checked) => {
                          const newFunds = [...fundsConfig.defaultFunds];
                          newFunds[index].autoCalculate = checked;
                          setFundsConfig({ ...fundsConfig, defaultFunds: newFunds });
                        }}
                      />
                      <Label>Auto-calcular</Label>
                    </div>
                    <Badge variant={fund.required ? 'default' : 'outline'}>
                      {fund.required ? 'Obligatorio' : 'Opcional'}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSaveConfiguration('funds')} disabled={saveConfig.isPending} loading={saveConfig.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Fondos
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roles Configuration Tab */}
        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Gestión de Roles y Permisos</CardTitle>
              <CardDescription>
                Configure los roles del sistema y sus permisos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rolesConfig.roles.map((role) => (
                  <div key={role.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{role.name}</h4>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {role.permissions.map((perm) => (
                            <Badge key={perm} variant="outline" className="text-xs">
                              {perm}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {role.editable && (
                        <Button variant="ghost" size="sm">
                          Editar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-6">
                <Button onClick={() => handleSaveConfiguration('roles')} disabled={saveConfig.isPending} loading={saveConfig.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Roles
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pastor Platform Access Tab */}
        <TabsContent value="pastor-access">
          <PastorAccessManagementSection />
        </TabsContent>

        {/* Integration Configuration Tab */}
        <TabsContent value="integration">
          <IntegrationConfigurationSection
            config={integrationConfig}
            setConfig={setIntegrationConfig}
            onSave={() => handleSaveConfiguration('integration')}
            loading={saveConfig.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// User Management Component
const UserManagementSection = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddUser, setShowAddUser] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async (): Promise<void> => {
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = (await response.json()) as ApiResponse<AdminUser[]>;
      setUsers(data.data ?? []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Gestión de Usuarios</CardTitle>
              <CardDescription>
                Administre los usuarios del sistema y sus permisos
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddUser(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Nuevo Usuario
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">Cargando usuarios...</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3">Usuario</th>
                      <th className="text-left p-3">Email</th>
                      <th className="text-left p-3">Rol</th>
                      <th className="text-left p-3">Iglesia</th>
                      <th className="text-left p-3">Estado</th>
                      <th className="text-left p-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b">
                        <td className="p-3">
                          <div className="font-medium">{user.full_name || 'Sin nombre'}</div>
                        </td>
                        <td className="p-3 text-sm">{user.email}</td>
                        <td className="p-3">
                          <Badge variant="outline">{user.role}</Badge>
                        </td>
                        <td className="p-3 text-sm">{user.church_name || '-'}</td>
                        <td className="p-3">
                          <Badge variant={user.is_active ? 'success' : 'secondary'}>
                            {user.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Button variant="ghost" size="sm">Editar</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showAddUser && (
        <Alert className="bg-muted/40">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>La creación de usuarios estará disponible próximamente.</span>
            <Button variant="outline" size="sm" onClick={() => setShowAddUser(false)}>
              Cerrar
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

// Church Management Component
const ChurchManagementSection = () => {
  const [churches, setChurches] = useState<AdminChurch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchChurches();
  }, []);

  const fetchChurches = async (): Promise<void> => {
    try {
      const response = await fetch('/api/churches');
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = (await response.json()) as ApiResponse<AdminChurch[]>;
      setChurches(data.data ?? []);
    } catch (error) {
      console.error('Error fetching churches:', error);
      setChurches([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Gestión de Iglesias</CardTitle>
              <CardDescription>
                Administre las iglesias registradas en el sistema
              </CardDescription>
            </div>
            <Button>
              <Building className="h-4 w-4 mr-2" />
              Nueva Iglesia
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">Cargando iglesias...</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3">Iglesia</th>
                      <th className="text-left p-3">Ciudad</th>
                      <th className="text-left p-3">Pastor principal</th>
                      <th className="text-left p-3">Contacto</th>
                      <th className="text-left p-3">Estado</th>
                      <th className="text-left p-3">Último Informe</th>
                      <th className="text-left p-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {churches.map((church) => {
                      const primary = church.primaryPastor;
                      const role = primary?.roleTitle ?? church.position ?? null;
                      const ordination = primary?.grado ?? church.grade ?? null;
                      const contactEmail = primary?.email ?? church.email ?? undefined;
                      const contactPhone = primary?.phone ?? church.phone ?? undefined;
                      const contactWhatsApp = primary?.whatsapp ?? undefined;

                      return (
                        <tr key={church.id} className="border-b">
                          <td className="p-3">
                            <div className="font-medium">{church.name}</div>
                          </td>
                          <td className="p-3 text-sm">{church.city || 'Sin registrar'}</td>
                          <td className="p-3">
                            <div className="text-sm space-y-1">
                              <div className="font-medium">{primary?.fullName ?? church.pastor}</div>
                              {role && <div className="text-muted-foreground text-xs">{role}</div>}
                              {ordination && (
                                <div className="text-muted-foreground text-xs">{ordination}</div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="text-sm space-y-1">
                              {contactPhone && <div>Tel: {contactPhone}</div>}
                              {contactWhatsApp && (
                                <div className="text-muted-foreground text-xs">WhatsApp: {contactWhatsApp}</div>
                              )}
                              {contactEmail && (
                                <div className="text-muted-foreground text-xs">{contactEmail}</div>
                              )}
                              {!contactPhone && !contactEmail && !contactWhatsApp && (
                                <div className="text-muted-foreground text-xs">Sin datos</div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant={church.active ? 'success' : 'secondary'}>
                              {church.active ? 'Activa' : 'Inactiva'}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm">{church.last_report ?? 'Nunca'}</td>
                          <td className="p-3">
                            <Button variant="ghost" size="sm">Editar</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Security Configuration Component
const SecurityConfigurationSection = ({ config, setConfig, onSave, loading }: SecurityConfigurationSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Seguridad</CardTitle>
        <CardDescription>
          Configure los parámetros de seguridad y autenticación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tiempo de Sesión (minutos)</Label>
            <Input
              type="number"
              value={config.sessionTimeout}
              onChange={(e) => setConfig({ ...config, sessionTimeout: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Intentos Máximos de Login</Label>
            <Input
              type="number"
              value={config.maxLoginAttempts}
              onChange={(e) => setConfig({ ...config, maxLoginAttempts: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Autenticación de Dos Factores (2FA)</Label>
              <p className="text-sm text-muted-foreground">
                Requiere 2FA para todos los administradores
              </p>
            </div>
            <Switch
              checked={config.enforce2FA}
              onCheckedChange={(checked) => setConfig({ ...config, enforce2FA: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Google Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Permite login con Google OAuth
              </p>
            </div>
            <Switch
              checked={config.allowGoogleAuth}
              onCheckedChange={(checked) => setConfig({ ...config, allowGoogleAuth: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Magic Link Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Permite login sin contraseña vía email
              </p>
            </div>
            <Switch
              checked={config.allowMagicLink}
              onCheckedChange={(checked) => setConfig({ ...config, allowMagicLink: checked })}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Guardar Configuración de Seguridad
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Integration Configuration Component
const IntegrationConfigurationSection = ({ config, setConfig, onSave, loading }: IntegrationConfigurationSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Integración</CardTitle>
        <CardDescription>
          Configure las integraciones y APIs externas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>URL del Proyecto Supabase</Label>
            <Input
              placeholder="https://xxxxx.supabase.co"
              value={config.supabaseProjectUrl}
              onChange={(e) => setConfig({ ...config, supabaseProjectUrl: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Clave Anónima de Supabase</Label>
            <Input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={config.supabaseAnonKey}
              onChange={(e) => setConfig({ ...config, supabaseAnonKey: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Habilitar API REST</Label>
              <p className="text-sm text-muted-foreground">
                Permite acceso externo vía API
              </p>
            </div>
            <Switch
              checked={config.apiEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, apiEnabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Webhooks</Label>
              <p className="text-sm text-muted-foreground">
                Envía notificaciones a sistemas externos
              </p>
            </div>
            <Switch
              checked={config.webhooksEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, webhooksEnabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Backup Automático</Label>
              <p className="text-sm text-muted-foreground">
                Realiza respaldos automáticos diarios
              </p>
            </div>
            <Switch
              checked={config.backupEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, backupEnabled: checked })}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Guardar Configuración de Integración
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Pastor Access Management Component
const PastorAccessManagementSection = () => {
  const [selectedPastor, setSelectedPastor] = useState<number | null>(null);
  const [dialogMode, setDialogMode] = useState<'grant' | 'change' | 'revoke' | null>(null);

  const { data: pastorAccessData, isLoading } = usePastorAccess();
  const pastors = pastorAccessData?.data ?? [];
  const summary = pastorAccessData?.summary;

  const handleGrantAccess = (pastorId: number) => {
    setSelectedPastor(pastorId);
    setDialogMode('grant');
  };

  const handleChangeRole = (pastorId: number) => {
    setSelectedPastor(pastorId);
    setDialogMode('change');
  };

  const handleRevokeAccess = (pastorId: number) => {
    setSelectedPastor(pastorId);
    setDialogMode('revoke');
  };

  const closeDialog = () => {
    setSelectedPastor(null);
    setDialogMode(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Acceso de Pastores a la Plataforma</CardTitle>
              <CardDescription>
                Gestione qué pastores tienen acceso al sistema y sus roles asignados
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {summary && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Total Pastores</div>
                <div className="text-2xl font-bold">{summary.total}</div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Con Acceso</div>
                <div className="text-2xl font-bold text-green-600">{summary.with_access}</div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Sin Acceso</div>
                <div className="text-2xl font-bold text-amber-600">{summary.no_access}</div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Revocados</div>
                <div className="text-2xl font-bold text-red-600">{summary.revoked}</div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">Cargando pastores...</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3">Pastor</th>
                      <th className="text-left p-3">Iglesia</th>
                      <th className="text-left p-3">Rol Pastoral</th>
                      <th className="text-left p-3">Rol Plataforma</th>
                      <th className="text-left p-3">Estado Acceso</th>
                      <th className="text-left p-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastors.map((pastor) => (
                      <tr key={pastor.pastorId} className="border-b">
                        <td className="p-3">
                          <div className="font-medium">{pastor.pastorName}</div>
                        </td>
                        <td className="p-3 text-sm">{pastor.churchName}</td>
                        <td className="p-3 text-sm">{pastor.pastoralRole || '-'}</td>
                        <td className="p-3">
                          {pastor.platformRole ? (
                            <Badge variant="outline">{pastor.platformRole}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sin rol</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={
                              pastor.accessStatus === 'active'
                                ? 'success'
                                : pastor.accessStatus === 'revoked'
                                ? 'danger'
                                : 'secondary'
                            }
                          >
                            {pastor.accessStatus === 'active'
                              ? 'Activo'
                              : pastor.accessStatus === 'revoked'
                              ? 'Revocado'
                              : 'Sin Acceso'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            {pastor.accessStatus === 'no_access' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleGrantAccess(pastor.pastorId)}
                              >
                                Otorgar
                              </Button>
                            )}
                            {pastor.accessStatus === 'active' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleChangeRole(pastor.pastorId)}
                                >
                                  Cambiar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRevokeAccess(pastor.pastorId)}
                                >
                                  Revocar
                                </Button>
                              </>
                            )}
                            {pastor.accessStatus === 'revoked' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleGrantAccess(pastor.pastorId)}
                              >
                                Reactivar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs will be added here */}
      {dialogMode === 'grant' && selectedPastor && (
        <GrantAccessDialog
          pastorId={selectedPastor}
          pastor={pastors.find((p) => p.pastorId === selectedPastor)}
          onClose={closeDialog}
        />
      )}
      {dialogMode === 'change' && selectedPastor && (
        <ChangeRoleDialog
          pastorId={selectedPastor}
          pastor={pastors.find((p) => p.pastorId === selectedPastor)}
          onClose={closeDialog}
        />
      )}
      {dialogMode === 'revoke' && selectedPastor && (
        <RevokeAccessDialog
          pastorId={selectedPastor}
          pastor={pastors.find((p) => p.pastorId === selectedPastor)}
          onClose={closeDialog}
        />
      )}
    </div>
  );
};

export default ConfigurationPage;