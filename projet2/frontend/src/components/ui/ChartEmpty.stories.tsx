import type { Meta, StoryObj } from '@storybook/react';

import { ChartEmpty } from './ChartEmpty';

const meta = {
  title: 'UI/ChartEmpty',
  component: ChartEmpty,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    state: { control: 'inline-radio', options: ['loading', 'error', 'empty'] },
  },
} satisfies Meta<typeof ChartEmpty>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { state: 'empty' } };
export const Loading: Story = { args: { state: 'loading' } };
export const ErrorState: Story = { args: { state: 'error' } };
export const CustomMessage: Story = {
  args: { state: 'empty', message: 'Aucune dépense enregistrée' },
};
