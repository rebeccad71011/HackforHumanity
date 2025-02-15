function updateResults(results) {
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    if (results && results.length > 0) {
      statusDiv.textContent = `Found ${results.length} accessibility issue(s):`;
      resultsDiv.innerHTML = results.map(issue => {
        return `<div class="issue">
          <strong>${issue.id}</strong>: ${issue.description}<br>
          <a href="${issue.helpUrl}" target="_blank">Learn More</a>
        </div>`;
      }).join('');
    } else {
      statusDiv.textContent = "No accessibility issues found!";
      resultsDiv.innerHTML = "";
    }
  }
  
  // Listen for update messages from the background script.
  browser.runtime.onMessage.addListener((message) => {
    if (message.command === "update-results") {
      updateResults(message.results);
    }
  });
  
  // Request the latest results on load (in case the scan finished before the popup loaded).
  browser.runtime.sendMessage({ command: "get-results" }).then(response => {
    if (response && response.results) {
      updateResults(response.results);
    }
  });
  