import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectionForm } from '../ConnectionForm';

describe('ConnectionForm', () => {
  it('shows validation errors when required fields are missing', async () => {
    const onSubmit = vi.fn();
    const { container } = render(<ConnectionForm onSubmit={onSubmit} />);

    // Disable native validation to exercise custom validation logic
    container.querySelector('form')?.setAttribute('novalidate', 'true');

    fireEvent.click(screen.getByRole('button', { name: /create connection/i }));

    expect(await screen.findByText(/Name is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/Base URL is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits data when required fields are provided', async () => {
    const onSubmit = vi.fn();
    const { container } = render(<ConnectionForm onSubmit={onSubmit} />);

    container.querySelector('form')?.setAttribute('novalidate', 'true');

    fireEvent.change(screen.getByLabelText(/Connection Name/i), {
      target: { value: 'Production API' },
    });
    fireEvent.change(screen.getByLabelText(/Base URL/i), {
      target: { value: 'https://api.example.com/v1' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create connection/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Production API',
        baseUrl: 'https://api.example.com/v1',
        authType: 'none',
      }),
    );
  });
});
