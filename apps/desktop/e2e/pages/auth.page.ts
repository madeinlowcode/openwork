/**
 * @file auth.page.ts
 * @description Page Object Model for Authentication pages (Login, Register, Forgot Password)
 *
 * @context E2E Tests > Auth
 *
 * @dependencies
 * - @playwright/test (Page type)
 * - ../config (TEST_TIMEOUTS)
 *
 * @relatedFiles
 * - pages/Auth.tsx (Auth page component)
 * - components/auth/LoginForm.tsx (Login form)
 * - components/auth/RegisterForm.tsx (Register form)
 * - specs/auth.spec.ts (Auth tests)
 *
 * AIDEV-NOTE: Page Object for auth-related E2E tests
 * AIDEV-WARNING: Selectors must match actual data-testid attributes
 */

import type { Page } from '@playwright/test';
import { TEST_TIMEOUTS } from '../config';

export class AuthPage {
  constructor(private page: Page) {}

  // ============================================================================
  // Locators - Page Structure
  // ============================================================================

  /** Main auth card container */
  get authCard() {
    return this.page.locator('[class*="Card"]').first();
  }

  /** Logo/brand section */
  get brandLogo() {
    return this.page.locator('h1:has-text("Juris IA")');
  }

  /** Loading spinner */
  get loadingSpinner() {
    return this.page.locator('[class*="animate-spin"]');
  }

  /** Error display container */
  get errorContainer() {
    return this.page.locator('[class*="border-destructive"]');
  }

  /** Success message container */
  get successContainer() {
    return this.page.locator('[class*="border-green"]');
  }

  // ============================================================================
  // Locators - Login Form
  // ============================================================================

  /** Login form container */
  get loginForm() {
    return this.page.locator('form').filter({ hasText: 'Entrar' });
  }

  /** Login email input */
  get loginEmailInput() {
    return this.page.locator('#email');
  }

  /** Login password input */
  get loginPasswordInput() {
    return this.page.locator('#password');
  }

  /** Login submit button */
  get loginSubmitButton() {
    return this.page.getByRole('button', { name: /Entrar|Enter/i }).first();
  }

  /** Forgot password link */
  get forgotPasswordLink() {
    return this.page.getByText(/Esqueceu a senha\?|Forgot password/i);
  }

  /** Switch to register link */
  get switchToRegisterLink() {
    return this.page.getByText(/Criar conta|Sign up/i);
  }

  // ============================================================================
  // Locators - Register Form
  // ============================================================================

  /** Register form container */
  get registerForm() {
    return this.page.locator('form').filter({ hasText: 'Criar conta' });
  }

  /** Register name input */
  get registerNameInput() {
    return this.page.locator('#name');
  }

  /** Register email input */
  get registerEmailInput() {
    return this.page.locator('#email');
  }

  /** Register password input */
  get registerPasswordInput() {
    return this.page.locator('#password');
  }

  /** Register confirm password input */
  get registerConfirmPasswordInput() {
    return this.page.locator('#confirmPassword');
  }

  /** Register submit button */
  get registerSubmitButton() {
    return this.page.getByRole('button', { name: /Criar conta|Create account/i }).first();
  }

  /** Switch to login link */
  get switchToLoginLink() {
    return this.page.getByRole('button', { name: /Entrar|Sign in/i });
  }

  // ============================================================================
  // Locators - Forgot Password Form
  // ============================================================================

  /** Forgot password form container */
  get forgotPasswordForm() {
    return this.page.locator('form').filter({ hasText: 'Recuperar senha' });
  }

  /** Forgot password email input */
  get forgotPasswordEmailInput() {
    return this.page.locator('#forgot-email');
  }

  /** Forgot password submit button */
  get forgotPasswordSubmitButton() {
    return this.page.getByRole('button', { name: /Enviar link|Send link/i });
  }

  /** Back to login button */
  get backToLoginButton() {
    return this.page.getByRole('button', { name: /Voltar ao login|Back to login/i });
  }

  // ============================================================================
  // Navigation Actions
  // ============================================================================

