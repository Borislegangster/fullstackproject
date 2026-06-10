/**
 * EmptyState — Friendly placeholder shown when a list query resolves with [].
 */
import React from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({
  icon, title, description, action, className = '',
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}>
      {icon && (
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4 text-gray-500">
          {icon}
        </div>
      )}
      <h3 className="font-montserrat font-bold text-base text-globus-blue-dark mb-2">
        {title}
      </h3>
      {description && (
        <p className="font-opensans text-sm text-globus-gray max-w-md">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold text-sm py-2.5 px-5 rounded-lg transition-colors">
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
