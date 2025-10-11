import { Crons } from "@convex-dev/crons";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { components } from "./_generated/api";

const cronClient = new Crons(components.crons);
const TIMEZONE = "America/Asuncion";

const cronDefinitions = [
  {
    name: "monthly-report-reminder",
    schedule: { kind: "cron" as const, cronspec: "0 0 10 5 * *", tz: TIMEZONE },
    handler: internal.cronHandlers.sendMonthlyReportReminder,
    args: {},
  },
  {
    name: "weekly-pending-reports-alert",
    schedule: { kind: "cron" as const, cronspec: "0 0 9 * * 1", tz: TIMEZONE },
    handler: internal.cronHandlers.sendWeeklyPendingReportsAlert,
    args: {},
  },
  {
    name: "monthly-period-close",
    schedule: { kind: "cron" as const, cronspec: "0 0 23 L * *", tz: TIMEZONE },
    handler: internal.cronHandlers.triggerMonthlyPeriodClose,
    args: {},
  },
  {
    name: "daily-backup",
    schedule: { kind: "cron" as const, cronspec: "0 0 2 * * *", tz: TIMEZONE },
    handler: internal.cronHandlers.triggerDailyBackup,
    args: {},
  },
];

export const ensureCronJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const cron of cronDefinitions) {
      const existing = await cronClient.get(ctx, { name: cron.name });
      if (!existing) {
        await cronClient.register(ctx, cron.schedule, cron.handler, cron.args, cron.name);
      }
    }
  },
});
