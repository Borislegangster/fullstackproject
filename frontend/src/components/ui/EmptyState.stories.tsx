import type { Meta, StoryObj } from '@storybook/react';
import { InboxIcon } from 'lucide-react';

import { EmptyState } from './EmptyState';

const meta = {
  title: 'UI/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    title: 'Aucune facture',
    description: 'Aucune facture pour la période sélectionnée.',
  },
};

export const WithIcon: Story = {
  args: {
    icon: <InboxIcon className="w-7 h-7" />,
    title: 'Boîte de réception vide',
    description: "Vous n'avez aucun nouveau message.",
  },
};

export const WithAction: Story = {
  args: {
    icon: <InboxIcon className="w-7 h-7" />,
    title: 'Aucun chantier',
    description: 'Commencez par créer votre premier chantier.',
    action: { label: 'Nouveau chantier', onClick: () => {} },
  },
};
