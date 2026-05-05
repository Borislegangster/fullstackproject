import React, { Component } from 'react';
import {
  HardHatIcon,
  KeyIcon,
  ShieldCheckIcon,
  PencilRulerIcon,
  FileTextIcon,
  BrickWallIcon,
  PaintRollerIcon,
  BuildingIcon,
  Building2Icon,
  RulerIcon,
  AwardIcon,
  WrenchIcon } from
'lucide-react';
/**
 * Centralized icon registry.
 * Maps string keys (from API/mock data) to React icon components.
 * This allows icons to be referenced by name in data while keeping
 * the actual JSX rendering in the frontend.
 */
const iconMap: Record<
  string,
  ComponentType<{
    className?: string;
  }>> =
{
  HardHatIcon,
  KeyIcon,
  ShieldCheckIcon,
  PencilRulerIcon,
  FileTextIcon,
  BrickWallIcon,
  PaintRollerIcon,
  BuildingIcon,
  Building2Icon,
  RulerIcon,
  AwardIcon,
  WrenchIcon
};
/**
 * Get a React icon component by its string key.
 * Returns null if the key is not found.
 */
export function getIcon(key: string, className?: string): React.ReactNode {
  const IconComponent = iconMap[key];
  if (!IconComponent) return null;
  return <IconComponent className={className} />;
}