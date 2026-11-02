import type { Meta, StoryObj } from '@storybook/react';

import { GlobusLoader } from './GlobusLoader';

const meta = {
  title: 'UI/GlobusLoader',
  component: GlobusLoader,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof GlobusLoader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
