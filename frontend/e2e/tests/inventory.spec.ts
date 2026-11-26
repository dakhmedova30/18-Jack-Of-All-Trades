import { expect, test, type Page } from '@playwright/test';
import { addButton, openFromSidebar, registerNewBusiness } from './helpers';

async function addTaggedItem(page: Page, name: string, tags: string): Promise<void> {
  await addButton(page).click();
  const form = page.getByRole('dialog', { name: 'Add new item' });
  await form.getByLabel('Name').fill(name);
  await form.getByLabel('Qty').fill('5');
  await form.getByLabel(/price \(/i).fill('3.00');
  for (const tag of tags.split(',').map((t) => t.trim())) {
    await form.getByRole('button', { name: 'New tag' }).click();
    await form.getByLabel('Tags', { exact: true }).fill(tag);
    await form.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(form.getByRole('button', { name: `Remove tag ${tag}` })).toBeVisible();
  }
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form).toBeHidden();
}

test('the tag filter shows the items with any of the ticked tags', async ({ page }) => {
  await registerNewBusiness(page);
  await openFromSidebar(page, 'Inventory');
  await addTaggedItem(page, 'Moth sticker', 'stickers');
  await addTaggedItem(page, 'Fern print', 'prints, botanical');
  await addTaggedItem(page, 'Canvas tote', 'bags');

  const rows = page.getByRole('row');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const filter = page.getByRole('button', { name: /^Tags/ });
  await filter.click();
  await page.getByRole('checkbox', { name: 'stickers (1 item)' }).check();
  await expect(rows.filter({ hasText: 'Moth sticker' })).toBeVisible();
  await expect(rows.filter({ hasText: 'Fern print' })).toBeHidden();
  await expect(rows.filter({ hasText: 'Canvas tote' })).toBeHidden();

  await page.getByRole('checkbox', { name: 'prints (1 item)' }).check();
  await expect(rows.filter({ hasText: 'Fern print' })).toBeVisible();
  await expect(rows.filter({ hasText: 'Moth sticker' })).toBeVisible();
  await expect(rows.filter({ hasText: 'Canvas tote' })).toBeHidden();
  await expect(filter).toHaveText('2 tags');

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(rows.filter({ hasText: 'Canvas tote' })).toBeVisible();
  await expect(filter).toHaveText('All tags');
});
