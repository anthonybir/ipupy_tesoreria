# Configuration System Documentation

## Overview

The IPU PY Treasury system features a comprehensive configuration management system that allows administrators to customize system behavior, security settings, financial parameters, and integrations through a web interface.

## Architecture

The configuration system consists of:

- **Frontend Configuration Page**: `src/app/admin/configuration/page.tsx`
- **Configuration API**: `src/app/api/admin/configuration/route.ts`
- **Database Storage**: `system_configuration` table
- **Type Definitions**: Comprehensive TypeScript types for type safety

## Configuration Sections

### 1. General Configuration (`SystemConfig`)

Basic system-wide settings that define the organization's operational parameters.

```typescript
type SystemConfig = {
  systemName: string;              // Display name of the system
  organizationName: string;        // Full organization name
  systemLanguage: string;          // Primary language (es, gn, en)
  timezone: string;                // System timezone (America/Asuncion)
  currency: string;                // Currency code (PYG, USD, EUR)
  currencySymbol: string;          // Currency symbol (₲, $, €)
  fiscalYearStart: number;         // Fiscal year start month (1-12)
  dateFormat: string;              // Date display format
  numberFormat: string;            // Number format locale
  maintenanceMode: boolean;        // System maintenance mode
  allowRegistrations: boolean;     // Allow new church registrations
  requireEmailVerification: boolean; // Require email verification
  sessionTimeout: number;          // Session timeout in minutes
  maxLoginAttempts: number;        // Maximum failed login attempts
  passwordMinLength: number;       // Minimum password length
  enforce2FA: boolean;             // Require two-factor authentication
  allowGoogleAuth: boolean;        // Enable Google OAuth
  allowMagicLink: boolean;         // Enable magic link authentication
};
```

**Default Values:**
```typescript
{
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
  // ... security defaults
}
```

### 2. Financial Configuration (`FinancialConfig`)

Financial and accounting rules that govern treasury operations.

```typescript
type FinancialConfig = {
  fondoNacionalPercentage: number;    // National fund percentage (default: 10%)
  honorariosPastoralesDefault: number; // Default pastoral fees
  requiredApprovals: number;          // Number of approvals required
  autoGenerateReports: boolean;       // Auto-generate monthly reports
  reportDeadlineDay: number;          // Report deadline day of month
  reminderDaysBefore: number;         // Reminder days before deadline
  allowNegativeBalances: boolean;     // Allow negative fund balances
  requireReceipts: boolean;           // Require receipts for transactions
  receiptMinAmount: number;           // Minimum amount requiring receipt
  autoCalculateTotals: boolean;       // Auto-calculate report totals
  roundingMethod: string;             // Rounding method for calculations
  enableBudgets: boolean;             // Enable budget tracking
  budgetWarningThreshold: number;     // Budget warning threshold (%)
  allowManualEntries: boolean;        // Allow manual report entries
  requireDoubleEntry: boolean;        // Require double-entry accounting
};
```

### 3. Notification Configuration (`NotificationConfig`)

Controls system notifications and alerts.

```typescript
type NotificationConfig = {
  emailEnabled: boolean;              // Enable email notifications
  smsEnabled: boolean;                // Enable SMS notifications
  whatsappEnabled: boolean;           // Enable WhatsApp notifications
  reportSubmissionNotify: boolean;    // Notify on report submissions
  reportApprovalNotify: boolean;      // Notify on report approvals
  lowBalanceNotify: boolean;          // Notify on low balances
  lowBalanceThreshold: number;        // Low balance threshold amount
  monthlyReminderEnabled: boolean;    // Enable monthly reminders
  weeklyDigestEnabled: boolean;       // Enable weekly digest emails
  notifyAdminsOnErrors: boolean;      // Notify admins on system errors
  notifyOnNewRegistration: boolean;   // Notify on new registrations
  notifyOnLargeTransaction: boolean;  // Notify on large transactions
  largeTransactionThreshold: number;  // Large transaction threshold
};
```

### 4. Funds Configuration (`FundsConfig`)

Manages default funds and fund-related settings.

