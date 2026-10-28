'use client';

import React, { createContext, useContext, useState } from 'react';

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  MODERATOR = 'MODERATOR',
  TAXONOMY_CURATOR = 'TAXONOMY_CURATOR',
  FINANCE_ADMIN = 'FINANCE_ADMIN',
  ANALYST = 'ANALYST',
}

export enum AdminPermission {
  MANAGE_USERS = 'MANAGE_USERS',
  REVIEW_CONTENT = 'REVIEW_CONTENT',
  MANAGE_REPORTS = 'MANAGE_REPORTS',
  EDIT_TAXONOMY = 'EDIT_TAXONOMY',
  MANAGE_FEATURE_FLAGS = 'MANAGE_FEATURE_FLAGS',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  MANAGE_PAYOUTS = 'MANAGE_PAYOUTS',
  VIEW_AUDIT_LOGS = 'VIEW_AUDIT_LOGS',
  MANAGE_COMPLIANCE = 'MANAGE_COMPLIANCE',
}

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  [AdminRole.SUPER_ADMIN]: [
    AdminPermission.MANAGE_USERS,
    AdminPermission.REVIEW_CONTENT,
    AdminPermission.MANAGE_REPORTS,
    AdminPermission.EDIT_TAXONOMY,
    AdminPermission.MANAGE_FEATURE_FLAGS,
    AdminPermission.VIEW_ANALYTICS,
    AdminPermission.MANAGE_PAYOUTS,
    AdminPermission.VIEW_AUDIT_LOGS,
    AdminPermission.MANAGE_COMPLIANCE,
  ],
  [AdminRole.MODERATOR]: [
    AdminPermission.MANAGE_USERS,
    AdminPermission.REVIEW_CONTENT,
    AdminPermission.MANAGE_REPORTS,
    AdminPermission.VIEW_AUDIT_LOGS,
    AdminPermission.MANAGE_COMPLIANCE,
  ],
  [AdminRole.TAXONOMY_CURATOR]: [
    AdminPermission.EDIT_TAXONOMY,
    AdminPermission.REVIEW_CONTENT,
    AdminPermission.VIEW_ANALYTICS,
  ],
  [AdminRole.FINANCE_ADMIN]: [
    AdminPermission.MANAGE_PAYOUTS,
    AdminPermission.VIEW_ANALYTICS,
    AdminPermission.VIEW_AUDIT_LOGS,
  ],
  [AdminRole.ANALYST]: [
    AdminPermission.VIEW_ANALYTICS,
    AdminPermission.VIEW_AUDIT_LOGS,
  ],
};

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

interface AdminAuthContextType {
  admin: AdminUser;
  setRole: (role: AdminRole) => void;
  hasPermission: (permission: AdminPermission) => boolean;
}

const defaultAdmin: AdminUser = {
  id: 'admin_root_1',
  name: 'Alex Rivera',
  email: 'alex@interest.internal',
  role: AdminRole.SUPER_ADMIN,
};

const AdminAuthContext = createContext<AdminAuthContextType>({
  admin: defaultAdmin,
  setRole: () => {},
  hasPermission: () => true,
});

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser>(defaultAdmin);

  const setRole = (role: AdminRole) => {
    setAdmin((prev) => ({ ...prev, role }));
  };

  const hasPermission = (permission: AdminPermission): boolean => {
    const permissions = ROLE_PERMISSIONS[admin.role] || [];
    return permissions.includes(permission);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, setRole, hasPermission }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => useContext(AdminAuthContext);
