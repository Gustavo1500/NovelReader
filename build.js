const fs = require('fs');
const path = require('path');

// Define file paths and correct loading order
const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

const cssFiles = [
    'themes.css',
    'base.css',
    'landing.css',
    'reader.css',
    'ui.css'
];

const jsFiles = [
    'Utils.js',
    'FileParser.js',
    'Pagination.js',
    'CanvasAurora.js',
    'App.js',
    'init.js'
];

function build() {
    console.log('Building NovelReader...');

    // 1. Ensure dist directory exists
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir);
    }

    // 2. Concatenate CSS
    let cssContent = '';
    cssFiles.forEach(file => {
        const filePath = path.join(srcDir, 'css', file);
        if (fs.existsSync(filePath)) {
            cssContent += `/* --- ${file} --- */\n`;
            cssContent += fs.readFileSync(filePath, 'utf8') + '\n\n';
        } else {
            console.warn(`Warning: Missing CSS file - ${file}`);
        }
    });

    // 3. Concatenate JS
    let jsContent = '';
    jsFiles.forEach(file => {
        const filePath = path.join(srcDir, 'js', file);
        if (fs.existsSync(filePath)) {
            jsContent += `/* --- ${file} --- */\n`;
            jsContent += fs.readFileSync(filePath, 'utf8') + '\n\n';
        } else {
            console.warn(`Warning: Missing JS file - ${file}`);
        }
    });

    // 4. Read the base HTML
    const htmlPath = path.join(srcDir, 'index.html');
    if (!fs.existsSync(htmlPath)) {
        console.error('Error: src/index.html not found!');
        return;
    }
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // 5. Inject CSS and JS
    htmlContent = htmlContent.replace(
        '<!-- INJECT_CSS -->', 
        `<style>\n${cssContent}</style>`
    );
    htmlContent = htmlContent.replace(
        '<!-- INJECT_JS -->', 
        `<script>\n${jsContent}</script>`
    );

    // 6. Output the master file
    const outputPath = path.join(distDir, 'NovelReader.html');
    fs.writeFileSync(outputPath, htmlContent);

    console.log(`Success! Master file created at: ${outputPath}`);
}

build();