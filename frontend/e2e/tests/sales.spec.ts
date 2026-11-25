import { expect, test } from '@playwright/test';
import {
  addButton,
  cellInColumn,
  openFromSidebar,
  registerNewBusiness,
  sidebarLink,
  today,
} from './helpers';

/**
 * The app's core loop: stock an item, sell some, and see the sale everywhere it should show up.
 * Each step checks what the owner sees, so it catches a break anywhere from the form to the
 * database and back.
 */
test('selling an item lowers its stock and shows up on Home and in Analytics', async ({ page }) => {
  await registerNewBusiness(page);

  // Add 10 bookmarks at 5.00 each.
  await openFromSidebar(page, 'Inventory');
  await addButton(page).click();
  const itemForm = page.getByRole('dialog', { name: 'Add new item' });
  await itemForm.getByLabel('Name').fill('Pressed-flower bookmark');
  await itemForm.getByLabel('Qty').fill('10');
  await itemForm.getByLabel(/^Price/).fill('5.00');
  await itemForm.getByRole('button', { name: 'Save' }).click();
  await expect(itemForm).toBeHidden();
  const itemRow = page.getByRole('row').filter({ hasText: 'Pressed-flower bookmark' });
  await expect(await cellInColumn(page, itemRow, 'Qty')).toHaveText('10');

  // Sell 3 of them.
  await openFromSidebar(page, 'Sales');
  await addButton(page).click();
  const saleForm = page.getByRole('dialog', { name: 'Add sale' });
  // The option's text also has the price and stock ("… — CA$5.00 (10 in stock)"), so pick it by name.
  const itemSelect = saleForm.getByLabel('Item');
  const itemOption = itemSelect.locator('option', { hasText: 'Pressed-flower bookmark' });
  await itemSelect.selectOption((await itemOption.getAttribute('value'))!);
  await saleForm.getByLabel('Qty').fill('3');
  await saleForm.getByLabel('Date').fill(today());
  await saleForm.getByLabel('Channel').selectOption('In person'); // a starter channel
  await saleForm.getByRole('button', { name: 'Save' }).click();
  await expect(saleForm).toBeHidden();
  await expect(page.getByRole('row').filter({ hasText: 'Pressed-flower bookmark' })).toContainText(
    '15.00',
  );

  // Stock went from 10 to 7.
  await openFromSidebar(page, 'Inventory');
  await expect(await cellInColumn(page, itemRow, 'Qty')).toHaveText('7');

  // This month's revenue on Home and in Analytics is the 15.00 sale.
  await sidebarLink(page, 'Home').click();
  await expect(page.locator('.stat-card').filter({ hasText: /^Revenue/ })).toContainText('15.00');

  await openFromSidebar(page, 'Analytics');
  await expect(page.locator('.stat-card').filter({ hasText: 'Total Revenue' })).toContainText(
    '15.00',
  );
});
