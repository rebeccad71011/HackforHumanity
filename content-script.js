// content-script.js

// A simple cache to store alt text for already processed images.
// Key: image URL
// Value: generated alt text
const altTextCache = {};

/**
 * Sends a message to the background script to capture a screenshot of the given image URL,
 * returning a base64-encoded string.
 *
 * @param {string} imageUrl - The URL of the image to be captured.
 * @returns {Promise<string>} - A promise that resolves with the base64-encoded data of the image.
 */
async function getBase64(imageUrl) {
  try {
    const dataURL = await browser.runtime.sendMessage({
      command: 'captureTab',
      imageURL: imageUrl
    });
    return dataURL;
  } catch (err) {
    console.error("Error capturing screenshot:", err);
    throw err; // Re-throw the error to propagate it.
  }
}

/**
 * Generates an alt text (description) for the given image element using the Gemini API.
 *
 * @param {HTMLImageElement} imageElem - The image element for which to generate alt text.
 * @returns {Promise<string|null>} - A promise that resolves to the generated alt text, or null if unsuccessful.
 */
async function generateAltTextForImage(imageElem) {
  if (!imageElem || !imageElem.src) {
    throw new Error("No image src found.");
  }

  const imageUrl = imageElem.src;
  console.log("Image URL:", imageUrl);

  // Check the cache first. If we've already processed this image, return the cached alt text.
  if (altTextCache[imageUrl]) {
    console.log("Using cached alt text for image:", imageUrl);
    return altTextCache[imageUrl];
  }

  // Ensure the image URL is valid (either http(s) or data URL)
  if (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:")) {
    console.warn("Unsupported image source:", imageUrl);
    return null;
  }

  // Get base64 representation of the image
  const base64data = await getBase64(imageUrl);
  console.log("Base64 data for the image retrieved.");

  // Construct the Gemini API payload.
  const payload = {
    contents: [
      {
        parts: [
          { text: "Describe this image in detail" },
          {
            inline_data: {
              mime_type: "image/jpeg", // Or appropriate mime type for the image
              data: base64data
            }
          }
        ]
      }
    ]
  };

  console.log("Payload:", payload);

  // Make the request to Gemini API via background script
  const response = await browser.runtime.sendMessage({
    command: 'makeGeminiRequest',
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyCaQohZfj9uwjlJP88TAk-5FmerpKpOEw4",
    payload: payload
  });

  console.log("Response from Gemini:", response);

  // Handle response errors
  if (!response.success) {
    throw new Error(`Gemini call failed: ${response.error}`);
  }

  // Extract the generated caption (alt text) from the response
  const data = response.data;
  const altText = data.candidates[0]?.content.parts[0]?.text.trim() || "";

  // Cache the result
  altTextCache[imageUrl] = altText;

  console.log("Generated Alt Text:", altText);
  return altText;
}

// Variables to track the currently hovered image and the timer.
let hoverTimer = null;
let currentImage = null;

/**
 * Event handler for mouse movements. Checks if the pointer is over an <img> element,
 * and if so, starts a timer to generate alt text for that image if hovered long enough.
 */
document.addEventListener("mousemove", (event) => {
  const element = document.elementFromPoint(event.clientX, event.clientY);

  // Check if the element under the pointer is an image
  if (element && element.tagName.toLowerCase() === "img") {
    // If this is a new image (pointer moved from a previous image or to a new one)
    if (currentImage !== element) {
      // Clear any existing timer
      if (hoverTimer) {
        clearTimeout(hoverTimer);
      }

      currentImage = element;
      // Start a new timer for 1.5 seconds
      hoverTimer = setTimeout(async () => {
        try {
          // Generate alt text for the image if the pointer remains for 1.5 seconds
          const altText = await generateAltTextForImage(currentImage);
          if (altText) {
            // Option 1: Apply the generated alt text to the image's alt attribute
            currentImage.alt = altText;
            console.log("Applied alt text:", altText);

            // Option 2: Alternatively, display it via a tooltip or send it to a popup, e.g.:
            // displayTooltip(currentImage, altText);
          }
        } catch (error) {
          console.error("Error generating or applying alt text:", error);
        }
      }, 1500);
    }
  } else {
    // If not hovering over an image, clear any pending timer
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    currentImage = null;
  }
});
