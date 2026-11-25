import { expect, test } from '@playwright/test';
import {
  addItem,
  addSale,
  cellInColumn,
  openFromSidebar,
  registerNewBusiness,
  sidebarLink,
} from './helpers';

/**
 * The app's core loop: stock an item, sell some, and see the sale everywhere it should show up.
 * Each step checks what the owner sees, so it catches a break anywhere from the form to the
 * database and back.
 */
test('selling an item lowers its stock and shows up on Home and in Analytics', async ({ page }) => {
  await registerNewBusiness(page);

  // Add 10 bookmarks at 5.00 each, then sell 3 of them.
  await addItem(page, { name: 'Pressed-flower bookmark', qty: 10, unitPrice: '5.00' });
  await addSale(page, { item: 'Pressed-flower bookmark', qty: 3 });
  await expect(page.getByRole('row').filter({ hasText: 'Pressed-flower bookmark' })).toContainText(
    '15.00',
  );

  // Stock went from 10 to 7.
  await openFromSidebar(page, 'Inventory');
  const itemRow = page.getByRole('row').filter({ hasText: 'Pressed-flower bookmark' });
  await expect(await cellInColumn(page, itemRow, 'Qty')).toHaveText('7');

  // This month's revenue on Home and in Analytics is the 15.00 sale.
  await sidebarLink(page, 'Home').click();
  await expect(page.locator('.stat-card').filter({ hasText: /^Revenue/ })).toContainText('15.00');

  await openFromSidebar(page, 'Analytics');
  await expect(page.locator('.stat-card').filter({ hasText: 'Total Revenue' })).toContainText(
    '15.00',
  );
});
