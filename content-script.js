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
async function getBase64fromUrl(imageUrl) {
  try {
    const dataURL = await browser.runtime.sendMessage({
      command: 'captureTab',
      imageURL: imageUrl
    });
    return dataURL;
  } catch (err) {
    console.error("Error capturing screenshot:", err);
    throw err;
  }
}

function imageToBase64(img, mimeType = 'image/jpeg') {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL(mimeType);
    // Remove the data URL prefix to get only the base64 string.
    const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    return base64Data;
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

  if (altTextCache[imageUrl]) {
    console.log("Using cached alt text for image:", imageUrl);
    return altTextCache[imageUrl];
  }

  var base64data
    try {
        console.warn("Static image source:", imageUrl);
        base64data = await imageToBase64(imageElem);
    } catch (error1) {
        try {
            base64data = await getBase64fromUrl(imageUrl);
        } catch (error2) {
            console.error("Both image conversion methods failed:", error1, error2);
            return "Image not supported";
        }
    }
  console.log("Base64 data for the image retrieved.");

  const htmlText = document.body.innerText.slice(0, 1000); // limit to first 1000 characters

const payload = {
  contents: [
    {
      parts: [
        {
          text: `Describe this image in detail. Additionally, use the accompanying webpage context to enrich the description.
For example:
- If this is an ecommerce site, provide details about the clothing item including a summary of its price, reviews, and availability.
- If it's a restaurant page, include information about the menu, ambiance, and ratings.
- If it's a travel site, mention destination highlights, cost, and popular attractions.
- If it's an education website where visitors come to study a certain topic, incorporate details related to the subject matter. Use the surrounding text to highlight course topics, key learning objectives, curriculum insights, and any notable study tips or research details that enhance the understanding of the topic.

Please do not start with things like "Generated Alt Text:" or "Here is the description:", just give the requested output and no other text.
`
        },
        {
          text: `Additional context from the page: ${htmlText}`
        },
        {
          inline_data: {
            mime_type: "image/jpeg", // Adjust if needed.
            data: base64data
          }
        }
      ]
    }
  ]
};

  console.log("Payload:", payload);

  const response = await browser.runtime.sendMessage({
    command: 'makeGeminiRequest',
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyCaQohZfj9uwjlJP88TAk-5FmerpKpOEw4",
    payload: payload
  });

  console.log("Response from Gemini:", response);

  if (!response.success) {
    throw new Error(`Gemini call failed: ${response.error}`);
  }

  const data = response.data;
  const altText = data.candidates[0]?.content.parts[0]?.text.trim() || "";

  altTextCache[imageUrl] = altText;

  console.log( altText);
  return altText;
}

// === Create an SVG clipPath for the blur overlay === //
const svgNS = "http://www.w3.org/2000/svg";
const svgElem = document.createElementNS(svgNS, "svg");
svgElem.setAttribute("width", 0);
svgElem.setAttribute("height", 0);
svgElem.style.position = "absolute";
svgElem.style.left = "-9999px";
svgElem.style.top = "-9999px";

const clipPathElem = document.createElementNS(svgNS, "clipPath");
clipPathElem.setAttribute("id", "holeClip");
clipPathElem.setAttribute("clipPathUnits", "userSpaceOnUse");
// The clip-rule (evenodd) ensures that the second rectangle is subtracted.
clipPathElem.setAttribute("clip-rule", "evenodd");

const pathElem = document.createElementNS(svgNS, "path");
clipPathElem.appendChild(pathElem);
svgElem.appendChild(clipPathElem);
document.body.appendChild(svgElem);

// === Create a full-screen blur overlay === //
const blurOverlay = document.createElement('div');
blurOverlay.style.position = 'fixed';
blurOverlay.style.top = '0';
blurOverlay.style.left = '0';
blurOverlay.style.width = '100%';
blurOverlay.style.height = '100%';
blurOverlay.style.pointerEvents = 'none';
blurOverlay.style.zIndex = '999999';
blurOverlay.style.backdropFilter = 'blur(20px)'; // Strong blur.
blurOverlay.style.transition = 'clip-path 0.2s ease';
document.body.appendChild(blurOverlay);

/**
 * Updates the blur overlay so that the area under the hovered element is not blurred.
 * Uses the SVG clipPath (with evenodd) to subtract a rectangle corresponding to the element's bounding box.
 */
function updateBlurOverlay(hoveredElem) {
  if (hoveredElem) {
    const rect = hoveredElem.getBoundingClientRect();
    // Build a path covering the full viewport then subtracting the hovered element's rectangle.
    const d = `M0,0 H${window.innerWidth} V${window.innerHeight} H0 Z ` +
              `M${rect.left},${rect.top} H${rect.right} V${rect.bottom} H${rect.left} Z`;
    pathElem.setAttribute("d", d);
    blurOverlay.style.clipPath = "url(#holeClip)";
  } else {
    // If no element is hovered, remove the clipPath so the entire page is blurred.
    blurOverlay.style.clipPath = "none";
  }
}

// Variables for tracking hover state.
let hoverTimer = null;
let currentImage = null;

/**
 * On mouse movement:
 * - Update the blur overlay to unblur the element under the pointer.
 * - If hovering over an image for 1.5 seconds, generate alt text.
 */
document.addEventListener("mousemove", (event) => {
  const hoveredElem = document.elementFromPoint(event.clientX, event.clientY);
  updateBlurOverlay(hoveredElem);

  if (hoveredElem && hoveredElem.tagName.toLowerCase() === "img") {
    if (currentImage !== hoveredElem) {
      if (hoverTimer) clearTimeout(hoverTimer);
      currentImage = hoveredElem;
      hoverTimer = setTimeout(async () => {
        try {
          const altText = await generateAltTextForImage(currentImage);
          if (altText) {
            currentImage.alt = altText;
            console.log("Applied alt text:", altText);
          }
        } catch (error) {
          console.error("Error generating or applying alt text:", error);
        }
      }, 1500);
    }
  } else {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    currentImage = null;
  }
});

/**
 * When the pointer leaves the browser window, ensure the whole page remains blurred.
 */
window.addEventListener("mouseout", (event) => {
  // If there's no related target, the pointer has left the window.
  if (!event.relatedTarget && !event.toElement) {
    updateBlurOverlay(null);
    currentImage = null;
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  }
});
