const { firefox } = require('playwright');

(async () => {
    const browser = await firefox.launch({
        headless: false,
        slowMo: 100
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    const checkoutUrl = process.argv[2];

    if (!checkoutUrl) {
        console.error("No URL provided!");
        process.exit(1);
    }

    try {
        console.log("Opening checkout...");
        await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded' });

        // Ensure UI is stable
        await page.waitForLoadState('networkidle');

        // -------------------------------
        // 1. Select Card payment method
        // -------------------------------
        console.log("Selecting card payment...");
        const cardOption = page.getByText('Card', { exact: true });
        if (await cardOption.isVisible()) {
            await cardOption.click();
        }

        // Small delay to allow Stripe to render fields
        await page.waitForTimeout(1500);

        // -------------------------------
        // 2. Wait for Stripe iframes
        // -------------------------------
        console.log("Waiting for Stripe iframes...");
        await page.waitForSelector('iframe', { timeout: 15000 });

        // -------------------------------
        // 3. Fill card fields (robust method)
        // -------------------------------
        console.log("Filling card details...");

        const frames = page.frames();

        let filledCard = false;
        let filledExp = false;
        let filledCvc = false;

        for (const frame of frames) {
            try {
                // Card number
                const card = frame.locator('input[name="cardnumber"]');
                if (!filledCard && await card.count()) {
                    await card.fill('4242424242424242');
                    filledCard = true;
                    console.log("✔ Card number filled");
                }

                // Expiry
                const exp = frame.locator('input[name="exp-date"]');
                if (!filledExp && await exp.count()) {
                    await exp.fill('12 / 28');
                    filledExp = true;
                    console.log("✔ Expiry filled");
                }

                // CVC
                const cvc = frame.locator('input[name="cvc"]');
                if (!filledCvc && await cvc.count()) {
                    await cvc.fill('123');
                    filledCvc = true;
                    console.log("✔ CVC filled");
                }

            } catch (e) {
                // Ignore frame access errors (cross-origin timing)
            }
        }

        // Safety check
        if (!filledCard || !filledExp || !filledCvc) {
            throw new Error("Failed to locate Stripe card fields.");
        }

        // -------------------------------
        // 4. Fill billing details
        // -------------------------------
        console.log("Filling billing details...");

        const nameField = page.locator('#billingName');
        if (await nameField.isVisible()) {
            await nameField.fill('Test Guest');
        }

        const countrySelect = page.locator('#billingCountry');
        if (await countrySelect.isVisible()) {
            await countrySelect.selectOption('AT');
        }

        // -------------------------------
        // 5. Submit payment
        // -------------------------------
        console.log("Submitting payment...");

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
            page.locator('button[type="submit"]').click()
        ]);

        console.log("✅ Payment flow completed");

    } catch (err) {
        console.error("❌ Automation Error:", err.message);

        // Debug screenshot
        await page.screenshot({ path: 'error.png', fullPage: true });

        process.exit(1);
    } finally {
        await new Promise(resolve => setTimeout(resolve, 3000));
        await browser.close();
    }
})();