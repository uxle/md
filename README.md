# (MDFlow)[https://uxle.github.io/md/]: Comprehensive Test Document

Welcome to the MDFlow sample document. This file is specifically designed to test all typographic elements, layouts, and print-specific CSS rules (like smart pagination) within the MDFlow environment.

---

## 1. Typography & Inline Formatting

Here is a paragraph demonstrating various inline styles. You can use **strong/bold text**, *italicized text*, and even ~~strikethrough text~~.

We also have inline code snippets to highlight specific variables or commands, like `window.print()`.

If you need to link to external resources, you can add [hyperlinks](https://example.com) that remain clickable in the final vector PDF.

---

## 2. Lists & Hierarchies

### Unordered List

- Primary item one
- Primary item two
  - Nested item A
  - Nested item B
- Primary item three

### Ordered List

1. First step in the process
2. Second step in the process
   1. Sub-step 2.1
   2. Sub-step 2.2
3. Final step

---

## 3. Blockquotes & Callouts

Blockquotes are great for emphasizing quotes or important notes. The custom CSS gives them a distinct left border and background that will perfectly translate to the PDF.

> "The details are not the details. They make the design."  
> — Charles Eames

---

## 4. Code Blocks

Below is a JavaScript code block. When exported to PDF, the CSS `break-inside: avoid` rule guarantees that this block will never be awkwardly cut in half between two pages.

```javascript
// A simple function to generate a greeting
class VectorPDFEngine {
    constructor() {
        this.status = "Ready";
        this.quality = "Lossless";
    }

    generate() {
        console.log("Compiling high-fidelity document...");
        window.print();
    }
}

const engine = new VectorPDFEngine();
engine.generate();
````

---

## 5. Data Tables

Tables should be fully responsive and bordered cleanly. Like code blocks, they are protected from page breaks so your data remains readable.

| Feature          | Supported | Description                                        |
| ---------------- | --------- | -------------------------------------------------- |
| **Live Preview** | ✅         | Real-time Markdown rendering directly in the DOM   |
| **Dark Mode**    | ✅         | Toggleable theme interface for comfortable editing |
| **Vector PDF**   | ✅         | Uses the native browser engine for lossless text   |
| **Pagination**   | ✅         | Smart CSS to prevent elements from splitting       |

---

## 6. Images & Media

![Sample Image](https://petapixel.com/assets/uploads/2024/01/The-Star-of-System-Sol-Rectangle.jpg)

Images should scale responsively up to 100% of the container width, maintain their aspect ratio, and remain intact during PDF generation.

*Note: The image above is pulled from Unsplash. Make sure you are connected to the internet when exporting the PDF so the browser can capture the image.*

---

## Conclusion

If all elements above look perfectly formatted, your code blocks and tables aren't sliced in half across pages, and the text is fully selectable in the exported PDF...

**MDFlow is working flawlessly!**
