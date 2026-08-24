const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.resolve(__dirname, '../docs');
const OUTPUT_FILE = path.join(DOCS_DIR, 'index.html');

console.log('[BUILD-HTML] Reading markdown files from:', DOCS_DIR);

// Get list of all markdown files, sort them alphabetically
const files = fs.readdirSync(DOCS_DIR)
  .filter(file => file.endsWith('.md') && file !== 'README.md' && file !== 'index.html')
  .sort();

const docsData = {};

files.forEach(file => {
  const filePath = path.join(DOCS_DIR, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const key = file.replace('.md', '');
  
  // Extract Title (first h1)
  const titleMatch = content.match(/^#\s+(.*)$/m);
  const title = titleMatch ? titleMatch[1].trim() : key;
  
  docsData[key] = {
    filename: file,
    title: title,
    rawMarkdown: content,
    htmlContent: mdToHtml(content)
  };
});

console.log(`[BUILD-HTML] Loaded ${Object.keys(docsData).length} markdown documents.`);

// Generate categories
const categories = {
  'Overview & Lifecycle': [],
  'Feature & Module Catalog': [],
  'Architecture & Security': [],
  'Operations & Maintenance': []
};

Object.entries(docsData).forEach(([key, doc]) => {
  const index = parseInt(key.split('-')[0], 10);
  if (index >= 1 && index <= 6) {
    categories['Overview & Lifecycle'].push({ key, title: doc.title });
  } else if (index >= 7 && index <= 26) {
    categories['Feature & Module Catalog'].push({ key, title: doc.title });
  } else if (index >= 27 && index <= 37) {
    categories['Architecture & Security'].push({ key, title: doc.title });
  } else if (index >= 38 && index <= 45) {
    categories['Operations & Maintenance'].push({ key, title: doc.title });
  }
});

const htmlTemplate = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AT-BMS / HousingOS Documentation Portal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  
  <style>
    :root[data-theme="light"] {
      --bg-main: #f8fafc;
      --bg-sidebar: #ffffff;
      --bg-card: #ffffff;
      --bg-code: #f1f5f9;
      --bg-code-block: #1e293b;
      --text-main: #0f172a;
      --text-muted: #475569;
      --border-color: #e2e8f0;
      --primary: #0284c7;
      --primary-hover: #0369a1;
      --primary-rgb: 2, 132, 199;
      --sidebar-active: #f1f5f9;
      --inline-code-color: #e11d48;
      --inline-code-bg: #ffe4e6;
    }
    
    :root[data-theme="dark"] {
      --bg-main: #0b0f19;
      --bg-sidebar: #111827;
      --bg-card: #1f2937;
      --bg-code: #111827;
      --bg-code-block: #0b0f19;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --border-color: #374151;
      --primary: #38bdf8;
      --primary-hover: #7dd3fc;
      --primary-rgb: 56, 189, 248;
      --sidebar-active: #1f2937;
      --inline-code-color: #fda4af;
      --inline-code-bg: #881337;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: var(--bg-main);
      color: var(--text-main);
      display: flex;
      height: 100vh;
      overflow: hidden;
      transition: background-color 0.3s ease, color 0.3s ease;
    }

    /* Sidebar Styling */
    aside {
      width: 320px;
      background-color: var(--bg-sidebar);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      height: 100%;
      flex-shrink: 0;
      z-index: 10;
      transition: background-color 0.3s ease, border-color 0.3s ease;
    }

    .sidebar-header {
      padding: 24px;
      border-bottom: 1px solid var(--border-color);
    }

    .sidebar-header h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--primary), #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 4px;
    }

    .sidebar-header p {
      font-size: 11px;
      color: var(--text-muted);
      letter-spacing: 0.5px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .search-wrapper {
      padding: 16px 24px;
      position: relative;
    }

    .search-input {
      width: 100%;
      padding: 10px 16px 10px 38px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background-color: var(--bg-main);
      color: var(--text-main);
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .search-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.15);
    }

    .search-icon {
      position: absolute;
      left: 36px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
      width: 16px;
      height: 16px;
    }

    .sidebar-menu {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px 24px;
    }

    .menu-category {
      margin-top: 16px;
    }

    .category-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 12px 12px 6px;
    }

    .menu-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: 6px;
      color: var(--text-main);
      text-decoration: none;
      font-size: 13.5px;
      line-height: 1.4;
      cursor: pointer;
      transition: background-color 0.2s, color 0.2s;
      margin-bottom: 2px;
    }

    .menu-item:hover {
      background-color: var(--sidebar-active);
    }

    .menu-item.active {
      background-color: var(--sidebar-active);
      color: var(--primary);
      font-weight: 500;
      border-left: 3px solid var(--primary);
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }

    .menu-item-num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-muted);
      margin-right: 8px;
      width: 20px;
      display: inline-block;
      text-align: right;
    }

    /* Main Content Styling */
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    header {
      padding: 16px 40px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      align-items: center;
      background-color: var(--bg-sidebar);
      transition: background-color 0.3s ease, border-color 0.3s ease;
      height: 65px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .btn-toggle {
      background: none;
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--text-main);
      font-size: 13.5px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .btn-toggle:hover {
      background-color: var(--sidebar-active);
      border-color: var(--primary);
    }

    /* Document Container */
    .document-viewport {
      flex: 1;
      overflow-y: auto;
      padding: 48px 40px;
      display: flex;
      justify-content: center;
    }

    .document-body {
      max-width: 820px;
      width: 100%;
      animation: fadeIn 0.25s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Markdown Renders */
    .document-body h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 36px;
      font-weight: 800;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 12px;
      color: var(--text-main);
    }

    .document-body h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 24px;
      font-weight: 700;
      margin-top: 32px;
      margin-bottom: 16px;
      color: var(--text-main);
    }

    .document-body h3 {
      font-family: 'Outfit', sans-serif;
      font-size: 18px;
      font-weight: 600;
      margin-top: 24px;
      margin-bottom: 12px;
      color: var(--text-main);
    }

    .document-body p {
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 16px;
      color: var(--text-main);
    }

    .document-body ul, .document-body ol {
      margin-left: 24px;
      margin-bottom: 16px;
    }

    .document-body li {
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 6px;
      color: var(--text-main);
    }

    /* Inline Code */
    .document-body code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13.5px;
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--inline-code-color);
      background-color: var(--inline-code-bg);
    }

    /* Code Blocks */
    .document-body pre {
      background-color: var(--bg-code-block);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 20px;
      border: 1px solid var(--border-color);
      position: relative;
    }

    .document-body pre code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: #e2e8f0;
      background: none;
      padding: 0;
      border-radius: 0;
      line-height: 1.5;
    }

    /* Copy Button in Code Block */
    .btn-copy {
      position: absolute;
      right: 8px;
      top: 8px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s, background-color 0.2s;
    }

    .document-body pre:hover .btn-copy {
      opacity: 1;
    }

    .btn-copy:hover {
      background: rgba(255, 255, 255, 0.16);
    }

    /* Tables */
    .table-responsive {
      width: 100%;
      overflow-x: auto;
      margin-bottom: 24px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }

    .document-body table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      text-align: left;
    }

    .document-body th {
      background-color: var(--bg-sidebar);
      font-weight: 600;
      padding: 12px 16px;
      border-bottom: 2px solid var(--border-color);
    }

    .document-body td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
    }

    .document-body tr:last-child td {
      border-bottom: none;
    }

    .document-body tbody tr:nth-child(even) {
      background-color: rgba(var(--primary-rgb), 0.03);
    }

    .document-body tbody tr:hover {
      background-color: rgba(var(--primary-rgb), 0.06);
    }

    /* Alerts calling */
    .alert-box {
      border-left: 4px solid #ccc;
      padding: 16px;
      border-radius: 4px;
      background-color: rgba(100, 116, 139, 0.08);
      margin-bottom: 20px;
      display: flex;
      gap: 12px;
    }

    .alert-icon {
      font-size: 18px;
      flex-shrink: 0;
    }

    .alert-content {
      font-size: 14.5px;
      line-height: 1.5;
    }

    .alert-note {
      border-left-color: #0284c7;
      background-color: rgba(2, 132, 199, 0.08);
    }
    .alert-note .alert-icon::before { content: 'ℹ️'; }

    .alert-tip {
      border-left-color: #22c55e;
      background-color: rgba(34, 197, 94, 0.08);
    }
    .alert-tip .alert-icon::before { content: '💡'; }

    .alert-important {
      border-left-color: #a855f7;
      background-color: rgba(168, 85, 247, 0.08);
    }
    .alert-important .alert-icon::before { content: '📢'; }

    .alert-warning {
      border-left-color: #eab308;
      background-color: rgba(234, 179, 8, 0.08);
    }
    .alert-warning .alert-icon::before { content: '⚠️'; }

    .alert-caution {
      border-left-color: #ef4444;
      background-color: rgba(239, 68, 68, 0.08);
    }
    .alert-caution .alert-icon::before { content: '🚨'; }

    /* Next / Previous Navigator Footer */
    .doc-navigator {
      display: flex;
      justify-content: space-between;
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--border-color);
      gap: 16px;
    }

    .nav-card {
      flex: 1;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      text-decoration: none;
      color: var(--text-main);
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: all 0.2s;
      cursor: pointer;
    }

    .nav-card:hover {
      border-color: var(--primary);
      background-color: var(--sidebar-active);
    }

    .nav-card-label {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.5px;
    }

    .nav-card-title {
      font-size: 14.5px;
      font-weight: 600;
    }

    .nav-card.prev {
      align-items: flex-start;
    }

    .nav-card.next {
      align-items: flex-end;
      text-align: right;
    }

    /* Mermaid Rendering */
    .mermaid-box {
      background-color: #0f172a;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      margin-bottom: 24px;
      display: flex;
      justify-content: center;
      overflow-x: auto;
    }

    /* Custom Scrollbar */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-muted);
    }

    /* Empty Search Overlay */
    .search-empty {
      padding: 24px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13.5px;
    }

    @media (max-width: 768px) {
      body {
        flex-direction: column;
      }
      aside {
        width: 100%;
        height: auto;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
      }
      .sidebar-menu {
        max-height: 240px;
      }
      header {
        padding: 12px 20px;
      }
      .document-viewport {
        padding: 24px 20px;
      }
    }
  </style>
