/**
 * ExportButton — verify the busy state, error fan-out and disabled handling.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportButton } from '../components/ui/ExportButton';

describe('ExportButton', () => {
  it('shows the label and triggers the action', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    render(<ExportButton label="Export Excel" onAction={action} onSuccess={onSuccess} />);

    const btn = screen.getByRole('button', { name: /Export Excel/i });
    fireEvent.click(btn);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('surfaces errors via onError', async () => {
    const action = vi.fn().mockRejectedValue({
      response: { data: { detail: 'Boom!' } },
    });
    const onError = vi.fn();
    render(<ExportButton onAction={action} onError={onError} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Boom!'));
  });

  it('ignores double clicks while busy', async () => {
    const deferred: { resolve?: () => void } = {};
    const action = vi.fn().mockImplementation(
      () => new Promise<void>((res) => { deferred.resolve = res; }),
    );
    render(<ExportButton onAction={action} />);

    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);

    // Should have fired only once
    expect(action).toHaveBeenCalledTimes(1);
    // Cleanup the dangling promise so React doesn't warn
    deferred.resolve?.();
  });
});
