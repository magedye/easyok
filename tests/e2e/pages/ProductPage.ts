import { Page, expect } from '@playwright/test';

export class ProductPage {
  readonly page: Page;
  readonly searchInput = 'input[aria-label="search"]';
  readonly searchResultItem = '.product-card';
  readonly addToCartBtn = '.add-to-cart';

  constructor(page: Page) { this.page = page; }

  async searchAndOpen(productName: string) {
    await this.page.fill(this.searchInput, productName);
    await this.page.press(this.searchInput, 'Enter');
    await this.page.waitForSelector(this.searchResultItem);
    // Click the first product card result
    await this.page.click(`${this.searchResultItem} >> nth=0`);
  }

  async addToCart() {
    await this.page.click(this.addToCartBtn);
    // Ensure cart success usage — the app should show visual feedback (toast or cart count)
    await expect(this.page.locator('.toast-success')).toBeVisible();
  }
}
