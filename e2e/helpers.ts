import { expect, type Page } from '@playwright/test';

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} — set it to run this E2E suite.`);
  }
  return value;
}

export async function staffLogin(page: Page, email: string, password: string) {
  await page.goto('/dashboard/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/dashboard(?!\/login)/, { timeout: 30_000 });
}

export async function essLogin(page: Page, email: string, password: string) {
  await page.goto('/ess/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/ess(?!\/login)/, { timeout: 30_000 });
}

export async function cpLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}
