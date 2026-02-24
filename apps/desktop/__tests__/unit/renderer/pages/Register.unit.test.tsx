// @vitest-environment jsdom
/**
 * @test RegisterPage
 * @description Testes unitarios para a pagina de registro de usuario
 *
 * @relatedFiles
 * - src/renderer/pages/Register.tsx (componente testado)
 * - src/renderer/pages/Login.tsx (pagina relacionada)
 *
 * AIDEV-NOTE: Testes cobrem validacao client-side, estados de loading e navegacao
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock jurisiar API
const mockSignUp = vi.fn();
vi.mock('@/lib/jurisiar', () => ({
  getJurisiar: () => ({
    auth: {
      signUp: mockSignUp,
    },
  }),
}));

import { RegisterPage } from '@/pages/Register';

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <RegisterPage />
    </MemoryRouter>
  );
}

function fillForm(overrides: {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
} = {}) {
  const {
    name = 'Test User',
    email = 'test@example.com',
    password = 'Password123',
    confirmPassword = 'Password123',
  } = overrides;

  fireEvent.change(screen.getByLabelText(/nome completo/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: confirmPassword } });
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignUp.mockResolvedValue({ user: { id: '1' } });
  });

  it('renderiza formulario com campos nome, email, senha e confirmar senha', () => {
    renderRegister();

    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
  });

  it('mostra erro se senhas nao coincidem', async () => {
    renderRegister();
    fillForm({ password: 'Password123', confirmPassword: 'Password456' });

    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(screen.getByText(/senhas não coincidem/i)).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('mostra erro se email invalido', async () => {
    renderRegister();
    fillForm({ email: 'invalid-email' });

    // AIDEV-NOTE: Usar fireEvent.submit pois jsdom pode bloquear click em input type=email invalido
    const form = screen.getByRole('button', { name: /criar conta/i }).closest('form')!;
    fireEvent.submit(form);

    expect(screen.getByText(/e-mail inválido/i)).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('botao submit desabilitado durante loading', async () => {
    mockSignUp.mockImplementation(() => new Promise(() => {}));
    renderRegister();
    fillForm();

    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /criando/i })).toBeDisabled();
    });
  });

  it('link "Ja tem conta?" navega para /login', () => {
    renderRegister();

    fireEvent.click(screen.getByText(/entrar/i));

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('navega para /login com state registered apos sucesso', async () => {
    renderRegister();
    fillForm();

    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { state: { registered: true } });
    });
  });

  it('mostra mensagem de erro do servidor', async () => {
    mockSignUp.mockRejectedValue(new Error('Email already registered'));
    renderRegister();
    fillForm();

    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument();
    });
  });

  it('valida senha com minimo de 8 caracteres', () => {
    renderRegister();
    fillForm({ password: 'Short1', confirmPassword: 'Short1' });

    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(screen.getByText(/senha deve ter pelo menos 8 caracteres/i)).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });
});
