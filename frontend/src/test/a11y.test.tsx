/**
 * Accessibility smoke tests — run axe-core against the shared UI primitives that
 * appear across every de-mocked page (empty states, loaders, chart placeholders).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { EmptyState } from '../components/ui/EmptyState';
import { ChartEmpty } from '../components/ui/ChartEmpty';
import { GlobusLoader } from '../components/ui/GlobusLoader';

// jsdom can't compute real colours/layout, so colour-contrast is meaningless
// here — disable it and let axe check the structural / ARIA rules that matter.
const axeOpts = { rules: { 'color-contrast': { enabled: false } } } as const;

describe('a11y — UI primitives have no axe violations', () => {
  it('EmptyState (with action)', async () => {
    const { container } = render(
      <EmptyState
        title="Aucune facture"
        description="Créez votre première facture pour commencer."
        action={{ label: 'Nouvelle facture', onClick: () => {} }}
      />,
    );
    expect(await axe(container, axeOpts)).toHaveNoViolations();
  });

  it('ChartEmpty (all three states)', async () => {
    const { container } = render(
      <div>
        <ChartEmpty state="loading" />
        <ChartEmpty state="error" />
        <ChartEmpty state="empty" />
      </div>,
    );
    expect(await axe(container, axeOpts)).toHaveNoViolations();
  });

  it('GlobusLoader', async () => {
    const { container } = render(<GlobusLoader />);
    expect(await axe(container, axeOpts)).toHaveNoViolations();
  });
});
