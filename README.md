# Toll Management API

A powerful API for extracting and managing toll invoice information using AI-powered vision capabilities. Automatically extract key fields like invoice numbers, license plate numbers, amount due, and more from invoice images.

## Prerequisites

- Node.js 16+ and npm
- Browserbase account with API key and project ID
- Valid Rentaa login credentials

## Installation

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Install Playwright browsers:**
   ```bash
   npm run install:browsers
   ```
   Or manually:
   ```bash
   npx playwright install chromium
   ```

3. **Create your .env file:**
   ```bash
   cp .env.example .env
   ```

4. **Update the .env file with your credentials:**
   - Get your API key from [Browserbase Dashboard](https://www.browserbase.com/dashboard)
   - Get your Project ID from the same dashboard
   - Add your Rentaa login credentials

   Example:
   ```
   BROWSERBASE_API_KEY=your_api_key_here
   BROWSERBASE_PROJECT_ID=your_project_id_here
   LOGIN_EMAIL=your_email@example.com
   LOGIN_PASSWORD=your_password_here
   ```

## Running the Script

### Development mode (with ts-node):
```bash
npm run dev
```

### Production mode (compiled JavaScript):
```bash
npm run build
npm start
```

## How It Works

The script uses:
1. **Browserbase** - for creating remote browser sessions with real-world browser behavior
2. **Playwright** - for controlling the browser and interacting with web elements
3. **CDP (Chrome DevTools Protocol)** - for low-level browser communication

Flow:
```
Browserbase Session Created
       ↓
Playwright connects via CDP WebSocket
       ↓
Navigate to Rentaa login page
       ↓
Fill in credentials with fallback selectors
       ↓
Navigate to listings page
       ↓
Scroll & extract rental data
       ↓
Save results & screenshots
       ↓
Release session
```

## What the Script Does

Uses Playwright with Browserbase WebSocket connection:
1. Creates a Browserbase session
2. Connects to the session using Playwright's CDP connection
3. Navigates to the Rentaa login page (https://www.i.starr365.com/)
4. Fills in and submits login credentials with multiple selector strategies
5. Waits for authentication
6. Navigates to the rental listings page (https://www.i.starr365.com/book/rental/index-list.php?d=1)
7. Scrolls to trigger lazy loading
8. Extracts and parses rental data from the page
9. Captures screenshots and saves results
10. Releases the Browserbase session

## Output

The script will:
- Log the session creation and navigation steps with progress indicators
- Display extracted page title and URL
- Parse and extract rental data from the page
- Capture a screenshot of the final page state
- Display results in the console
- Show total number of items found

Generated files:
- `screenshot-{timestamp}.png` - Screenshot of the rental listings page

## Troubleshooting

- **Missing environment variables:** Ensure all variables in `.env` are properly set
- **Login fails:** Check that credentials are correct and the login form selectors match the actual page structure
- **No data extracted:** Adjust the CSS selectors in the script based on the actual page HTML structure
- **Session timeout:** Increase the timeout values if pages need more time to load

## Notes

- **Playwright Required**: Ensure Playwright browsers are installed before running (`npm run install:browsers`)
- **Selector Strategy**: The script tries multiple CSS selectors to find login form fields, making it more robust
- **Page Interaction**: Uses Playwright's native page control methods (fill, click, goto) for reliable interaction
- **Screenshot Location**: Screenshots are saved in the current working directory with timestamp
- **Error Handling**: The script continues even if some steps fail, providing detailed error messages
- **Session Management**: Always releases Browserbase sessions to avoid quota issues
- **Lazy Loading**: The script scrolls the page to trigger lazy-loaded content
- **All credentials should be in `.env` and never committed to version control**
