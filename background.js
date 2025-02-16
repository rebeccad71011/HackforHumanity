let popupWindowId = null;
let latestResults = null;

function openPopup() {
  if (popupWindowId !== null) {
    // Check if the popup window still exists
    browser.windows.get(popupWindowId).catch(() => {
      // Window no longer exists – create a new one
      createPopup();
    });
  } else {
    createPopup();
  }
}

function createPopup() {
  browser.windows.create({
    url: browser.runtime.getURL("popup.html"),
    type: "popup",
    width: 400,
    height: 600
  }).then((windowInfo) => {
    popupWindowId = windowInfo.id;
  });
}

function getPage() {
    return browser.tabs.query({windowType: 'normal', active: true})
      .then((tabs) => {
        return tabs[0].url;
    });
}

async function generateAltTextFromImage(violation) {
  try {
    // Create a temporary DOM element to parse the violation HTML and extract the <img> element.
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = violation.nodes[0].html;
    const imgElem = tempDiv.querySelector('img');
    if (!imgElem || !imgElem.src) {
      throw new Error("No image src found in violation HTML.");
    }
    
    let imageUrl = imgElem.src;
    
    if (!imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
        
        return null;
        
    }

    // Fetch the image as a blob.
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      throw new Error("Failed to fetch image: " + imageResponse.status);
    }
    const blob = await imageResponse.blob();

    // Convert the blob to a base64 string.
    const base64data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Error reading blob as base64."));
      reader.onload = () => {
        // Data URL format: "data:[<mediatype>][;base64],<data>"
        const dataUrl = reader.result;
        const base64String = dataUrl.split(',')[1];
        resolve(base64String);
      };
      reader.readAsDataURL(blob);
    });

    // Construct the Gemini vision API payload.
    const payload = {
      contents: [{
        parts: [
          { "text": "Caption this image." },
          {
            inline_data: {
              mime_type: blob.type, // e.g., "image/jpeg"
              data: base64data
            }
          }
        ]
      }]
    };
    console.log(payload);

    // Replace <YOUR_API_KEY> with your actual Gemini API key.
    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyCaQohZfj9uwjlJP88TAk-5FmerpKpOEw4";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini call failed: ${errorText}`);
    }

    const data = await response.json();
    // Extract and trim the generated caption (alt text) from the response.
    const altText = data.candidates[0].content.parts[0].text.trim();
    console.log(altText)
    return altText;
  } catch (error) {
    console.error("Error generating alt text from image:", error);
    return null;
  }
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === "start-scan") {
    // Open the popup automatically when scanning starts.
    openPopup();
  } else if (message.command === "scan-results") {
    latestResults = message.results;
    // Forward the scan results to the popup for display.
    browser.runtime.sendMessage({ command: "update-results", results: latestResults });

    // Process only image alt-text violations.
    if (sender.tab && message.results) {
      message.results.forEach(async (violation) => {
        if (violation.id === "image-alt") {
          const altText = await generateAltTextFromImage(violation);
          
          if (altText) {
            // Use the first target selector from the violation to update the DOM.
            const targetSelector = violation.nodes[0].target?.[0];
            if (targetSelector) {
              browser.tabs.sendMessage(sender.tab.id, {
                command: "apply-fix",
                type: "alt-text",
                target: targetSelector,
                altText: altText
              });
            } else {
              console.warn("No target selector found for violation", violation);
            }
          }
        }
        else {
            console.log(violation)
        }
      });
    }
    sendResponse({ status: "Processed violations" });
    return true; // Keep the message channel open for async responses.
  } else if (message.command === "get-results") {
    sendResponse({ results: latestResults });
  }
});
