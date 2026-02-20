// @vitest-environment jsdom
/**
 * @module __tests__/unit/renderer/components/AuthGate.unit.test
 * @description Testes unitarios para AuthGate component.
 * Valida estados: checking (spinner), unauthed (redirect), authed (children).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock jurisiar
const mockGetSession = vi.fn();
vi.mock('@/lib/jurisiar', () => ({
  getJurisiar: () => ({
    auth: {
      getSession: mockGetSession,
    },
  }),
  isRunningInElectron: () => true,
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => (
    <div data-testid="spinner" className={className}>Loading...</div>
  ),
}));

import { AuthGate } from '@renderer/components/AuthGate';

function renderWithRouter(ui: React.ReactElement, initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
  );
}

describe('AuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows spinner while checking session', () => {
    // Never resolve the promise to keep state as "checking"
    mockGetSession.mockReturnValue(new Promise(() => {}));

    renderWithRouter(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    expect(screen.getByTestId('spinner')).toBeDefined();
    expect(screen.queryByText('Protected Content')).toBeNull();
  });

  it('renders children when session exists (authed)', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });

    renderWithRouter(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeDefined();
    });
  });

  it('redirects to /login when no session (unauthed)', async () => {
    mockGetSession.mockResolvedValue(null);

    const { container } = renderWithRouter(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    await waitFor(() => {
      expect(screen.queryByText('Protected Content')).toBeNull();
      // Navigate component does not render visible content
      expect(screen.queryByTestId('spinner')).toBeNull();
    });
  });

  it('redirects to /login when getSession rejects', async () => {
    mockGetSession.mockRejectedValue(new Error('Auth failed'));

    renderWithRouter(
      <AuthGate>
        <div>Protected Content</div>
      </AuthGate>
    );

    await waitFor(() => {
      expect(screen.queryByText('Protected Content')).toBeNull();
      expect(screen.queryByTestId('spinner')).toBeNull();
    });
  });
});
