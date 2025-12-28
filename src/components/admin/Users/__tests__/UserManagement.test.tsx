import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UserManagement from '../UserManagement';

vi.mock('@/services/adminService', () => ({
  getAllUsers: vi.fn().mockResolvedValue({
    items: [
      { id: '1', name: 'Alice', email: 'alice@example.com', role: 'viewer', isActive: true },
      { id: '2', name: 'Bob', email: 'bob@example.com', role: 'analyst', isActive: true },
    ],
    total: 2,
  }),
  updateUserRole: vi.fn().mockResolvedValue({}),
  disableUser: vi.fn().mockResolvedValue({}),
  enableUser: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const renderWithClient = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <UserManagement />
    </QueryClientProvider>,
  );
};

describe('UserManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders user rows from query data', async () => {
    renderWithClient();
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(2); // header + data rows
  });

  it('opens role modal on edit', async () => {
    renderWithClient();
    const editButton = await screen.findAllByRole('button', { name: /edit role/i });
    fireEvent.click(editButton[0]);
    expect(await screen.findByText(/Update Role:/i)).toBeInTheDocument();
  });

  it('submits role update with correct payload', async () => {
    const { updateUserRole } = await import('@/services/adminService');
    renderWithClient();
    const editButton = await screen.findAllByRole('button', { name: /edit role/i });
    fireEvent.click(editButton[0]);
    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: /update role/i }));

    await waitFor(() => {
      expect(updateUserRole).toHaveBeenCalledWith('1', 'admin');
    });
  });
});
