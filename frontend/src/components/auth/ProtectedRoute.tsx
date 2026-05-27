import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GlobusLoader } from '../ui/GlobusLoader';

const STAFF_ROLES = ['ADMIN', 'CHEF_PROJET', 'COMPTABLE', 'RH'];

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If set, only users with this role can access the route. Use 'STAFF' for any staff role. */
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
 *  - force_reset     → redirect to set-password page
 *  - Wrong role      → redirect to appropriate portal
 *  - Authenticated   → render children
 */
export function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/connexion',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, forceReset } = useAuth();
  const location = useLocation();

  // Still resolving session — show loader
  if (isLoading) {
    return <GlobusLoader />;
  }

  // Not authenticated — redirect to login (preserve intended URL)
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Force password reset — redirect to set-password page
  if (forceReset && location.pathname !== '/reset-mot-de-passe') {
    return <Navigate to="/reset-mot-de-passe" replace />;
  }

  // Role check
  if (requiredRole) {
    const userRole = user?.role || '';

    // 'STAFF' matches any non-CLIENT role
    if (requiredRole === 'STAFF') {
      if (!STAFF_ROLES.includes(userRole)) {
        return <Navigate to="/espace-client" replace />;
      }
    }
    // 'ADMIN' — for backward compatibility, allow all staff roles into ERP
    else if (requiredRole === 'ADMIN') {
      if (!STAFF_ROLES.includes(userRole)) {
        if (userRole === 'CLIENT') {
          return <Navigate to="/espace-client" replace />;
        }
        return <Navigate to="/" replace />;
      }
    }
    // 'CLIENT' — only clients
    else if (requiredRole === 'CLIENT') {
      if (userRole !== 'CLIENT') {
        return <Navigate to="/erp" replace />;
      }
    }
    // Exact role match
    else if (userRole !== requiredRole) {
      if (userRole === 'CLIENT') {
        return <Navigate to="/espace-client" replace />;
      }
      if (STAFF_ROLES.includes(userRole)) {
        return <Navigate to="/erp" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
