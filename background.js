browser.runtime.onMessage.addListener(async (message, sender) => {
    if (message.command === 'captureTab') {
   

        const imageResponse = await fetch(message.imageURL)
        
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
        console.log(base64data)
        return base64data

    }


    if (message.command === 'makeGeminiRequest') {
        try {
            const response = await fetch(message.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(message.payload)
            });
            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
  
});