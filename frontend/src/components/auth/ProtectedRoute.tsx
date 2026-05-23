import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GlobusLoader } from '../ui/GlobusLoader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If set, only users with this role can access the route. */
  requiredRole?: string;
  /** Where to redirect unauthenticated users. Defaults to /connexion. */
  redirectTo?: string;
}

/**
 * Wraps private routes to enforce authentication and optional role-based access.
 *
 * While the auth state is loading (e.g. session restore), renders a full-screen loader.
 * Once resolved:
 *  - Unauthenticated → redirect to login
 *  - Wrong role       → redirect to appropriate portal
 *  - Authenticated    → render children
 */
export function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/connexion',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Still resolving session — show loader
  if (isLoading) {
    return <GlobusLoader />;
  }

  // Not authenticated — redirect to login (preserve intended URL)
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Role check
  if (requiredRole && user?.role !== requiredRole) {
    // Redirect clients trying to access admin ERP to their portal
    if (user?.role === 'CLIENT') {
      return <Navigate to="/espace-client" replace />;
    }
    // Redirect admins trying to access client portal to ERP
    if (user?.role === 'ADMIN') {
      return <Navigate to="/erp" replace />;
    }
    // Fallback
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
