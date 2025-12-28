/**
 * API Catalog RBAC Permission Utilities
 * Helpers to check user permissions for catalog operations
 */

import type { CatalogRole, CatalogPermissions } from '@/types/apiCatalog'
export type { CatalogRole } from '@/types/apiCatalog'

/**
 * Get permissions object for a given catalog role
 */
export function getRolePermissions(role: CatalogRole): CatalogPermissions {
  const permissions: Record<CatalogRole, CatalogPermissions> = {
    catalog_viewer: {
      canView: true,
      canEdit: false,
      canPublish: false,
      canDelete: false,
      canManageRoles: false,
    },
    catalog_editor: {
      canView: true,
      canEdit: true,
      canPublish: false,
      canDelete: false,
      canManageRoles: false,
    },
    catalog_publisher: {
      canView: true,
      canEdit: true,
      canPublish: true,
      canDelete: true,
      canManageRoles: false,
    },
    admin: {
      canView: true,
      canEdit: true,
      canPublish: true,
      canDelete: true,
      canManageRoles: true,
    },
  }

  return permissions[role]
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: CatalogRole,
  permission: keyof CatalogPermissions
): boolean {
  const permissions = getRolePermissions(role)
  return permissions[permission]
}

/**
 * Check if user can view catalog
 */
export function canViewCatalog(role: CatalogRole): boolean {
  return hasPermission(role, 'canView')
}

/**
 * Check if user can edit draft endpoints/connections
 */
export function canEditDrafts(role: CatalogRole): boolean {
  return hasPermission(role, 'canEdit')
}

/**
 * Check if user can publish versions
 */
export function canPublishVersions(role: CatalogRole): boolean {
  return hasPermission(role, 'canPublish')
}

/**
 * Check if user can delete endpoints/connections
 */
export function canDeleteItems(role: CatalogRole): boolean {
  return hasPermission(role, 'canDelete')
}

/**
 * Check if user can manage catalog roles
 */
export function canManageRoles(role: CatalogRole): boolean {
  return hasPermission(role, 'canManageRoles')
}

/**
 * Get minimum required role for an action
 */
export function getRequiredRole(action: keyof CatalogPermissions): CatalogRole {
  const roleHierarchy: CatalogRole[] = [
    'catalog_viewer',
    'catalog_editor',
    'catalog_publisher',
    'admin',
  ]

  for (const role of roleHierarchy) {
    if (hasPermission(role, action)) {
      return role
    }
  }

  return 'admin'
}

/**
 * Get user-friendly role display name
 */
export function getRoleDisplayName(role: CatalogRole): string {
  const names: Record<CatalogRole, string> = {
    catalog_viewer: 'Catalog Viewer',
    catalog_editor: 'Catalog Editor',
    catalog_publisher: 'Catalog Publisher',
    admin: 'Administrator',
  }

  return names[role]
}

/**
 * Get role description
 */
export function getRoleDescription(role: CatalogRole): string {
  const descriptions: Record<CatalogRole, string> = {
    catalog_viewer:
      'Can view catalog endpoints and configurations (read-only access)',
    catalog_editor:
      'Can create and edit draft endpoints and connections',
    catalog_publisher:
      'Can publish changes to preview and production environments',
    admin:
      'Full access to catalog management including role assignments',
  }

  return descriptions[role]
}

/**
 * Compare two roles to determine hierarchy
 * Returns: 1 if role1 > role2, -1 if role1 < role2, 0 if equal
 */
export function compareRoles(role1: CatalogRole, role2: CatalogRole): number {
  const hierarchy: Record<CatalogRole, number> = {
    catalog_viewer: 1,
    catalog_editor: 2,
    catalog_publisher: 3,
    admin: 4,
  }

  const level1 = hierarchy[role1]
  const level2 = hierarchy[role2]

  if (level1 > level2) return 1
  if (level1 < level2) return -1
  return 0
}

/**
 * Check if role1 has equal or higher permissions than role2
 */
export function hasEqualOrHigherRole(
  role1: CatalogRole,
  role2: CatalogRole
): boolean {
  return compareRoles(role1, role2) >= 0
}

/**
 * Get all available catalog roles
 */
export function getAllCatalogRoles(): CatalogRole[] {
  return ['catalog_viewer', 'catalog_editor', 'catalog_publisher', 'admin']
}

/**
 * Validate if a string is a valid catalog role
 */
export function isValidCatalogRole(role: string): role is CatalogRole {
  return getAllCatalogRoles().includes(role as CatalogRole)
}
