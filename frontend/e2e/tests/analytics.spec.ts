import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  addButton,
  addItem,
  addSale,
  openFromSidebar,
  registerNewBusiness,
  today,
} from './helpers';

// Wide enough for the filters to sit beside the cards; narrower, they stack above them.
test.use({ viewport: { width: 1440, height: 900 } });

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error('Not rendered');
  return found;
}

/** The deeper page's filters and this month's cards beside them. */
function topRow(page: Page) {
  return {
    filters: page.getByRole('complementary', { name: 'Filters' }),
    cards: page.locator('.analytics-subpage__top .panel-row'),
  };
}

test("Sales and Expense Analytics put the filters beside this month's cards, two by two", async ({
  page,
}) => {
  await registerNewBusiness(page);

  for (const path of ['/analytics/sales', '/analytics/expenses']) {
    await page.goto(path);
    const { filters, cards } = topRow(page);
    await expect(filters).toBeVisible();
    const panels = cards.locator('.summary-panel');
    await expect(panels).toHaveCount(4);
    await expect(cards).not.toContainText('Loading');

    // Beside, not above, with the same top, and (whichever is shorter stretching) the same bottom.
    await expect
      .poll(async () => {
        const [f, c] = [await box(filters), await box(cards)];
        return f.x + f.width < c.x && Math.abs(f.y - c.y) < 2 && Math.abs(f.height - c.height) < 2;
      }, `filters beside the cards on ${path}`)
      .toBe(true);

    // Two by two: the first two side by side, the other two under them.
    const [a, b, c, d] = await Promise.all((await panels.all()).map(box));
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
    expect(Math.abs(c!.y - d!.y)).toBeLessThan(2);
    expect(c!.y).toBeGreaterThan(a!.y + a!.height - 2);
  }
});

test('the channel menu narrows Sales Analytics to the ticked channels', async ({ page }) => {
  await registerNewBusiness(page);
  await addItem(page, { name: 'Pressed flower card', qty: 10, unitPrice: '5.00' });
  await addSale(page, { item: 'Pressed flower card', qty: 2 }); // In person, today

  await page.goto('/analytics/sales');
  const { filters } = topRow(page);
  const revenue = page.locator('.chart-card', {
    has: page.getByRole('heading', { name: /^Revenue by (day|week|month)$/ }),
  });
  await expect(revenue.getByText('One line per channel')).toBeVisible();
  await expect(revenue.locator('.viz-legend li')).toHaveText(['In person']);

  await filters.getByRole('button', { name: 'Channels All channels' }).click();

  // Only Online: no sales there.
  await filters.getByRole('checkbox', { name: 'Online', exact: true }).check();
  await expect(page.getByText(/^No Online sales /)).toBeVisible();

  // Online and In person: both channels go to the server, and the sale is back.
  const bothChannels = page.waitForRequest(
    (request) =>
      request.url().includes('/api/analytics/sales-trends') &&
      new URL(request.url()).searchParams.getAll('channelId').length === 2,
  );
  await filters.getByRole('checkbox', { name: 'In person', exact: true }).check();
  await bothChannels;
  await expect(revenue.getByText('One line per chosen channel')).toBeVisible();
  await expect(revenue.locator('.viz-legend li')).toHaveText(['In person']);

  // Reset unticks them all: every channel again.
  await filters.getByRole('button', { name: 'Reset' }).click();
  await expect(filters.getByRole('button', { name: 'Channels All channels' })).toBeVisible();
  await expect(revenue.getByText('One line per channel')).toBeVisible();
});

test('the tag menu lists the tags expenses actually have', async ({ page }) => {
  await registerNewBusiness(page);

  await openFromSidebar(page, 'Expenses');
  await addButton(page).click();
  const form = page.getByRole('dialog', { name: 'Add expense' });
  const line = form.getByRole('group', { name: 'Expense item 1' });
  await line.getByLabel('Description').fill('Craft paper roll');
  await line.getByLabel('Qty').fill('1');
  await line.getByLabel(/Unit cost/).fill('4.50');
  await form.getByLabel('Date').fill(today());
  await form.getByLabel('Tag').selectOption('supplies'); // a starter tag
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form).toBeHidden();

  // Not the form's whole list of starter tags: only the one an expense has.
  await page.goto('/analytics/expenses');
  const { filters } = topRow(page);
  await filters.getByRole('button', { name: 'Tags All tags' }).click();
  await expect(filters.getByRole('checkbox')).toHaveCount(2);
  await expect(filters.getByRole('checkbox', { name: 'All tags' })).toBeVisible();
  await expect(filters.getByRole('checkbox', { name: 'supplies', exact: true })).toBeVisible();
});
