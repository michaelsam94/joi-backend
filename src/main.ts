import { env } from './config/env';
import { buildContainer } from './config/container';
import { buildApp } from './app';
import { scheduleWeeklyReport } from './infrastructure/scheduler/WeeklyReportScheduler';

const container = buildContainer();
const app = buildApp(container);

app.listen(env.port, () => {
  console.log(`⛵ Joi backend listening on port ${env.port}`);
});

scheduleWeeklyReport(container.useCases.sendWeeklyReport, env.weeklyReportCron);
