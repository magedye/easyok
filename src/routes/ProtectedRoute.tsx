import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { hasEqualOrHigherRole, getRequiredRole, type CatalogRole } from '@/utils/catalogPermissions';

const mapUserRoleToCatalogRole = (role?: string): CatalogRole => {
  if (role === 'admin') return 'admin';
  if (role === 'analyst') return 'catalog_editor';
  return 'catalog_viewer';
};

export const ProtectedRoute = ({
  children,
  requiredRole,
}: PropsWithChildren<{ requiredRole?: 'admin' | CatalogRole }>) => {
  const { token, user } = useAuthStore();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role) {
    const userCatalogRole = mapUserRoleToCatalogRole(user.role);
    const minRequiredRole =
      requiredRole === 'admin'
        ? 'admin'
        : (requiredRole as CatalogRole) || getRequiredRole('canView');

    if (!hasEqualOrHigherRole(userCatalogRole, minRequiredRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};