  /** Navigate to auth page */
  async navigateToAuth() {
    // In Electron, we need to use evaluate to change the hash route
    // since goto() doesn't work with hash routes
    await this.page.evaluate(() => {
      window.location.hash = '#/auth';
    });
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);
  }

  /** Wait for auth page to load */
  async waitForAuthPageLoad() {
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for either login form, loading spinner, or error state
    await this.page.waitForSelector('form, [class*="animate-spin"], h1:has-text("Erro"), h1:has-text("Error")', {
      state: 'visible',
      timeout: TEST_TIMEOUTS.NAVIGATION,
    });
    // If loading, wait for it to finish
    const spinner = await this.loadingSpinner.isVisible();
    if (spinner) {
      await this.loadingSpinner.waitFor({ state: 'hidden', timeout: TEST_TIMEOUTS.NAVIGATION });
    }
  }

  /** Check if auth page shows initialization error */
  async hasInitializationError(): Promise<boolean> {
    const errorTitle = this.page.locator('h1:has-text("Erro"), h1:has-text("Error")');
    return errorTitle.isVisible().catch(() => false);
  }

  /** Get initialization error message */
  async getInitializationErrorText(): Promise<string> {
    const errorMessage = this.page.locator('p.text-muted-foreground');
    if (await errorMessage.isVisible()) {
      return errorMessage.innerText();
    }
    return '';
  }

  // ============================================================================
  // Login Actions
  // ============================================================================

  /** Fill login form with credentials */
  async fillLoginForm(email: string, password: string) {
    await this.loginEmailInput.fill(email);
    await this.loginPasswordInput.fill(password);
  }

  /** Submit login form */
  async submitLogin() {
    await this.loginSubmitButton.click();
    await this.page.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);
  }

  /** Perform complete login flow */
  async login(email: string, password: string) {
    await this.fillLoginForm(email, password);
    await this.submitLogin();
  }

  /** Click forgot password link */
  async clickForgotPassword() {
    await this.forgotPasswordLink.click();
    await this.page.waitForTimeout(TEST_TIMEOUTS.ANIMATION);
  }

  /** Click switch to register link */
  async clickSwitchToRegister() {
    await this.switchToRegisterLink.click();
    await this.page.waitForTimeout(TEST_TIMEOUTS.ANIMATION);
  }

  // ============================================================================
  // Register Actions
  // ============================================================================

  /** Fill register form with user data */
  async fillRegisterForm(name: string, email: string, password: string, confirmPassword: string) {
    await this.registerNameInput.fill(name);
    await this.registerEmailInput.fill(email);
    await this.registerPasswordInput.fill(password);
    await this.registerConfirmPasswordInput.fill(confirmPassword);
  }

  /** Submit register form */
  async submitRegister() {
    await this.registerSubmitButton.click();
    await this.page.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);
  }

  /** Perform complete registration flow */
  async register(name: string, email: string, password: string) {
    await this.fillRegisterForm(name, email, password, password);
    await this.submitRegister();
  }

  /** Click switch to login link */
  async clickSwitchToLogin() {
    await this.switchToLoginLink.click();
    await this.page.waitForTimeout(TEST_TIMEOUTS.ANIMATION);
  }

  // ============================================================================
  // Forgot Password Actions
  // ============================================================================

  /** Fill forgot password form */
  async fillForgotPasswordForm(email: string) {
    await this.forgotPasswordEmailInput.fill(email);
  }

  /** Submit forgot password form */
  async submitForgotPassword() {
    await this.forgotPasswordSubmitButton.click();
    await this.page.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);
  }

  /** Perform complete forgot password flow */
  async requestPasswordReset(email: string) {
    await this.fillForgotPasswordForm(email);
    await this.submitForgotPassword();
  }

  /** Click back to login button */
  async clickBackToLogin() {
    await this.backToLoginButton.click();
    await this.page.waitForTimeout(TEST_TIMEOUTS.ANIMATION);
  }

  // ============================================================================
  // Validation Helpers
  // ============================================================================

  /** Check if error message is displayed */
  async hasError(): Promise<boolean> {
    return this.errorContainer.isVisible();
  }

  /** Get error message text */
  async getErrorText(): Promise<string> {
    if (await this.hasError()) {
      return this.errorContainer.innerText();
    }
    return '';
  }

  /** Check if success message is displayed */
  async hasSuccess(): Promise<boolean> {
    return this.successContainer.isVisible();
  }

  /** Get success message text */
  async getSuccessText(): Promise<string> {
    if (await this.hasSuccess()) {
      return this.successContainer.innerText();
    }
    return '';
  }

  /** Check if login form is visible */
  async isLoginFormVisible(): Promise<boolean> {
    // Check for login form title
    return this.page.getByRole('heading', { name: /Entrar|Login/i }).isVisible();
  }

  /** Check if register form is visible */
  async isRegisterFormVisible(): Promise<boolean> {
    // Check for register form title
    return this.page.getByRole('heading', { name: /Criar conta|Create account/i }).isVisible();
  }

  /** Check if forgot password form is visible */
  async isForgotPasswordFormVisible(): Promise<boolean> {
    // Check for forgot password form title
    return this.page.getByRole('heading', { name: /Recuperar senha|Forgot password/i }).isVisible();
  }

  /** Check if loading spinner is visible */
  async isLoading(): Promise<boolean> {
    return this.loadingSpinner.isVisible();
  }

  /** Wait for loading to complete */
  async waitForLoadingComplete() {
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: TEST_TIMEOUTS.NAVIGATION });
  }

  // ============================================================================
  // Form State Helpers
  // ============================================================================

  /** Check if login submit button is disabled */
  async isLoginButtonDisabled(): Promise<boolean> {
    return this.loginSubmitButton.isDisabled();
  }

  /** Check if register submit button is disabled */
  async isRegisterButtonDisabled(): Promise<boolean> {
    return this.registerSubmitButton.isDisabled();
  }

  /** Clear all login form fields */
  async clearLoginForm() {
    await this.loginEmailInput.clear();
    await this.loginPasswordInput.clear();
  }

  /** Clear all register form fields */
  async clearRegisterForm() {
    await this.registerNameInput.clear();
    await this.registerEmailInput.clear();
    await this.registerPasswordInput.clear();
    await this.registerConfirmPasswordInput.clear();
  }

  // ============================================================================
  // Accessibility Helpers
  // ============================================================================

  /** Check if email input has associated label */
  async hasEmailLabel(): Promise<boolean> {
    const label = this.page.locator('label[for="email"]');
    return label.isVisible();
  }

  /** Check if password input has associated label */
  async hasPasswordLabel(): Promise<boolean> {
    const label = this.page.locator('label[for="password"]');
    return label.isVisible();
  }

  /** Navigate using Tab key */
  async tabToNextField() {
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(100);
  }

  /** Submit form using Enter key */
  async submitWithEnter() {
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(TEST_TIMEOUTS.STATE_UPDATE);
  }
}
