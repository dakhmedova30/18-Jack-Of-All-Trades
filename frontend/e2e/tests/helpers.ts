import { expect, type Locator, type Page } from '@playwright/test';

export const PASSWORD = 'e2e-password-123';

/**
 * Registers a brand-new business and waits for Home. Every test starts with its own account, so
 * tests never share data and can run in any order, in parallel, against any database.
 */
export async function registerNewBusiness(page: Page): Promise<{ name: string; email: string }> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const name = `E2E Shop ${id}`;
  const email = `e2e-${id}@example.test`;

  await page.goto('/register');
  await page.getByLabel('Business name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL('/');

  return { name, email };
}

/**
 * Today as YYYY-MM-DD in the browser's time zone, as a user would pick it. CI runs in UTC, the
 * zone the app's "this month" figures use, so a record dated today always counts this month.
 */
export function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * A link in the main sidebar. Matched exactly, because the Analytics drop-down adds links such as
 * "Sales Analytics" that a partial match for "Sales" or "Analytics" would also find.
 */
export function sidebarLink(page: Page, label: string): Locator {
  return page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: label, exact: true });
}

/** Opens a page from the sidebar, the way a user would. */
export async function openFromSidebar(page: Page, label: string): Promise<void> {
  await sidebarLink(page, label).click();
  await expect(page.getByRole('heading', { level: 1, name: label, exact: true })).toBeVisible();
}

/**
 * The page's "Add" button. An empty table shows a second one in its empty-state message; the
 * toolbar's comes first.
 */
export function addButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Add', exact: true }).first();
}

/**
 * A row's cell under the given column header, e.g. an item's "Qty". Matching the cell by its text
 * alone would be ambiguous: an item's ID can equal its quantity.
 */
export async function cellInColumn(page: Page, row: Locator, column: string): Promise<Locator> {
  const headers = page.getByRole('columnheader');
  await expect(headers.first()).toBeVisible();
  // Sortable headers also show an arrow (▲ ▼ ↕) after the name.
  const names = (await headers.allInnerTexts()).map((name) => name.replace(/[▲▼↕]/g, '').trim());
  const index = names.indexOf(column);
  if (index < 0) throw new Error(`No "${column}" column; found: ${names.join(', ')}`);
  return row.getByRole('cell').nth(index);
}
