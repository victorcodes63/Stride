/**
 * Seed Insight articles (example content; example.com).
 * Run: npm run db:seed-insights  (or node prisma/seed-insights.js)
 * Requires: DATABASE_URL set and migrations applied.
 * Skips insert if an insight with the same title already exists (idempotent).
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PLACEHOLDER_IMAGE = '/images/insights/featured-images/placeholder.png';

/** At least 5 articles from live site example.com/blog – Dec 2025 */
const ARTICLES_FROM_LIVE_SITE = [
  {
    title: 'Why Kenyan Employers Need a Refresher on HR Policies',
    excerpt: 'Human Resources is the backbone of every organization. In Kenya, the workplace landscape is rapidly evolving, driven by changes in labor laws, technological adoption, and shifting employee expectations. Keeping HR policies up to date is no longer optional.',
    publishedAt: '2025-12-19',
    author: 'Stride',
    category: 'Compliance and Regulation',
    url: 'https://www.example.com/why-kenyan-employers-need-a-refresher-on-hr-policies/',
    image: PLACEHOLDER_IMAGE,
  },
  {
    title: 'The Power of Pay Transparency: How Open Compensation Shapes Morale, Retention, and Talent Attraction',
    excerpt: 'Pay transparency, the practice of openly sharing salary ranges, bonuses, and compensation policies, is becoming an important strategy in modern workplaces. For many years, salary secrecy was the norm—but that is changing.',
    publishedAt: '2025-12-15',
    author: 'Stride',
    category: 'Strategy Business',
    url: 'https://www.example.com/the-power-of-pay-transparency-how-open-compensation-shapes-morale-retention-and-talent-attraction/',
    image: PLACEHOLDER_IMAGE,
  },
  {
    title: 'Building an Effective HR Strategy: What Companies Need for Sustainable Growth',
    excerpt: 'Managing people is one of the most critical parts of running a business. From hiring the right talent to ensuring compliance with labor laws, HR touches every part of the organization. A strong HR strategy helps companies scale effectively.',
    publishedAt: '2025-12-12',
    author: 'Stride',
    category: 'HR Strategy',
    url: 'https://www.example.com/building-an-effective-hr-strategy-for-sustainable-growth/',
    image: PLACEHOLDER_IMAGE,
  },
  {
    title: 'How to Answer "Tell Me About Yourself" in a Job Interview',
    excerpt: 'One of the most common and often most dreaded questions in job interviews is: "Tell me about yourself." At first glance, it seems simple—you know yourself, right?—but without structure, it’s easy to ramble or miss what the interviewer is really listening for.',
    publishedAt: '2025-12-08',
    author: 'Stride',
    category: 'Job Hunting Tips',
    url: 'https://www.example.com/how-to-answer-tell-me-about-yourself-in-a-job-interview/',
    image: PLACEHOLDER_IMAGE,
  },
  {
    title: 'The Process of Getting Certified as an HR Professional in Kenya',
    excerpt: 'Becoming a certified HR professional in Kenya is a structured process governed by law. To work legally in HR, offer HR services, or hold certain HR roles, you need to understand the certification requirements and steps involved.',
    publishedAt: '2025-12-05',
    author: 'Stride',
    category: 'Compliance and Regulation',
    url: 'https://www.example.com/the-process-of-getting-certified-as-an-hr-professional-in-kenya/',
    image: PLACEHOLDER_IMAGE,
  },
  {
    title: 'Annual Leave Forfeiture in Kenya: Legal Perspectives, Employee Rights, and HR Practices',
    excerpt: 'Annual leave is one of the most misunderstood employment rights in Kenya. Every company talks about it, every HR department manages it in its own way—but the law sets clear rules on when leave can be forfeited and what employees are entitled to.',
    publishedAt: '2025-12-02',
    author: 'Stride',
    category: 'Compliance and Regulation',
    url: 'https://www.example.com/annual-leave-forfeiture-in-kenya-legal-perspectives-employee-rights-and-hr-practices/',
    image: PLACEHOLDER_IMAGE,
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Cannot seed insights.');
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;

  for (const a of ARTICLES_FROM_LIVE_SITE) {
    const existing = await prisma.insight.findFirst({
      where: { title: a.title },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.insight.create({
      data: {
        title: a.title,
        excerpt: a.excerpt,
        author: a.author,
        category: a.category,
        url: a.url,
        image: a.image,
        publishedAt: new Date(a.publishedAt + 'T12:00:00.000Z'),
      },
    });
    created++;
  }

  console.log(`Insights seed done: ${created} created, ${skipped} already existed (from live site example.com).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