</head>
<body>

  <!-- Sidebar -->
  <aside>
    <div class="sidebar-header">
      <h1>HousingOS / AT-BMS</h1>
      <p>Documentation Portal</p>
    </div>
    
    <div class="search-wrapper">
      <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
      </svg>
      <input type="text" id="search-input" class="search-input" placeholder="Search documentation..." oninput="handleSearch()">
    </div>

    <div class="sidebar-menu" id="sidebar-menu">
      <!-- Generated Menu Categories -->
      ${Object.entries(categories).map(([catName, docList]) => `
        <div class="menu-category" data-category="${catName}">
          <div class="category-title">${catName}</div>
          ${docList.map(doc => {
            const num = doc.key.split('-')[0];
            const cleanTitle = doc.title;
            return `
              <a class="menu-item" id="link-${doc.key}" onclick="loadDocument('${doc.key}')">
                <span class="menu-item-num">${num}</span>
                <span class="menu-item-text">${cleanTitle}</span>
              </a>
            `;
          }).join('')}
        </div>
      `).join('')}
      <div id="search-empty" class="search-empty" style="display: none;">No documents found matching search terms.</div>
    </div>
  </aside>

  <!-- Main Viewer -->
  <main>
    <header>
      <div class="header-actions">
        <button class="btn-toggle" onclick="toggleTheme()" title="Toggle Dark/Light Mode">
          <span id="theme-icon">☀️</span>
          <span id="theme-text">Light Mode</span>
        </button>
      </div>
    </header>

    <div class="document-viewport">
      <div class="document-body" id="document-body">
        <!-- Rendered HTML Content will be inserted here -->
      </div>
    </div>
  </main>

  <!-- Embedded JSON Documents Data -->
  <script>
    const documents = ${JSON.stringify(docsData)};
    const sortedKeys = ${JSON.stringify(files.map(f => f.replace('.md', '')))};
    
    let currentTheme = 'dark';
    let activeKey = sortedKeys[0];

    // Load document content dynamically
    function loadDocument(key) {
      if (!documents[key]) return;
      activeKey = key;
      
      const doc = documents[key];
      const view = document.getElementById('document-body');
      
      // Update browser hash
      window.location.hash = 'doc-' + key;
      
      // Update sidebar highlight
      document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
      const activeLink = document.getElementById('link-' + key);
      if (activeLink) {
        activeLink.classList.add('active');
        activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }

      // Compute Nav Links
      const currentIndex = sortedKeys.indexOf(key);
      const prevKey = currentIndex > 0 ? sortedKeys[currentIndex - 1] : null;
      const nextKey = currentIndex < sortedKeys.length - 1 ? sortedKeys[currentIndex + 1] : null;

      let navHtml = '<div class="doc-navigator">';
      if (prevKey) {
        navHtml += '<a class="nav-card prev" onclick="loadDocument(\\'' + prevKey + '\\')">' +
                   '<span class="nav-card-label">← Previous</span>' +
                   '<span class="nav-card-title">' + documents[prevKey].title + '</span>' +
                   '</a>';
      } else {
        navHtml += '<div style="flex: 1"></div>';
      }
      
      if (nextKey) {
        navHtml += '<a class="nav-card next" onclick="loadDocument(\\'' + nextKey + '\\')">' +
                   '<span class="nav-card-label">Next →</span>' +
                   '<span class="nav-card-title">' + documents[nextKey].title + '</span>' +
                   '</a>';
      } else {
        navHtml += '<div style="flex: 1"></div>';
      }
      navHtml += '</div>';

      // Insert Content & scroll to top
      view.innerHTML = doc.htmlContent + navHtml;
      
      // Add copy button listeners to pre code block containers
      document.querySelectorAll('.document-body pre').forEach((preBlock) => {
        // Skip mermaid blocks
        const codeElement = preBlock.querySelector('code');
        if (codeElement && codeElement.classList.contains('language-mermaid')) {
          // Render mermaid
          const parent = preBlock.parentNode;
          const mermaidContainer = document.createElement('div');
          mermaidContainer.className = 'mermaid-box';
          
          const rawCode = codeElement.textContent;
          const uniqueId = 'mermaid-' + Math.random().toString(36).substr(2, 9);
          mermaidContainer.innerHTML = '<div class="mermaid" id="' + uniqueId + '">' + rawCode + '</div>';
          
          parent.replaceChild(mermaidContainer, preBlock);
          return;
        }

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-copy';
        copyBtn.innerText = 'Copy';
        preBlock.appendChild(copyBtn);

        copyBtn.addEventListener('click', () => {
          const codeText = preBlock.querySelector('code').innerText;
          navigator.clipboard.writeText(codeText).then(() => {
            copyBtn.innerText = 'Copied!';
            setTimeout(() => { copyBtn.innerText = 'Copy'; }, 2000);
          }).catch(err => {
            console.error('Failed to copy text', err);
          });
        });
      });

      // Render Mermaid charts if active
      if (window.mermaid) {
        try {
          window.mermaid.run();
        } catch (e) {
          console.error('[MERMAID] Failed to run diagrams:', e);
        }
      }

      document.querySelector('.document-viewport').scrollTop = 0;
    }

    // Toggle Light / Dark Mode
    function toggleTheme() {
      const root = document.documentElement;
      const icon = document.getElementById('theme-icon');
      const text = document.getElementById('theme-text');
      
      if (currentTheme === 'dark') {
        currentTheme = 'light';
        root.setAttribute('data-theme', 'light');
        icon.innerText = '🌙';
        text.innerText = 'Dark Mode';
        if (window.mermaid) {
          window.mermaid.initialize({ theme: 'default' });
        }
      } else {
        currentTheme = 'dark';
        root.setAttribute('data-theme', 'dark');
        icon.innerText = '☀️';
        text.innerText = 'Light Mode';
        if (window.mermaid) {
          window.mermaid.initialize({ theme: 'dark' });
        }
      }
      
      // Reload active document to apply updated theme configurations
      loadDocument(activeKey);
    }

    // Search bar functionality
    function handleSearch() {
      const query = document.getElementById('search-input').value.toLowerCase().trim();
      const menu = document.getElementById('sidebar-menu');
      const items = menu.querySelectorAll('.menu-item');
      const categories = menu.querySelectorAll('.menu-category');
      
      let totalFound = 0;
      
      categories.forEach(cat => {
        let catFoundCount = 0;
        const catItems = cat.querySelectorAll('.menu-item');
        
        catItems.forEach(item => {
          const text = item.querySelector('.menu-item-text').innerText.toLowerCase();
          const docKey = item.id.replace('link-', '');
          const doc = documents[docKey];
          const rawText = doc ? doc.rawMarkdown.toLowerCase() : '';
          
          if (text.includes(query) || rawText.includes(query)) {
            item.style.display = 'flex';
            catFoundCount++;
            totalFound++;
          } else {
            item.style.display = 'none';
          }
        });

        // Hide category title if no child items match
        if (catFoundCount > 0 || query === '') {
          cat.style.display = 'block';
        } else {
          cat.style.display = 'none';
        }
      });

      const emptyMsg = document.getElementById('search-empty');
      if (totalFound === 0 && query !== '') {
        emptyMsg.style.display = 'block';
      } else {
        emptyMsg.style.display = 'none';
      }
    }

    // Initialize Page
    window.addEventListener('DOMContentLoaded', () => {
      // Check for deep links
      const hash = window.location.hash;
      if (hash && hash.startsWith('#doc-')) {
        const key = hash.replace('#doc-', '');
        if (documents[key]) {
          activeKey = key;
        }
      }
      loadDocument(activeKey);
    });
  </script>

  <!-- Load Mermaid ES Module Library -->
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ 
      startOnLoad: false, 
      theme: 'dark',
      securityLevel: 'loose'
    });
    window.mermaid = mermaid;
    // Rerun diagrams once loaded
    try {
      mermaid.run();
    } catch(e){}
  </script>
