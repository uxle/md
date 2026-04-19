'use strict';

/* =============================================================================
   SECTION 1. CONFIGURATION & UTILITIES
   ============================================================================= */

const CONFIG = Object.freeze({
    STORAGE_KEY: 'MDFlow_content_v1',
    THEME_KEY: 'MDFlow_theme_v1',
    A4_WIDTH: 794,    // 210mm @ 96dpi
    A4_HEIGHT: 1123,  // 297mm @ 96dpi
    MIN_SCALE: 0.3,
    MAX_SCALE: 1.0,
    TOAST_DURATION: 3500,
    DEFAULT_MD: `# Welcome to MDFlow\n\nA beautiful, **real-time** Markdown to PDF builder.\n\n## Features\n\n- 🌙 **Dark/Light Mode** support.\n- 📄 **A4 Auto-Scaling** preview for perfect print alignment.\n- 💾 **Local Storage** so you never lose your work.\n- 📥 **Export to Vector PDF** with selectable text.\n\n### Code Example\n\n\`\`\`javascript\nfunction helloWorld() {\n  console.log("Selectable text is awesome!");\n}\n\`\`\`\n\n> "Simplicity is the ultimate sophistication." - Leonardo da Vinci\n\nEnjoy writing!`
});

const Utils = Object.freeze({
    /**
     * Defers execution of a function until after a specific delay.
     */
    debounce(fn, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    /**
     * Limits the execution rate of a function.
     */
    throttle(fn, limit) {
        let inThrottle = false;
        return function (...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => { inThrottle = false; }, limit);
            }
        };
    }
});

/* =============================================================================
   SECTION 2. APP CORE
   ============================================================================= */

class MDFlow {
    constructor() {
        this.cacheElements();
        
        // Fail gracefully if critical UI is missing
        if (!this.elements.editor || !this.elements.paper) {
            console.error('MDFlow: Critical DOM elements missing.');
            return;
        }

        this.state = {
            content: localStorage.getItem(CONFIG.STORAGE_KEY) || CONFIG.DEFAULT_MD,
            theme: localStorage.getItem(CONFIG.THEME_KEY) || 'dark'
        };

        this.toastTimeout = null;
        this.originalStyles = new Map(); // Cache for print restorations

        this.configureParser();
        this.init();
    }

    /**
     * Caches all DOM lookups for performance.
     */
    cacheElements() {
        const get = id => document.getElementById(id);
        const query = selector => document.querySelector(selector);
        const all = selector => document.querySelectorAll(selector);

        this.elements = {
            editor: get('md-editor'),
            preview: query('.preview'),
            paper: get('pdf-target'),
            toast: get('toast'),
            fileInput: get('file-input'),
            btnLoad: get('btn-load'),
            btnSave: get('btn-save'),
            btnTheme: get('btn-theme'),
            btnPdf: get('btn-pdf'),
            viewBtns: all('.view-btn')
        };
    }