```typescript
type DefaultFund = {
  name: string;           // Fund name
  percentage: number;     // Default percentage allocation
  required: boolean;      // Whether fund is required
  autoCalculate: boolean; // Auto-calculate fund allocation
};

type FundsConfig = {
  defaultFunds: DefaultFund[];        // Default fund definitions
  allowCustomFunds: boolean;          // Allow churches to create custom funds
  maxCustomFunds: number;             // Maximum custom funds per church
  trackFundHistory: boolean;          // Track fund balance history
  allowInterFundTransfers: boolean;   // Allow transfers between funds
  requireTransferApproval: boolean;   // Require approval for transfers
};
```

**Default Funds:**
```typescript
[
  { name: 'Fondo Nacional', percentage: 10, required: true, autoCalculate: true },
  { name: 'Misiones', percentage: 0, required: false, autoCalculate: false },
  { name: 'Instituto Bíblico', percentage: 0, required: false, autoCalculate: false },
  { name: 'Construcción', percentage: 0, required: false, autoCalculate: false }
]
```

### 5. Roles Configuration (`RolesConfig`)

Defines system roles and their permissions.

```typescript
type RoleDefinition = {
  id: string;             // Role identifier
  name: string;           // Display name
  description: string;    // Role description
  permissions: string[];  // Array of permission strings
  editable: boolean;      // Whether role can be modified
};

type RolesConfig = {
  roles: RoleDefinition[];
};
```

**Default Roles (simplified from 8 to 6):**
1. `admin` - Full system access
2. `district_supervisor` - Multi-church management
3. `treasurer` - Financial management
4. `pastor` - Church management
5. `secretary` - Administrative support
6. `member` - Basic read-only access

### 6. Integration Configuration (`IntegrationConfig`)

External system integrations and API settings.

```typescript
type IntegrationConfig = {
  apiEnabled: boolean;              // Enable REST API
  apiRateLimit: number;             // API rate limit per hour
  apiRateLimitWindow: number;       // Rate limit window in seconds
  webhooksEnabled: boolean;         // Enable webhooks
  webhookUrl: string;               // Webhook endpoint URL
  exportEnabled: boolean;           // Enable data export
  exportFormats: string[];          // Supported export formats
  backupEnabled: boolean;           // Enable automatic backups
  backupFrequency: string;          // Backup frequency (daily, weekly)
  backupRetention: number;          // Backup retention in days
  googleSheetsIntegration: boolean; // Enable Google Sheets integration
  googleSheetsId: string;           // Google Sheets document ID
  supabaseProjectUrl: string;       // Supabase project URL
  supabaseAnonKey: string;          // Supabase anonymous key
};
```

## API Endpoints

### GET `/api/admin/configuration`

Retrieve system configuration by section.

**Parameters:**
- `section` (optional): Configuration section to retrieve (`general`, `financial`, `security`, etc.)

**Response:**
```typescript
{
  success: true,
  data: {
    [section]: {
      [key]: value
    }
  }
}
```

**Example:**
```bash
# Get all configuration
GET /api/admin/configuration

# Get specific section
GET /api/admin/configuration?section=financial
```

### POST `/api/admin/configuration`

Update configuration section.

**Request Body:**
```typescript
{
  section: string;  // Configuration section
  data: {           // Configuration data
    [key]: value
  }
}
```

**Example:**
```typescript
// Update financial configuration
{
  "section": "financial",
  "data": {
    "fondoNacionalPercentage": 12,
    "requireReceipts": true,
    "receiptMinAmount": 150000
  }
}
```

### PUT `/api/admin/configuration`

Reset configuration to defaults.

**Response:**
```typescript
{
  success: true,
  message: "Configuration reset to defaults"
}
```

## Database Schema

Configuration is stored in the `system_configuration` table:

```sql
CREATE TABLE system_configuration (
  id SERIAL PRIMARY KEY,
  section TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section, key)
);
```

## Usage Examples

### Loading Configuration

```typescript
// Frontend usage
const loadConfiguration = async () => {
  const response = await fetch('/api/admin/configuration?section=financial');
  const data = await response.json();

  if (data.success) {
    setFinancialConfig(prev => ({ ...prev, ...data.data.financial }));
  }
};
```

