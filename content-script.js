// content-script.js
// Create a promise that resolves when window loads
const loadPromise = new Promise(resolve => {
    window.addEventListener('load', resolve);
});

// Create a promise that resolves after 10 seconds
const timeoutPromise = new Promise(resolve => {
    setTimeout(resolve, 10000);
});

// Use Promise.race to execute whichever happens first
Promise.race([loadPromise, timeoutPromise]).then(() => {
    // Notify the background script that scanning is starting.
    browser.runtime.sendMessage({ command: "start-scan" });
  
    // Wait briefly to allow any UI (e.g. popup) to open.
    setTimeout(() => {
      axe.run(document, {}, (err, results) => {
        if (err) {
          console.error('Axe error:', err);
          return;
        }
        // Send the list of violations to the background script.
        browser.runtime.sendMessage({ command: "scan-results", results: results.violations });
      });
    }, 500);
});
  
  // Listen for fix instructions from the background script.
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === "apply-fix") {
      const { target, altText, type } = message;
      const element = document.querySelector(target);
      if (element) {
        if (type === 'alt-text') {
          // For image alt text fixes, update the alt attribute
          element.setAttribute('alt', altText);
          console.log(`Updated alt text for ${target} with: ${fixedHtml}`);
        } else {
          // For other fixes, update the entire HTML
          let cleanHtml = fixedHtml.replace(/^```html\s*|\s*```$/g, '').trim();
          element.outerHTML = cleanHtml;
          console.log(`Updated element ${target} with: ${cleanHtml}`);
        }
      } else {
        console.warn("Element not found for target:", target);
      }
    }
  });
  