    /**
     * Sets up the Markdown parser (marked.js) if available.
     */
    configureParser() {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false
            });
        } else {
            console.warn('MDFlow: marked.js library not found.');
        }
    }

    /* =============================================================================
       SECTION 3. INITIALIZATION & EVENTS
       ============================================================================= */

    init() {
        this.applyTheme(this.state.theme);
        this.injectPaginationStyles();
        
        // Initial state population
        this.elements.editor.value = this.state.content;
        this.renderMarkdown();
        
        // Allow the DOM to paint before calculating geometric scale
        requestAnimationFrame(() => this.scalePreview());

        this.bindEvents();
        this.setupPrintHandlers();
    }

    bindEvents() {
        const { elements } = this;

        // Editor Interactions
        elements.editor.addEventListener('input', Utils.debounce(this.handleEditorInput.bind(this), 150));
        elements.editor.addEventListener('keydown', this.handleEditorKeydown.bind(this));

        // Synchronized Scrolling logic with infinite loop prevention
        let isSyncingEditor = false;
        let isSyncingPreview = false;

        elements.editor.addEventListener('scroll', () => {
            if (!isSyncingEditor) {
                isSyncingPreview = true; // Block the preview from firing a return event
                this.syncScroll(elements.editor, elements.preview);
            }
            isSyncingEditor = false; // Reset flag
        });

        elements.preview.addEventListener('scroll', () => {
            if (!isSyncingPreview) {
                isSyncingEditor = true; // Block the editor from firing a return event
                this.syncScroll(elements.preview, elements.editor);
            }
            isSyncingPreview = false; // Reset flag
        });

        // Control Panel
        elements.btnTheme?.addEventListener('click', () => this.toggleTheme());
        elements.btnSave?.addEventListener('click', () => this.exportMarkdown());
        elements.btnLoad?.addEventListener('click', () => elements.fileInput.click());
        elements.fileInput?.addEventListener('change', this.importMarkdown.bind(this));
        elements.btnPdf?.addEventListener('click', () => this.exportPDF());

        // Mobile View Toggles
        elements.viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                if (view) this.switchView(view);
            });
        });

        // High-performance resize observation
        if (window.ResizeObserver && elements.preview) {
            const ro = new ResizeObserver(Utils.throttle(() => {
                requestAnimationFrame(() => this.scalePreview());
            }, 50));
            ro.observe(elements.preview);
        } else {
            window.addEventListener('resize', Utils.throttle(() => {
                requestAnimationFrame(() => this.scalePreview());
            }, 50));
        }
    }

    /* =============================================================================
       SECTION 4. HANDLERS
       ============================================================================= */

    handleEditorInput(e) {
        this.state.content = e.target.value;
        this.saveState();
        this.renderMarkdown();
    }

    handleEditorKeydown(e) {
        // Intercept Tab key for code/spacing support without breaking out of textarea
        if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            
            const target = e.target;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const value = target.value;
            const tabSpaces = "    ";
            
            target.value = value.substring(0, start) + tabSpaces + value.substring(end);
            target.selectionStart = target.selectionEnd = start + tabSpaces.length;
            
            this.state.content = target.value;
            this.saveState();
            this.renderMarkdown();
        }
    }

    saveState() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, this.state.content);
        } catch (e) {
            console.warn('MDFlow: Failed to save to local storage.');
        }
    }

    /**
     * Synchronizes the scroll position proportionally between two elements.
     */
    syncScroll(source, target) {
        // Calculate the maximum scrollable distance for both elements
        const sourceScrollMax = source.scrollHeight - source.clientHeight;
        const targetScrollMax = target.scrollHeight - target.clientHeight;
        
        // Prevent division by zero if an element isn't scrollable yet
        if (sourceScrollMax <= 0) return; 
        
        // Find the percentage scrolled on the source and apply it to the target
        const scrollPercentage = source.scrollTop / sourceScrollMax;
        target.scrollTop = Math.round(scrollPercentage * targetScrollMax);
    }

    /* =============================================================================
       SECTION 5. RENDERING & LAYOUT
       ============================================================================= */

    /**
     * Parses markdown and manages DOM insertion efficiently.
     */
    renderMarkdown() {
        if (typeof marked === 'undefined') {
            this.elements.paper.innerHTML = '<p style="color:red;">Error: Markdown parser failed to load.</p>';
            return;
        }

        this.elements.paper.innerHTML = marked.parse(this.state.content);
        this.scalePreview(); 
    }

    /**
     * Calculates and applies CSS transforms to scale the A4 preview 
     * seamlessly within dynamic fluid containers.
     */
    scalePreview() {
        const { preview: container, paper } = this.elements;
        if (!container || !paper || container.offsetWidth === 0) return;

        const safetyPadding = 60;
        const availableWidth = container.clientWidth - safetyPadding;
        
        // Prevent scale calculation errors if container is hidden
        if (availableWidth <= 0) return;

        const rawScale = availableWidth / CONFIG.A4_WIDTH;
        const scale = Math.min(CONFIG.MAX_SCALE, Math.max(CONFIG.MIN_SCALE, rawScale));

        paper.style.transform = `scale(${scale})`;
        
        // Re-adjust document flow height after applying scale transform
        const heightLoss = CONFIG.A4_HEIGHT * (1 - scale);
        paper.style.marginBottom = scale < 1 ? `-${heightLoss}px` : '0px';
    }

    /* =============================================================================
       SECTION 6. THEME & UI CONTROLS
       ============================================================================= */

    toggleTheme() {
        const newTheme = this.state.theme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        this.showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} Mode Enabled`);
    }

    applyTheme(theme) {
        this.state.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        
        try {
            localStorage.setItem(CONFIG.THEME_KEY, theme);
        } catch (e) {}
        
        const icon = this.elements.btnTheme?.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
    }

    switchView(mode) {
        document.body.className = `mode-${mode}`;
        
        this.elements.viewBtns.forEach(btn => {
            const isActive = btn.getAttribute('data-view') === mode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive.toString());
        });
        
        if (mode === 'preview') {
            requestAnimationFrame(() => this.scalePreview());
        }
    }

    /**
     * Intelligent Toast System preventing overlap and ensuring clean animations.
     */
    showToast(message) {
        const toast = this.elements.toast;
        if (!toast) return;

        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }
        
        toast.classList.remove('show');
        
        // Force reflow and restart animation safely
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.textContent = message;
                toast.classList.add('show');
                
                this.toastTimeout = setTimeout(() => {
                    toast.classList.remove('show');
                }, CONFIG.TOAST_DURATION);
            });
        });
    }

    /* =============================================================================
       SECTION 7. FILE I/O
       ============================================================================= */

    exportMarkdown() {
        try {
            const blob = new Blob([this.state.content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            
            anchor.href = url;
            anchor.download = `MDFlow-Doc-${new Date().toISOString().split('T')[0]}.md`;
            
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            
            // Clean up memory after a small delay to ensure browser captures it
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            this.showToast('Markdown file saved successfully');
        } catch (err) {
            console.error('Export failed:', err);
            this.showToast('Failed to save Markdown');
        }
    }

    importMarkdown(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target.result;
            this.state.content = result;
            this.elements.editor.value = result;
            
            this.saveState();
            this.renderMarkdown();
            this.showToast('Markdown loaded successfully');
            
            // Reset input so the same file can be re-loaded later if needed
            e.target.value = ''; 
        };
        
        reader.onerror = () => {
            this.showToast('Error reading file');
            e.target.value = '';
        };

        reader.readAsText(file);
    }

    /* =============================================================================
       SECTION 8. PRINT & VECTOR PDF ENGINE
       ============================================================================= */

    /**
     * Dynamically injects print-specific CSS pagination logic.
     */
    injectPaginationStyles() {
        if (document.getElementById('MDFlow-print-logic')) return;

        const style = document.createElement('style');
        style.id = 'MDFlow-print-logic';
        style.innerHTML = `
            @media print {
                #pdf-target h1, #pdf-target h2, #pdf-target h3, #pdf-target h4, #pdf-target h5 {
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    margin-top: 1.5em !important;
                }
                #pdf-target pre, #pdf-target blockquote, #pdf-target table, 
                #pdf-target tr, #pdf-target img, #pdf-target ul, #pdf-target ol, #pdf-target li {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }
                #pdf-target p {
                    orphans: 3;
                    widows: 3;
                }
                @page {
                    margin: 15mm; 
                    size: auto; 
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Overrides layout properties immediately before print invocation to guarantee 
     * proper vector stretching, eliminating CSS truncation or "half-viewable" bugs.
     */
    setupPrintHandlers() {
        const html = document.documentElement;
        const body = document.body;
        const paper = this.elements.paper;

        const beforePrint = () => {
            // Cache active styles for perfect restoration
            this.originalStyles.set(body, body.getAttribute('style') || '');
            this.originalStyles.set(html, html.getAttribute('style') || '');
            if (paper) this.originalStyles.set(paper, paper.getAttribute('style') || '');

            // Un-constrain document height/width so the browser prints multiple pages
            body.style.setProperty('overflow', 'visible', 'important');
            body.style.setProperty('height', 'auto', 'important');
            body.style.setProperty('width', '100%', 'important');
            
            html.style.setProperty('overflow', 'visible', 'important');
            html.style.setProperty('height', 'auto', 'important');
            html.style.setProperty('width', '100%', 'important');
            
            // Remove transform-based scaling to allow native print scaling
            if (paper) {
                paper.style.setProperty('transform', 'none', 'important');
                paper.style.setProperty('margin', '0', 'important');
                paper.style.setProperty('padding', '0', 'important'); 
                paper.style.setProperty('width', '100%', 'important');
                paper.style.setProperty('max-width', 'none', 'important');
                paper.style.setProperty('box-shadow', 'none', 'important');
            }
        };

        const afterPrint = () => {
            // Restore layouts
            if (this.originalStyles.has(body)) body.setAttribute('style', this.originalStyles.get(body));
            if (this.originalStyles.has(html)) html.setAttribute('style', this.originalStyles.get(html));
            if (paper && this.originalStyles.has(paper)) paper.setAttribute('style', this.originalStyles.get(paper));
            
            this.originalStyles.clear();
            
            // Re-sync preview layout after the print dialog unfreezes
            requestAnimationFrame(() => this.scalePreview());
        };

        // Standard Event Listeners
        window.addEventListener('beforeprint', beforePrint);
        window.addEventListener('afterprint', afterPrint);

        // Modern MatchMedia fallback
        if (window.matchMedia) {
            const mql = window.matchMedia('print');
            mql.addEventListener('change', (e) => {
                if (e.matches) {
                    beforePrint();
                } else {
                    afterPrint();
                }
            });
        }
    }

    /**
     * Executes native vector printing.
     */
    exportPDF() {
        this.showToast('Opening dialog. Choose "Save as PDF" for vector-perfect text!');
        
        // Force view switch on mobile devices to prevent layout clipping
        const isEditing = document.body.classList.contains('mode-edit');
        if (isEditing && window.innerWidth <= 1024) {
            this.switchView('preview');
        }

        // Delay execution to allow Toast to paint before thread halts
        setTimeout(() => {
            window.print();
        }, 750);
    }
}

/* =============================================================================
   BOOTSTRAP
   ============================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    window.MDFlowApp = new MDFlow();
});