### Saving Configuration

```typescript
// Frontend usage
const saveConfiguration = async (section: string, configData: any) => {
  const response = await fetch('/api/admin/configuration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section, data: configData })
  });

  if (!response.ok) {
    throw new Error('Failed to save configuration');
  }

  return await response.json();
};
```

### Using Configuration in Components

```typescript
// Example: Using financial configuration
const ReportForm = () => {
  const [config, setConfig] = useState<FinancialConfig>();

  useEffect(() => {
    loadFinancialConfig().then(setConfig);
  }, []);

  // Calculate national fund automatically
  const calculateNationalFund = (total: number) => {
    if (config?.autoCalculateTotals) {
      return total * (config.fondoNacionalPercentage / 100);
    }
    return 0;
  };

  // ... component logic
};
```

## Configuration Validation

The system includes comprehensive validation:

### Frontend Validation

```typescript
// Type-safe configuration updates
const updateSystemConfig = (updates: Partial<SystemConfig>) => {
  setSystemConfig(prev => ({ ...prev, ...updates }));
};

// Validate numeric ranges
const validatePercentage = (value: number): boolean => {
  return value >= 0 && value <= 100;
};
```

### Backend Validation

```typescript
// API route validation
if (!section || !data) {
  return NextResponse.json(
    { error: 'Section and data are required' },
    { status: 400 }
  );
}

// Role-based access control
if (!auth || auth.role !== 'admin') {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  );
}
```

## Security Considerations

1. **Admin-Only Access**: Only users with `admin` role can modify configuration
2. **Audit Trail**: All configuration changes are logged to `user_activity`
3. **Type Safety**: Strong TypeScript typing prevents invalid configurations
4. **Validation**: Client and server-side validation ensures data integrity
5. **CORS Protection**: Proper CORS headers prevent unauthorized access

## Migration and Deployment

### Adding New Configuration Options

1. **Update Types**: Add new fields to appropriate configuration types
2. **Update Frontend**: Add form controls for new options
3. **Update Defaults**: Include default values in the configuration
4. **Database Migration**: No schema changes needed (JSONB storage)
5. **Documentation**: Update this documentation

### Configuration Backup

```sql
-- Create configuration backup
CREATE TABLE config_backup_$(date) AS
SELECT * FROM system_configuration;

-- Restore from backup
DELETE FROM system_configuration;
INSERT INTO system_configuration
SELECT section, key, value, updated_by, NOW(), NOW()
FROM config_backup_$(date);
```

## Troubleshooting

### Common Issues

**Configuration Not Loading:**
```typescript
// Check API response
console.log('Config response:', await response.json());

// Verify authentication
const auth = await getAuthContext(req);
console.log('Auth context:', auth);
```

**Configuration Not Saving:**
```sql
-- Check database constraints
SELECT * FROM system_configuration
WHERE section = 'financial' AND key = 'fondoNacionalPercentage';

-- Check for conflicts
SELECT section, key, COUNT(*)
FROM system_configuration
GROUP BY section, key
HAVING COUNT(*) > 1;
```

**Role-based Access Issues:**
```typescript
// Verify user role
const userProfile = await executeWithContext(auth,
  'SELECT role FROM profiles WHERE id = $1',
  [auth.userId]
);
console.log('User role:', userProfile.rows[0]?.role);
```

## Best Practices

1. **Load on Demand**: Only load configuration sections when needed
2. **Cache Configuration**: Cache frequently used settings in memory
3. **Validate Changes**: Always validate configuration before saving
4. **Test Defaults**: Ensure default values work in all environments
5. **Document Changes**: Maintain changelog for configuration modifications
6. **Backup Before Changes**: Always backup configuration before major updates

## Future Enhancements

Planned configuration system improvements:

1. **Configuration History**: Track configuration change history
2. **Conditional Configuration**: Rules-based configuration dependencies
3. **Environment-specific Configs**: Different settings per deployment environment
4. **Configuration Import/Export**: Bulk configuration management
5. **Real-time Updates**: Push configuration changes without restart
6. **Configuration Templates**: Predefined configuration profiles