# Aadhaar vs Selfie - Local Face Verify

Small demo that compares two faces locally in the browser using face-api.js.

Features
- Upload two images (Aadhaar photo and a selfie).
- Models load from CDN and all processing happens locally in the browser.
- Shows "Face Matched" if similarity > 0.6, otherwise "Face Not Matched".
- Clear error messages if a face isn't detected in either image.

How to run
1. Open `index.html` in a modern desktop browser (Chrome, Edge, Firefox).
2. Wait for models to load (status shown on the page).
3. Choose the Aadhaar photo and a selfie, then click Verify.

Privacy
All images stay in your browser and are never uploaded to any server. Models are fetched from a CDN but image pixels and computed descriptors never leave your machine.

Notes
- If models fail to load, check your network or try a different CDN.
- The similarity mapping used is simple; adjust threshold or mapping if you need different sensitivity.

HEIC/HEIF images
-----------------
Many modern phones (iOS and some Androids) save photos in HEIC/HEIF format which some browsers can't decode directly. This app includes an in-browser converter (`heic2any`) that attempts to convert HEIC/HEIF images to JPEG before processing. If conversion fails, try exporting the photo as JPEG from your phone or use a different image.

Troubleshooting: models fail to load
----------------------------------
If the page shows "Error loading models" or stays stuck while trying to fetch weights from the CDN, try one of the following:

1) Serve the folder over a local HTTP server (recommended)

	Some browsers restrict fetching model files when opening an HTML file via the file:// protocol. From PowerShell run:

```pwsh
cd 'C:\Users\Haritha\OneDrive\Desktop\aadhar'
# If you have Python 3 installed
python -m http.server 8000
```

Then open http://localhost:8000 in your browser and load `index.html`.

2) Host model weights locally

	- Download the model weight files (the `*.bin` and `*.json` files) and place them in a `models` folder next to `index.html`.
	- The `script.js` is configured to try CDN locations; you can add a local path to the `MODEL_URLS` array, for example:

```js
MODEL_URLS.push('/models')
```

	- Example weights are available in the face-api.js repo under `weights/`.

	To make this easier, a PowerShell helper script `download-models.ps1` is included. From PowerShell run:

	```pwsh
	cd 'C:\Users\Haritha\OneDrive\Desktop\aadhar'
	.\download-models.ps1
	```

	This will create a `models` folder and download the typical weight files. After that, serve the folder using a local server (Python `http.server` or similar) and open the page.

3) Try a different network or CDN

	The app already tries a fallback CDN. If your environment blocks external CDNs, hosting the weights locally (step 2) is the most robust option.

