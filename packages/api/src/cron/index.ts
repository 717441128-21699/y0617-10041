import { BillingService } from '../services/billing.service';

export class CronScheduler {
  private static jobs: NodeJS.Timeout[] = [];

  static start(): void {
    console.log('[Cron] Starting scheduler...');

    const invoiceJob = CronScheduler.schedule('0 0 1 * *', async () => {
      console.log('[Cron] Running monthly invoice generation...');
      try {
        const invoices = await BillingService.generateMonthlyInvoices();
        console.log(`[Cron] Generated ${invoices.length} invoices`);
      } catch (error) {
        console.error('[Cron] Failed to generate invoices:', error);
      }
    });
    CronScheduler.jobs.push(invoiceJob);

    console.log('[Cron] Scheduler started');
  }

  static stop(): void {
    console.log('[Cron] Stopping scheduler...');
    CronScheduler.jobs.forEach(job => clearTimeout(job));
    CronScheduler.jobs = [];
    console.log('[Cron] Scheduler stopped');
  }

  private static schedule(cronExpression: string, task: () => Promise<void>): NodeJS.Timeout {
    const runTask = async () => {
      try {
        await task();
      } catch (error) {
        console.error('[Cron] Task failed:', error);
      }
    };

    const parts = cronExpression.split(' ');
    if (parts.length !== 5) {
      throw new Error('Invalid cron expression. Expected 5 parts.');
    }

    const interval = CronScheduler.cronToInterval(cronExpression);
    
    const timeout = setInterval(runTask, interval);
    
    const now = new Date();
    const nextRun = CronScheduler.getNextRun(cronExpression);
    const delay = nextRun.getTime() - now.getTime();
    
    setTimeout(() => {
      runTask();
    }, delay);

    return timeout;
  }

  private static cronToInterval(cronExpression: string): number {
    const parts = cronExpression.split(' ');
    
    if (parts[1] === '*' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
      return 60 * 1000;
    }
    if (parts[0] === '0' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
      return 60 * 60 * 1000;
    }
    if (parts[0] === '0' && parts[1] === '0' && parts[3] === '*' && parts[4] === '*') {
      return 24 * 60 * 60 * 1000;
    }
    if (parts[0] === '0' && parts[1] === '0' && parts[2] === '1' && parts[4] === '*') {
      return 30 * 24 * 60 * 60 * 1000;
    }
    
    return 24 * 60 * 60 * 1000;
  }

  private static getNextRun(cronExpression: string): Date {
    const parts = cronExpression.split(' ');
    const now = new Date();
    const next = new Date(now);

    if (parts[0] === '0' && parts[1] === '0' && parts[2] === '1') {
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      next.setHours(0, 0, 0, 0);
    } else if (parts[0] === '0' && parts[1] === '0') {
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
    } else if (parts[0] === '0') {
      next.setHours(next.getHours() + 1, 0, 0, 0);
    } else {
      next.setMinutes(next.getMinutes() + 1, 0, 0);
    }

    return next;
  }
}
