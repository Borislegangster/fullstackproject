/**
 * EmptyState — component behaviour (title/description render, action fires).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EmptyState } from '../components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders the title and description', () => {
    render(<EmptyState title="Aucune facture" description="Créez votre première facture." />);
    expect(screen.getByRole('heading', { name: 'Aucune facture' })).toBeInTheDocument();
    expect(screen.getByText('Créez votre première facture.')).toBeInTheDocument();
  });

  it('omits the action button when no action is given', () => {
    render(<EmptyState title="Vide" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('fires the action callback on click', async () => {
    const onClick = vi.fn();
    render(<EmptyState title="Vide" action={{ label: 'Ajouter', onClick }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
