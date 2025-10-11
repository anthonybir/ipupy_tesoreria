import { internalAction } from "./_generated/server";

function logTrigger(job: string, payload?: Record<string, unknown>) {
  const metadata = payload ? JSON.stringify(payload) : "{}";
  console.log(`[Cron] ${job} triggered`, metadata);
}

export const sendMonthlyReportReminder = internalAction({
  args: {},
  handler: async () => {
    logTrigger("monthly-report-reminder");
    // TODO: enqueue email notifications to pastors/treasurers once notifications module is ready.
  },
});

export const sendWeeklyPendingReportsAlert = internalAction({
  args: {},
  handler: async () => {
    logTrigger("weekly-pending-reports-alert");
    // TODO: fetch pending reports and notify national treasury team.
  },
});

export const triggerMonthlyPeriodClose = internalAction({
  args: {},
  handler: async () => {
    logTrigger("monthly-period-close");
    // TODO: call admin mutation to close monthly reporting period.
  },
});

export const triggerDailyBackup = internalAction({
  args: {},
  handler: async () => {
    logTrigger("daily-backup");
    // TODO: invoke backup pipeline or export script.
  },
});
