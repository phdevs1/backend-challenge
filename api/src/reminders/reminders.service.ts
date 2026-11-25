import type { MessageProvider } from '../clients/message-provider.js';
import type { Clock } from '../shared/clock.js';
import { resultOfAttempt, skipReasonAtSendTime } from './delivery.js';
import type { DueReminder } from './reminder.js';
import { reminderText } from './reminder-text.js';
import type { RemindersRepository } from './reminders.repository.js';

const BATCH_SIZE = 20;

export class RemindersService {
  constructor(
    private readonly reminders: RemindersRepository,
    private readonly provider: MessageProvider,
    private readonly clock: Clock,
  ) {}

  /** One pass: handles every reminder due at the service clock's current time. */
  async runDue(): Promise<{ processed: number }> {
    const now = this.clock.now();
    let processed = 0;
    for (;;) {
      const batch = await this.reminders.claimDue(now, BATCH_SIZE);
      if (batch.length === 0) return { processed };
      const results = await Promise.all(batch.map((reminder) => this.handle(reminder, now)));
      processed += results.filter(Boolean).length;
    }
  }

  /** False when something unexpected failed: the lock expires and a later pass tries again. */
  private async handle(reminder: DueReminder, now: Date): Promise<boolean> {
    try {
      const skipReason = skipReasonAtSendTime({ ...reminder, now });
      if (skipReason || !reminder.phone) {
        await this.reminders.finishSkipped(reminder.id, skipReason ?? 'no_phone');
        return true;
      }

      const outcome = await this.provider.send({
        to: reminder.phone,
        text: reminderText(reminder),
        idempotencyKey: reminder.id,
      });
      const result = resultOfAttempt(outcome, reminder.attempts + 1, this.clock.now());
      await this.reminders.finishAttempt(reminder.id, result);
      return true;
    } catch (error) {
      console.error(`reminder ${reminder.id} could not be processed`, error);
      return false;
    }
  }
}
