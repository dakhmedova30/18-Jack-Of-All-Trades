import { expect, test } from '@playwright/test';
import { PASSWORD, registerNewBusiness } from './helpers';

test('pages that need a login send you to the login page', async ({ page }) => {
  await page.goto('/inventory');

  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('a new business can register, log out and log back in', async ({ page }) => {
  const { name, email } = await registerNewBusiness(page);

  await page.getByRole('button', { name: `Account menu for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL('/login');

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: `Account menu for ${name}` })).toBeVisible();
});
