import { Page, expect } from '@playwright/test';

export class CartPage {
  readonly page: Page;
  readonly checkoutBtn = 'button[data-test=proceed-to-checkout]';
  readonly itemRow = '.cart-item';

  constructor(page: Page) { this.page = page; }

  async goto() { await this.page.goto('/cart'); }

  async expectItemInCart() {
    // Verify at least one cart item exists — prevents false positives where checkout proceeds without items
    await expect(this.page.locator(this.itemRow)).toHaveCountGreaterThan(0);
  }

  async proceedToCheckout() {
    await this.page.click(this.checkoutBtn);
    await this.page.waitForLoadState('networkidle');
  }
}
