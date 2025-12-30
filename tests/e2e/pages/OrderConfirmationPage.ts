import { Page, expect } from '@playwright/test';

export class OrderConfirmationPage {
  readonly page: Page;
  readonly heading = 'h1';
  readonly orderNumber = '.order-number';

  constructor(page: Page) { this.page = page; }

  async expectOrderConfirmation() {
    // Verify we reached confirmation and order number is displayed
    await expect(this.page.locator(this.heading)).toHaveText(/Order Confirmation/i);
    await expect(this.page.locator(this.orderNumber)).toBeVisible();
  }
}
