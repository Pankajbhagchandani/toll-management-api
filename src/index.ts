import { Browserbase } from "@browserbasehq/sdk";
import { chromium } from "playwright";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const API_KEY = process.env.BROWSERBASE_API_KEY || "";
const PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID || "";
const LOGIN_EMAIL = process.env.LOGIN_EMAIL || "";
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || "";

if (!API_KEY || !PROJECT_ID || !LOGIN_EMAIL || !LOGIN_PASSWORD) {
  throw new Error(
    "Missing required environment variables: BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, LOGIN_EMAIL, LOGIN_PASSWORD"
  );
}

async function scrapeRentaaData() {
  const browserbase = new Browserbase({ apiKey: API_KEY });

  let sessionId: string | null = null;

  try {
    // Create a Browserbase session
    console.log("Creating Browserbase session...");
    const session = await browserbase.sessions.create({
      projectId: PROJECT_ID || "",
      browserSettings: {
    // Standard on Developer, Hobby, and Startup plans
        solveCaptchas: true
  }
    });
    sessionId = session.id;
    console.log(`Session created: ${sessionId}`);

    // Get the WebSocket URL for Playwright connection
    console.log("Connecting to browser...");
    const browserWSEndpoint = session.connectUrl;

    // Connect with Playwright - connectOverCDP returns a Browser instance
    const browser = await chromium.connectOverCDP(browserWSEndpoint);
    const defaultContext = browser.contexts()[0];
    const page = defaultContext.pages()[0];

    // Navigate to login page
    console.log("Navigating to login page...");
    await page.goto("https://www.i.starr365.com/", { waitUntil: "networkidle" });

    // Wait a bit for page to fully load
    await page.waitForTimeout(2000);

    // Try to login
    console.log("Attempting to login...");

    try {
      // Fill email
      console.log("Entering email...");
      const emailSelectors = [
        'input[type="email"]',
        'input[name*="email" i]',
        'input[id*="email" i]',
      ];

      let emailFilled = false;
      for (const selector of emailSelectors) {
        try {
          const emailInput = await page.$(selector);
          if (emailInput) {
            await page.fill(selector, LOGIN_EMAIL);
            console.log(`Email filled using selector: ${selector}`);
            emailFilled = true;
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (!emailFilled) {
        console.log("Could not find email field");
      }

      await page.waitForTimeout(500);

      // Fill password
      console.log("Entering password...");
      const passwordSelectors = [
        'input[type="password"]',
        'input[name*="pass" i]',
        'input[id*="pass" i]',
      ];

      let passwordFilled = false;
      for (const selector of passwordSelectors) {
        try {
          const passwordInput = await page.$(selector);
          if (passwordInput) {
            await page.fill(selector, LOGIN_PASSWORD);
            console.log(`Password filled using selector: ${selector}`);
            passwordFilled = true;
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (!passwordFilled) {
        console.log("Could not find password field");
      }

      // Click submit button
      console.log("Clicking login button...");
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Login")',
        'button:has-text("Sign In")',
      ];

    await page.waitForFunction(() => {
    const el: any = document.getElementById('g-recaptcha-response') || 
    document.querySelector('[name="g-recaptcha-response"]');
    return el && el.value && el.value.length > 0;
    }, { timeout: 120000 }); // Wait up to 2 minutes for CAPTCHA to be solved});

      let submitted = false;
      for (const selector of submitSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await page.click(selector);
            console.log(`Login button clicked using selector: ${selector}`);
            submitted = true;
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (!submitted) {
        console.log("Could not find submit button");
      }

      // Wait for navigation/login
      await page.waitForTimeout(3000);
    } catch (error) {
      console.error("Login error:", error);
    }

    // Navigate to rental listings page
    console.log("Navigating to rental listings page...");
    await page.goto(
      "https://www.i.starr365.com/book/rental/index-list.php?d=1",
      { waitUntil: "networkidle" }
    );

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Scroll to trigger lazy loading
    console.log("Scrolling to load content...");
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(1000);
    }

    // Take a screenshot
    console.log("Capturing screenshot...");
    await page.screenshot({ path: `screenshot-${Date.now()}.png` });
    console.log("Screenshot saved");

    // Extract page content
    console.log("Extracting rental data...");
    const htmlContent = await page.content();
    const pageTitle = await page.title();

    console.log(`\nPage Title: ${pageTitle}`);
    console.log(`Page URL: ${page.url()}`);

    // Extract text content for analysis
    const textContent = await page.evaluate(() => {
      return document.body.innerText;
    });

    console.log("\n=== PAGE TEXT CONTENT ===");
    console.log(textContent.substring(0, 1000)); // First 1000 chars

    // Try to extract rental data
    const rentalData = await page.evaluate(() => {
      const listings: Record<string, unknown>[] = [];

      // Look for common rental item patterns
      const items = document.querySelectorAll("[class*='rental'], [class*='listing'], [class*='item']");

      items.forEach((item) => {
        listings.push({
          text: item.textContent?.substring(0, 200),
          classes: (item as HTMLElement).className,
        });
      });

      return listings;
    });

    console.log("\n=== EXTRACTED RENTAL DATA ===");
    console.log(JSON.stringify(rentalData.slice(0, 5), null, 2));
    console.log(`Total items found: ${rentalData.length}`);

    await defaultContext.close();

    return {
      success: true,
      pageTitle,
      pageUrl: page.url(),
      numListings: rentalData.length,
      listings: rentalData,
    };
  } catch (error) {
    console.error("Error during scraping:", error);
    throw error;
  } finally {
    // Release Browserbase session
    if (sessionId) {
      try {
        console.log("Releasing Browserbase session...");
        // Sessions are automatically cleaned up, but you can explicitly delete if needed
        // await browserbase.sessions.delete(sessionId);
        console.log("Session cleanup completed");
      } catch (e) {
        console.error("Error releasing session:", e);
      }
    }

    // Context and page cleanup happens automatically
  }
}

// Run the scraper
scrapeRentaaData()
  .then((result) => {
    console.log("\nScraping completed successfully!");
    console.log("\nResult Summary:");
    console.log(
      JSON.stringify(
        {
          success: result.success,
          pageTitle: result.pageTitle,
          pageUrl: result.pageUrl,
          numListings: result.numListings,
        },
        null,
        2
      )
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
