/**
 * ChartEmpty — verify the three states render their adapted message.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartEmpty } from '../components/ui/ChartEmpty';

describe('ChartEmpty', () => {
  it('shows the default empty message', () => {
    render(<ChartEmpty />);
    expect(screen.getByText('Aucune donnée sur la période')).toBeInTheDocument();
  });

  it('shows the loading message', () => {
    render(<ChartEmpty state="loading" />);
    expect(screen.getByText('Chargement des données…')).toBeInTheDocument();
  });

  it('shows the error message', () => {
    render(<ChartEmpty state="error" />);
    expect(screen.getByText('Impossible de charger les données')).toBeInTheDocument();
  });

  it('honours a custom message', () => {
    render(<ChartEmpty message="Aucune dépense enregistrée" />);
    expect(screen.getByText('Aucune dépense enregistrée')).toBeInTheDocument();
  });
});