</body>
</html>`;

fs.writeFileSync(OUTPUT_FILE, htmlTemplate, 'utf-8');
console.log('[BUILD-HTML] Done! Portal successfully generated at:', OUTPUT_FILE);


// Markdown Blocks Compiler Helpers
function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  let html = '';
  let inCode = false;
  let codeContent = [];
  let codeLang = '';
  let inList = false;
  let listType = ''; 
  let inTable = false;
  let tableRows = [];
  let inQuote = false;
  let quoteType = 'note';
  let quoteContent = [];

  const flushList = () => {
    if (inList) {
      html += `</${listType}>\n`;
      inList = false;
    }
  };

  const flushTable = () => {
    if (inTable) {
      if (tableRows.length > 0) {
        html += '<div class="table-responsive"><table>\n';
        let startIndex = 0;
        let hasHeaders = false;
        if (tableRows.length > 1) {
          const secondRow = tableRows[1].trim();
          if (/^\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)*\|?$/.test(secondRow)) {
            hasHeaders = true;
            startIndex = 2;
          }
        }

        if (hasHeaders) {
          html += '<thead><tr>\n';
          let splitCols = tableRows[0].split('|').map(c => c.trim());
          if (splitCols[0] === '') splitCols.shift();
          if (splitCols[splitCols.length - 1] === '') splitCols.pop();

          splitCols.forEach(col => {
            html += `<th>${inlineFormatting(col)}</th>\n`;
          });
          html += '</tr></thead>\n';
        }

        html += '<tbody>\n';
        for (let i = startIndex; i < tableRows.length; i++) {
          let splitCols = tableRows[i].split('|').map(c => c.trim());
          if (splitCols[0] === '') splitCols.shift();
          if (splitCols[splitCols.length - 1] === '') splitCols.pop();
          html += '<tr>\n';
          splitCols.forEach(col => {
            html += `<td>${inlineFormatting(col)}</td>\n`;
          });
          html += '</tr>\n';
        }
        html += '</tbody></table></div>\n';
      }
      tableRows = [];
      inTable = false;
    }
  };

  const flushQuote = () => {
    if (inQuote) {
      let quoteText = quoteContent.join('<br>');
      html += `<div class="alert-box alert-${quoteType}">
        <div class="alert-icon"></div>
        <div class="alert-content">&nbsp;${inlineFormatting(quoteText)}</div>
      </div>\n`;
      quoteContent = [];
      inQuote = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCode) {
        html += `<pre><code class="language-${codeLang}">${escapeHtml(codeContent.join('\n'))}</code></pre>\n`;
        inCode = false;
        codeContent = [];
      } else {
        flushList();
        flushTable();
        flushQuote();
        inCode = true;
        codeLang = line.trim().substring(3).trim() || 'text';
      }
      continue;
    }

    if (inCode) {
      codeContent.push(line);
      continue;
    }

    if (line.trim().startsWith('|')) {
      flushList();
      flushQuote();
      inTable = true;
      tableRows.push(line);
      continue;
    } else {
      flushTable();
    }

    if (line.trim().startsWith('#')) {
      flushList();
      flushQuote();
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        html += `<h${level} id="${id}">${inlineFormatting(text)}</h${level}>\n`;
        continue;
      }
    }

    if (line.trim().startsWith('>')) {
      flushList();
      if (!inQuote) {
        inQuote = true;
        quoteType = 'note';
        let rawContent = line.trim().substring(1).trim();
        const alertMatch = rawContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
        if (alertMatch) {
          quoteType = alertMatch[1].toLowerCase();
          rawContent = rawContent.substring(alertMatch[0].length).trim();
        }
        if (rawContent) quoteContent.push(rawContent);
      } else {
        let rawContent = line.trim().substring(1).trim();
        const alertMatch = rawContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
        if (alertMatch) {
          flushQuote();
          inQuote = true;
          quoteType = alertMatch[1].toLowerCase();
          rawContent = rawContent.substring(alertMatch[0].length).trim();
        }
        if (rawContent) quoteContent.push(rawContent);
      }
      continue;
    } else {
      flushQuote();
    }

    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      flushTable();
      flushQuote();
      const isOrdered = /^\d+/.test(listMatch[2]);
      const currentListType = isOrdered ? 'ol' : 'ul';
      const text = listMatch[3].trim();

      if (!inList || listType !== currentListType) {
        flushList();
        inList = true;
        listType = currentListType;
        html += `<${listType}>\n`;
      }
      html += `<li>${inlineFormatting(text)}</li>\n`;
      continue;
    } else {
      if (line.trim() === '') {
        flushList();
      }
    }

    if (line.trim() === '') {
      continue;
    }

    flushList();
    flushTable();
    flushQuote();
    html += `<p>${inlineFormatting(line.trim())}</p>\n`;
  }

  flushList();
  flushTable();
  flushQuote();

  return html;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inlineFormatting(text) {
  let result = escapeHtml(text);
  
  // Bold **text**
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italics *text* or _text_
  result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');
  result = result.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Inline code `code`
  result = result.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Links [text](url)
  result = result.replace(/\[(.*?)\]\((.*?)\)/g, (match, linkText, url) => {
    if (url.endsWith('.md')) {
      const docName = url.replace('.md', '');
      return `<a onclick="loadDocument('${docName}')">${linkText}</a>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
  });
  
  return result;
}
