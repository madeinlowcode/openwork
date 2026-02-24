// @vitest-environment jsdom
/**
 * @test UpdateNotification
 * @description Testes unitarios para o componente UpdateNotification
 *
 * @type Unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UpdateNotification } from '../../../../src/renderer/components/UpdateNotification';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock window.jurisiar
const mockRestartAndUpdate = vi.fn().mockResolvedValue(undefined);
let updateAvailableCallback: ((data: { version: string }) => void) | null = null;
let updateProgressCallback: ((data: { percent: number; bytesPerSecond: number }) => void) | null = null;
let updateDownloadedCallback: ((data: { version: string }) => void) | null = null;

beforeEach(() => {
  updateAvailableCallback = null;
  updateProgressCallback = null;
  updateDownloadedCallback = null;

  (window as any).jurisiar = {
    onUpdateAvailable: (cb: any) => {
      updateAvailableCallback = cb;
      return () => { updateAvailableCallback = null; };
    },
    onUpdateProgress: (cb: any) => {
      updateProgressCallback = cb;
      return () => { updateProgressCallback = null; };
    },
    onUpdateDownloaded: (cb: any) => {
      updateDownloadedCallback = cb;
      return () => { updateDownloadedCallback = null; };
    },
    restartAndUpdate: mockRestartAndUpdate,
  };
});

afterEach(() => {
  vi.clearAllMocks();
  delete (window as any).jurisiar;
});

describe('UpdateNotification', () => {
  it('nao renderiza nada quando nao ha update', () => {
    const { container } = render(<UpdateNotification />);
    expect(container.querySelector('[data-testid="update-notification"]')).toBeNull();
  });

  it('mostra "Baixando atualizacao..." quando update disponivel', () => {
    render(<UpdateNotification />);

    act(() => {
      updateAvailableCallback?.({ version: '2.0.0' });
    });

    expect(screen.getByTestId('update-notification')).toBeTruthy();
    expect(screen.getByText(/2\.0\.0/)).toBeTruthy();
    expect(screen.getByText(/[Bb]aixando/)).toBeTruthy();
  });

  it('mostra versao e botao "Reiniciar Agora" quando download completo', () => {
    render(<UpdateNotification />);

    act(() => {
      updateAvailableCallback?.({ version: '2.0.0' });
    });
    act(() => {
      updateDownloadedCallback?.({ version: '2.0.0' });
    });

    expect(screen.getByText(/2\.0\.0/)).toBeTruthy();
    expect(screen.getByText(/[Rr]einiciar/)).toBeTruthy();
  });

  it('botao reiniciar chama restartAndUpdate', () => {
    render(<UpdateNotification />);

    act(() => {
      updateAvailableCallback?.({ version: '2.0.0' });
    });
    act(() => {
      updateDownloadedCallback?.({ version: '2.0.0' });
    });

    fireEvent.click(screen.getByText(/[Rr]einiciar/));
    expect(mockRestartAndUpdate).toHaveBeenCalled();
  });

  it('botao dismiss esconde a notificacao', () => {
    render(<UpdateNotification />);

    act(() => {
      updateAvailableCallback?.({ version: '2.0.0' });
    });

    expect(screen.getByTestId('update-notification')).toBeTruthy();

    fireEvent.click(screen.getByTestId('update-notification-dismiss'));

    expect(screen.queryByTestId('update-notification')).toBeNull();
  });
});
