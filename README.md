# NovelReader 📖

NovelReader is a lightweight, privacy-first, zero-dependency web e-reader designed for distraction-free reading. It compiles into a single, self-contained HTML file that operates entirely client-side, making it highly portable, offline-native, and immune to server tracking or database vulnerabilities. Note: Vibecoded.

I made this application mainly because I read a lot online, and a lot of sites just don't look great, they are heavily limited in customization and use bad fonts for reading. Therefore I made this application to mitigate this issue, I copy the text from these bad sites, a whole chapter for example, and then paste it in here, to then read at this beautiful NovelReader.

---

## Key Features

*   **Privacy-First & Offline-Native:** 100% client-side processing. Your reading text and configurations never leave your browser and are stored securely in local browser storage.
*   **Self-Contained "Save as File" Compiler:** Export what you are reading (complete with your active visual configurations and layout) as a standalone HTML file. The recipient can double-click this file to instantly launch into reading mode—no databases, servers, or external integrations required.
*   **Procedural Aurora Background 🌌:** An organic, animated canvas backdrop that dynamically syncs colors with your active reading theme using CSS custom properties.
*   **Advanced Typography:** Access to curated serif typefaces (Source Serif 4, Lora, EB Garamond, Literata, Crimson Pro, Cormorant Garamond) with optical-size support and traditional layouts (first-paragraph drop caps).
*   **Direct Local Format Parsing:** Direct client-side parsing of EPUB files (extracting the reading spine and decompressing ZIP/XML archives natively), Markdown, and plain text.
*   **Two Reading Modes:** Switch between traditional continuous vertical scrolling and height-calculated horizontal pagination.

---

## File Structure

```text
NovelReader/
├── .gitignore
├── build.js            # Node build pipeline (concatenation & injection)
├── index.html          # Compiled production build (Main application entry)
└── src/
    ├── index.html      # Raw HTML template
    ├── css/
    │   ├── base.css
    │   ├── landing.css
    │   ├── reader.css
    │   ├── themes.css
    │   └── ui.css
    └── js/
        ├── App.js           # Core state controller & export mechanics
        ├── CanvasAurora.js  # Animated background loop
        ├── FileParser.js    # Local file readers (.txt, .md, .epub)
        ├── Pagination.js    # Flow layouts & height-based pagination
        ├── Utils.js         # Common helpers (storage, modals, calculations)
        └── init.js          # DOM entry point
```

---

## Getting Started 🕯️

### Prerequisites
*   [Node.js](https://nodejs.org/) (installed locally for compilation)

### Compilation (Local Development)
The files inside the `src/` directory must be compiled into the single production file. To build the application:

1. Open your terminal in the project root directory.
2. Run the build script:
   ```bash
   node build.js
   ```
3. This generates a compiled, fully optimized `index.html` file directly inside the project root directory.

### Running the Application
Simply double-click the compiled `index.html` file in your project root folder to run it locally in any modern web browser, or host the file on any static hosting provider.

---

## The Standalone Sharing Mechanic 💾

NovelReader includes a custom compiler module that packages your current book and active layout choices (theme, font, margins) into a separate, lightweight HTML file.

1. While reading a book, open the **Reading Settings** panel (gear icon).
2. Click **Save as File**.
3. Name your file in the modal and click **Download**.
4. The generated `.html` file is fully independent. You can share this file via messaging apps (Discord, WhatsApp, email). When the recipient opens the file:
    *   It bypasses the dashboard and opens directly at the top of the text, or at page 1 if Page Mode is enabled.
    *   It applies your shared visual settings (unless they have pre-configured local settings saved, which are preserved).
    *   If they click **Exit**, the file reverts back to a fully functional blank reader where they can upload their own books.

### How it operates under the hood:
The export uses a hybrid compilation engine inside `App.js`:
*   **On the Web:** It fetches the pristine source HTML code of your repository to use as a clean blueprint, injects the compressed book text and layout settings inside a `<script>` payload inside the `<head>`, and triggers a local download.
*   **Offline/Local Fallback:** If you are offline or running the app from a local `file://` protocol (where browsers block raw template fetching due to CORS security rules), the engine dynamically clones, sanitizes, and packages the active running DOM structure directly in memory without requiring network requests.
