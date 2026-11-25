import { expect, test } from '@playwright/test';
import { addButton, openFromSidebar, registerNewBusiness, sidebarLink, today } from './helpers';

test('an expense shows up in Expenses and in Home and Analytics totals', async ({ page }) => {
  await registerNewBusiness(page);

  // 2 rolls of craft paper at 4.50 each.
  await openFromSidebar(page, 'Expenses');
  await addButton(page).click();
  const expenseForm = page.getByRole('dialog', { name: 'Add expense' });
  // The form has a description for the whole expense and one per line; fill the line's.
  const line = expenseForm.getByRole('group', { name: 'Expense item 1' });
  await line.getByLabel('Description').fill('Craft paper roll');
  await line.getByLabel('Qty').fill('2');
  await line.getByLabel(/Price per product/).fill('4.50');
  await expenseForm.getByLabel('Date').fill(today());
  await expenseForm.getByLabel('Tag').selectOption('supplies'); // a starter tag
  await expenseForm.getByRole('button', { name: 'Save' }).click();
  await expect(expenseForm).toBeHidden();
  await expect(page.getByRole('row').filter({ hasText: 'Craft paper roll' })).toContainText('9.00');

  await sidebarLink(page, 'Home').click();
  await expect(page.locator('.stat-card').filter({ hasText: /^Expenses/ })).toContainText('9.00');

  await openFromSidebar(page, 'Analytics');
  await expect(page.locator('.stat-card').filter({ hasText: 'Total Expenses' })).toContainText(
    '9.00',
  );
});
