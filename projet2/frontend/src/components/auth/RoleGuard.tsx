import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface RoleGuardProps {
  /** Roles that are allowed to access this content. */
  roles: string[];
  children: React.ReactNode;
  /**
   * Optional fallback to render instead of redirecting.
   * If not provided, redirects to /erp (staff) or /espace-client (client).
   */
  fallback?: React.ReactNode;
}

/**
 * Fine-grained role guard for use inside already-authenticated routes.
 *
 * Use this inside the ERP to restrict specific modules to specific roles.
 * The user is already confirmed authenticated by the parent ProtectedRoute.
 *
 * @example
 * <RoleGuard roles={['ADMIN', 'RH']}>
 *   <ErpRH />
 * </RoleGuard>
 */
export function RoleGuard({ roles, children, fallback }: RoleGuardProps) {
  const { user } = useAuth();

  const userRole = user?.role || '';

  if (!roles.includes(userRole)) {
    // Provide fallback UI or redirect to the ERP dashboard
    if (fallback) {
      return <>{fallback}</>;
    }
    return <Navigate to="/erp" replace />;
  }

  return <>{children}</>;
}

/**
 * Convenience component: renders children only for ADMIN users.
 */
export function AdminOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleGuard roles={['ADMIN']} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}

/**
 * Convenience component: renders children for any staff role (not CLIENT).
 */
export function StaffOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleGuard roles={['ADMIN', 'CHEF_PROJET', 'COMPTABLE', 'RH']} fallback={fallback}>
      {children}
    </RoleGuard>
  );
}
