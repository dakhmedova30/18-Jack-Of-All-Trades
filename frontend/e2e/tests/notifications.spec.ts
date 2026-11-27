import { expect, test } from '@playwright/test';
import { addItem, addSale, registerNewBusiness } from './helpers';

/**
 * The bell refetches right after a save, so a sale that leaves an item low on stock shows up
 * without a reload. Playwright's default 5-second wait is far shorter than the 30-second poll, so
 * this only passes if the save itself triggered the refresh.
 */
test('a sale that leaves an item low on stock shows in the bell straight away', async ({
  page,
}) => {
  await registerNewBusiness(page);
  // 10 in stock is above the default low-stock threshold of 5; selling 6 leaves 4.
  await addItem(page, { name: 'Linocut card', qty: 10, unitPrice: '4.00' });
  await addSale(page, { item: 'Linocut card', qty: 6 });

  const bell = page.getByRole('button', { name: /^Notifications/ }).filter({ visible: true });
  await bell.click();
  await expect(
    page.getByRole('dialog', { name: 'Notifications' }).getByText(/Linocut card/),
  ).toBeVisible();
});
