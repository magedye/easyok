import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { SkeletonTable } from '@/components/loading/SkeletonCard';
import { getAllUsers, updateUserRole, disableUser, enableUser } from '@/services/adminService';
import { handleApiError } from '@/utils/errorHandler';
import type { User, UserRole } from '@/types';
import { useToast } from '@/components/shared/Toast';

export function UserManagement() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => getAllUsers({ page: 1, limit: 50 }),
  });

  const roleUpdateMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedUser(null);
      setNewRole(null);
      setError(null);
      showToast({ title: 'Role updated', variant: 'success' });
    },
    onError: (err) => {
      const apiError = handleApiError(err);
      setError(apiError.message);
      showToast({ title: 'Update failed', description: apiError.message, variant: 'error' });
    },
  });

  const toggleUserMutation = useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: 'enable' | 'disable' }) =>
      action === 'disable' ? disableUser(userId) : enableUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      showToast({ title: 'User updated', variant: 'success' });
    },
    onError: (err) => {
      const apiError = handleApiError(err);
      setError(apiError.message);
      showToast({ title: 'Update failed', description: apiError.message, variant: 'error' });
    },
  });

  const handleRoleUpdate = () => {
    if (selectedUser && newRole) {
      roleUpdateMutation.mutate({ userId: selectedUser.userId, role: newRole });
    }
  };

  return (
    <>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      <Card title="User Management" description="Manage user accounts and roles">
        {usersLoading ? (
          <SkeletonTable rows={5} />
        ) : usersData?.items && usersData.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800">
                <tr>
                  <th className="text-left text-sm font-semibold text-neutral-900 dark:text-white py-3 px-4">
                    Name
                  </th>
                  <th className="text-left text-sm font-semibold text-neutral-900 dark:text-white py-3 px-4">
                    Email
                  </th>
                  <th className="text-left text-sm font-semibold text-neutral-900 dark:text-white py-3 px-4">
                    Role
                  </th>
                  <th className="text-left text-sm font-semibold text-neutral-900 dark:text-white py-3 px-4">
                    Status
                  </th>
                  <th className="text-left text-sm font-semibold text-neutral-900 dark:text-white py-3 px-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {usersData.items.map((user: User) => {
                  const displayName = user.fullName ?? user.username
                  const displayEmail = user.recoveryEmail ?? '—'
                  const actionLabel = user.isActive !== false ? 'Disable' : 'Enable'

                  return (
                    <tr key={user.userId} className="border-t border-neutral-200 dark:border-neutral-700">
                      <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">{displayName}</td>
                      <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">{displayEmail}</td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            user.role === 'admin'
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                              : user.role === 'analyst'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            user.isActive !== false
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          }`}
                        >
                          {user.isActive !== false ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            className="text-xs py-1 px-2"
                            onClick={() => {
                              setSelectedUser(user);
                              setNewRole(user.role ?? 'viewer');
                            }}
                          >
                            Edit Role
                          </Button>
                          <Button
                            variant="secondary"
                            className="text-xs py-1 px-2"
                            onClick={() => {
                              if (confirm(`${actionLabel} ${displayName}?`)) {
                                toggleUserMutation.mutate({
                                  userId: user.userId,
                                  action: user.isActive !== false ? 'disable' : 'enable',
                                });
                              }
                            }}
                            disabled={toggleUserMutation.isPending}
                          >
                            {actionLabel}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No users found</p>
        )}
      </Card>

      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full m-4">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-4">
              Update Role: {selectedUser.fullName ?? selectedUser.username}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Select New Role
                </label>
                <select
                  value={newRole ?? selectedUser.role ?? 'viewer'}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-800 dark:text-white"
                >
                  <option value="viewer">Viewer</option>
                  <option value="analyst">Analyst</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={handleRoleUpdate}
                  disabled={roleUpdateMutation.isPending || newRole === selectedUser.role}
                  className="flex-1"
                >
                  {roleUpdateMutation.isPending ? 'Updating...' : 'Update Role'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedUser(null);
                    setNewRole(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

export default UserManagement;
