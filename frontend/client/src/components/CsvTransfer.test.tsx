import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/http';
import { CsvTransfer } from './CsvTransfer';

function csvFile(content: string): File {
  const file = new File([content], 'test.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: async () => content });
  return file;
}

describe('CsvTransfer', () => {
  it('requires confirmation, skips duplicate IDs, and counts only successful records', async () => {
    const user = userEvent.setup();
    const importRow = vi.fn().mockResolvedValue('updated');
    const onImported = vi.fn();
    render(
      <CsvTransfer
        filename="inventory"
        headers={['id', 'name']}
        loadRows={async () => []}
        exportRow={() => []}
        importHeaders={['name']}
        importRow={importRow}
        onImported={onImported}
      />,
    );
    const lines = Array.from({ length: 12 }, (_, index) => `${index + 1},item${index + 1}`);
    await user.upload(
      screen.getByLabelText('Import inventory CSV'),
      csvFile(`id,name\n${lines.join('\n')}\n1,item1`),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Confirm CSV Import' });
    expect(importRow).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Import CSV' }));
    await waitFor(() => expect(importRow).toHaveBeenCalledTimes(12));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Imported 0 new and updated 12 record(s). Skipped 1 duplicate row(s): 14.',
    );
    expect(onImported).toHaveBeenCalledTimes(1);
  });

  it('reports physical row numbers and actionable API errors, and retries a failed duplicate', async () => {
    const user = userEvent.setup();
    const importRow = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(400, 'Request body is not valid JSON'))
      .mockRejectedValueOnce(
        new ApiError(400, 'Validation failed', [
          { field: 'items.0.quantity', message: 'Required' },
        ]),
      )
      .mockResolvedValue('created');
    render(
      <CsvTransfer
        filename="sales"
        headers={['id', 'name']}
        loadRows={async () => []}
        exportRow={() => []}
        importHeaders={['name']}
        importRow={importRow}
      />,
    );
    fireEvent.change(screen.getByLabelText('Import sales CSV'), {
      target: { files: [csvFile('id,name\n\n1,"first\nline"\n2,bad\n2,good\n')] },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Confirm CSV Import' });
    await user.click(within(dialog).getByRole('button', { name: 'Import CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Row 3: The server could not read one or more row values.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Row 5: items.0.quantity: Required');
    expect(screen.getByRole('status')).toHaveTextContent('Imported 1 new and updated 0 record(s).');
    expect(importRow).toHaveBeenCalledTimes(3);
  });

  it('can cancel before any records are changed', async () => {
    const user = userEvent.setup();
    const importRow = vi.fn();
    render(
      <CsvTransfer
        filename="inventory"
        headers={['name']}
        loadRows={async () => []}
        exportRow={() => []}
        importHeaders={['name']}
        importRow={importRow}
      />,
    );
    await user.upload(screen.getByLabelText('Import inventory CSV'), csvFile('name\nTea'));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm CSV Import' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(importRow).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
