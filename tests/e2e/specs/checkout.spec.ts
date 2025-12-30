import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ProductPage } from '../pages/ProductPage';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { OrderConfirmationPage } from '../pages/OrderConfirmationPage';
import { uniqueEmail } from '../utils';

test.describe('User Checkout Process', () => {
  test('Happy path: login → search → add → checkout → confirm', async ({ page }) => {
    const login = new LoginPage(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);
    const checkout = new CheckoutPage(page);
    const confirm = new OrderConfirmationPage(page);

    const testEmail = uniqueEmail();
    const testPassword = 'Password123!';

    // PRE: register or ensure test account exists - for demo we assume it exists or we call API
    await login.goto();
    await login.login(testEmail, testPassword);
    await login.expectLoginSuccess(); // ensures session established

    // Step 2: Search and add product
    await product.searchAndOpen('test product');
    await product.addToCart();

    // Step 3: Verify cart and proceed
    await cart.goto();
    await cart.expectItemInCart(); // assert product exists in cart
    await cart.proceedToCheckout();

    // Step 3: Enter payment (valid)
    await checkout.fillPayment({ number: '4242424242424242', expiry: '12/30', cvc: '123' });
    await checkout.submitPayment();

    // Step 4: Verify confirmation
    await confirm.expectOrderConfirmation(); // ensures order completed
  });

  test('Edge case: empty payment fields show validation errors', async ({ page }) => {
    const login = new LoginPage(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);
    const checkout = new CheckoutPage(page);

    await login.goto();
    await login.login('existing@test.com', 'Password123!');
    await login.expectLoginSuccess();

    await product.searchAndOpen('test product');
    await product.addToCart();

    await cart.goto();
    await cart.proceedToCheckout();

    // No payment data filled
    await checkout.submitPayment();

    // Expect validation messages for required fields
    await checkout.expectValidationErrorFor('Card number is required');
  });

  test('Edge case: invalid card number shows payment error', async ({ page }) => {
    const login = new LoginPage(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);
    const checkout = new CheckoutPage(page);

    await login.goto();
    await login.login('existing@test.com', 'Password123!');
    await login.expectLoginSuccess();

    await product.searchAndOpen('test product');
    await product.addToCart();

    await cart.goto();
    await cart.proceedToCheckout();

    // Fill invalid card number
    await checkout.fillPayment({ number: '1111111111111111', expiry: '01/20', cvc: '000' });
    await checkout.submitPayment();

    // Expect a visible payment error from the system
    await checkout.expectPaymentFailure('Your card was declined');
  });

  test('Error handling: simulate payment API failure (500)', async ({ page }) => {
    // Intercept payment API call and return 500
    await page.route('**/api/payment', route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) })
    );

    const login = new LoginPage(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);
    const checkout = new CheckoutPage(page);

    await login.goto();
    await login.login('existing@test.com', 'Password123!');
    await login.expectLoginSuccess();

    await product.searchAndOpen('test product');
    await product.addToCart();

    await cart.goto();
    await cart.proceedToCheckout();

    await checkout.fillPayment({ number: '4242424242424242', expiry: '12/30', cvc: '123' });
    await checkout.submitPayment();

    // App should show a user-friendly error message on server failure
    await checkout.expectPaymentFailure('Payment service temporarily unavailable');
  });

  test('Error handling: out-of-stock during checkout', async ({ page }) => {
    // Simulate out-of-stock response for checkout
    await page.route('**/api/checkout', route =>
      route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'out_of_stock' }) })
    );

    const login = new LoginPage(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);
    const checkout = new CheckoutPage(page);

    await login.goto();
    await login.login('existing@test.com', 'Password123!');
    await login.expectLoginSuccess();

    await product.searchAndOpen('limited product');
    await product.addToCart();

    await cart.goto();
    await cart.proceedToCheckout();

    await checkout.fillPayment({ number: '4242424242424242', expiry: '12/30', cvc: '123' });
    await checkout.submitPayment();

    // App should show out-of-stock error and not navigate to confirmation
    await checkout.expectPaymentFailure('One or more items in your cart are out of stock');
  });

  test('Session timeout: user session expires mid-flow', async ({ page }) => {
    const login = new LoginPage(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);

    await login.goto();
    await login.login('existing@test.com', 'Password123!');
    await login.expectLoginSuccess();

    await product.searchAndOpen('test product');
    await product.addToCart();

    await cart.goto();
    await cart.expectItemInCart();

    // Simulate session expiry by clearing cookies & local storage
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Attempt to proceed should redirect to login or show session expired
    await cart.proceedToCheckout();
    // Expect to be redirected to login or see session expired message
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.session-expired')).toBeVisible();
  });
});
