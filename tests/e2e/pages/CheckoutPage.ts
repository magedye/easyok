import { Page, expect } from '@playwright/test';

export class CheckoutPage {
  readonly page: Page;
  readonly cardNumber = '#card-number';
  readonly expiry = '#card-expiry';
  readonly cvc = '#card-cvc';
  readonly payBtn = 'button[type=submit]';
  readonly validationError = '.field-error';
  readonly paymentError = '.payment-error';

  constructor(page: Page) { this.page = page; }

  async fillPayment(card: { number?: string, expiry?: string, cvc?: string }) {
    if (card.number !== undefined) await this.page.fill(this.cardNumber, card.number);
    if (card.expiry !== undefined) await this.page.fill(this.expiry, card.expiry);
    if (card.cvc !== undefined) await this.page.fill(this.cvc, card.cvc);
  }

  async submitPayment() {
    await this.page.click(this.payBtn);
    await this.page.waitForLoadState('networkidle');
  }

  async expectValidationErrorFor(selectorText: string) {
    // Checks that the form validation shows expected message for edge-case tests
    await expect(this.page.locator(this.validationError)).toContainText(selectorText);
  }

  async expectPaymentFailure(message = 'Payment failed') {
    await expect(this.page.locator(this.paymentError)).toBeVisible();
    await expect(this.page.locator(this.paymentError)).toHaveText(message);
  }
}
