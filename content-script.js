window.addEventListener('load', () => {
    // Notify the background script that scanning is starting.
    browser.runtime.sendMessage({ command: "start-scan" });
  
    // Wait briefly to allow the popup to open.
    setTimeout(() => {
      axe.run(document, {}, (err, results) => {
        if (err) {
          console.error('Axe error:', err);
          return;
        }
        // Send the list of violations to the background.
        browser.runtime.sendMessage({ command: "scan-results", results: results.violations });
      });
    }, 500);
  });
  