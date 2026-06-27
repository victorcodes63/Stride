/**
 * Send a Resend smoke-test email (RAV-243 AC).
 * Usage: set -a && . ./.env.resend.test && set +a && npx tsx scripts/test-resend-email.ts [to@example.com]
 */
import { sendResendTestEmail } from '../src/lib/email';

const to = process.argv[2]?.trim() || process.env.RESEND_TEST_TO?.trim() || 'hello@raventechgroup.com';

async function main() {
  if (!process.env.RESEND_API_KEY?.trim()) {
    console.error('RESEND_API_KEY is not set. Pull from Vercel or set in .env.local.');
    process.exit(1);
  }

  console.log(`Sending Resend test to ${to} from no-reply@getstride.co.ke…`);
  const result = await sendResendTestEmail(to);
  console.log(JSON.stringify(result, null, 2));
  if (!result.sent) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
