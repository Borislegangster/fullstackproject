import type { Meta, StoryObj } from '@storybook/react';

import { SkeletonText, SkeletonCard, SkeletonGrid } from './Skeleton';

const meta = {
  title: 'UI/Skeleton',
  component: SkeletonCard,
  tags: ['autodocs'],
} satisfies Meta<typeof SkeletonCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Card: Story = {
  render: () => (
    <div className="w-80">
      <SkeletonCard />
    </div>
  ),
};

export const Text: Story = {
  render: () => (
    <div className="w-80">
      <SkeletonText lines={4} />
    </div>
  ),
};

export const Grid: Story = {
  render: () => <SkeletonGrid count={3} />,
};
