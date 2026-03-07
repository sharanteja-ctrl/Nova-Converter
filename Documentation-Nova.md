# Documentation-Nova

Point-to-point full documentation for your Nova Converter project.

## 1. Project Purpose

Nova Converter is a web app to:

1. Convert many file formats to PDF.
2. Compress PDFs to a target size (`KB` or `MB`).
3. Scan documents using camera and convert to PDF.
4. Split one PDF into multiple PDFs.
5. Run on mobile + desktop.
6. Deploy publicly (Render).

## 2. Main User Features

## 2.1 Main Converter (Home Page)

Users can:

1. Upload files by click or drag-drop.
2. Select target size in `KB` or `MB`.
3. Enable `Heavy Compression`.
4. Convert to PDF.
5. Preview PDF before download.
6. Download output.

Supported input types:

1. Office: `doc/docx/ppt/pptx/xls/xlsx/odt/odp/ods/rtf/pages/key/numbers`
2. Images: all `image/*` types
3. Text/code: `txt/md/csv/json/xml/html/css/js/ts/py/java/c/cpp/log`
4. Existing PDF (for compression path)

## 2.2 Camera Scan

Flow:

1. Click `Open Camera`.
2. Capture as many photos as needed.
3. Click `Next: Edit All` to start editing.
4. Edit controls:
   - Rotate
   - Brightness
   - Contrast
   - Sharpness
   - Filter presets (`Original`, `Black & White`, `High Contrast`, `Grayscale`, `Color Enhance`, `Scan Mode`)
5. Choose edit mode:
   - `Apply same edits to all photos` (single edit profile applied to all)
   - Unchecked mode: per-photo editing with `Done & Next`
6. Preview and `Finish`.

Retake behavior:

1. Live stage: `Retake Last` removes last captured.
2. Edit stage: `Retake This` removes selected photo and next capture replaces same slot.

## 2.3 Split PDF Tool (`/split`)

Users can:

1. Upload one PDF (max 100MB).
2. See page thumbnails.
3. Split using:
   - Every page
   - Page ranges (example: `1-3, 4-6`)
   - Extract selected pages (checkboxes)
4. Download each file individually.
5. Download all as ZIP.

Privacy behavior:

1. Generated output URLs auto-clear from browser memory after 10 minutes.

## 3. Technical Architecture

## 3.1 Frontend

Files:

1. `index.html` - main converter UI
2. `app.js` - converter + camera + compression flow logic
3. `split.html` - split page UI
4. `split.js` - split logic
5. `styles.css` - full design/responsive styles
6. `menu.js` - side menu behavior
7. `rain-bg.js` - animated background

Frontend libraries:

1. `jsPDF` (PDF generation)
2. `JSZip` (zip for multi-output)
3. `marked` (markdown text parsing)
4. `pdf-lib` (split output generation)
5. `pdf.js` (PDF thumbnail rendering)
6. `lucide` (icons)

## 3.2 Backend

File:

1. `server.js` - Express server + API routes

Uses:

1. `express`
2. `multer` (memory upload)
3. `child_process.spawn` to call system tools
4. LibreOffice (`soffice`) for Office -> PDF
5. Ghostscript (`gs`) for PDF compression

## 4. Backend API Endpoints

## 4.1 `GET /split`

1. Serves split tool page (`split.html`).

## 4.2 `GET /api/progress/:id`

1. Returns progress JSON for conversion/compression status.
2. Used by frontend loading bar polling.

Response shape:

1. `progress` (0-100)
2. `phase` (text)
3. `status` (`processing`, `done`, `error`, `fallback`, `unknown`)

## 4.3 `POST /api/convert`

1. Input: `multipart/form-data` with `file`.
2. Output: converted PDF binary.
3. Internally:
   - Saves upload to temp folder
   - Runs LibreOffice conversion
   - Returns resulting PDF
   - Deletes temp files

## 4.4 `POST /api/compress-pdf`

1. Input: `multipart/form-data`
   - `file` (PDF)
   - `targetBytes`
   - `ultraMode` (`0/1`)
2. Output: compressed PDF binary (or fallback original PDF).
3. Internally:
   - Runs Ghostscript profile passes
   - Picks best result and returns it
   - Sends fallback headers if original returned

Important current behavior:

1. Clarity-safe mode is active.
2. Hard raster branch exists in code but is currently disabled (`effectiveHardRasterMode = false`).

## 5. Conversion Decision Logic (Frontend)

Main logic is in `handleConvert()` (`app.js`):

1. Single PDF -> `/api/compress-pdf`
2. Single Office/unknown -> `/api/convert`
3. Single image -> browser-side image->PDF
4. Single text/code -> browser-side text->PDF
5. Multiple images -> single merged PDF
6. Multiple mixed files -> each converted + packed into ZIP

## 6. Progress + Loading System

1. Frontend creates progress ID.
2. Sends it in `x-progress-id` header.
3. Backend stores progress in in-memory `Map`.
4. Frontend polls `/api/progress/:id`.
5. UI loading bar moves through upload/process/download phases.

## 7. PWA / Installable App

Files:

1. `manifest.webmanifest`
2. `service-worker.js`

What it gives:

1. Install app on mobile/desktop.
2. Asset caching.
3. Faster repeat loads.

## 8. Deployment

## 8.1 Render (Blueprint)

File:

1. `render.yaml`

Behavior:

1. Creates web service `nova-converter`.
2. Installs Ghostscript + LibreOffice at build.
3. Runs `npm start`.

## 8.2 Docker

File:

1. `Dockerfile`

Behavior:

1. Uses Node 20 slim image.
2. Installs LibreOffice + Ghostscript.
3. Exposes port `8080`.

## 9. Local Setup

## 9.1 Requirements

1. Node.js
2. LibreOffice CLI (`soffice`)
3. Ghostscript (`gs`)

macOS:

```bash
brew install ghostscript libreoffice
```

Ubuntu/Debian:

```bash
sudo apt-get install -y ghostscript libreoffice libreoffice-writer libreoffice-calc libreoffice-impress
```

## 9.2 Run

```bash
cd /Users/sharanteja/Documents/doc-to-pdf-converter
npm install
npm start
```

Open:

1. `http://localhost:8080`

If port busy:

```bash
PORT=8081 npm start
```

## 10. Important Project Files (Quick Mapping)

1. `server.js` - backend APIs
2. `app.js` - main frontend logic
3. `split.js` - split logic
4. `index.html` - main page
5. `split.html` - split page
6. `styles.css` - styling
7. `menu.js` - side menu
8. `rain-bg.js` - animated background
9. `manifest.webmanifest` - app metadata
10. `service-worker.js` - caching
11. `render.yaml` - Render deployment
12. `Dockerfile` - container deployment

## 11. Known Behaviors / Limits

1. PDF exact target size is best-effort; some files cannot hit tiny targets without severe quality loss.
2. Office conversion depends on LibreOffice support for the format.
3. Compression depends on Ghostscript availability.
4. Split tool input is one PDF at a time.

## 12. Troubleshooting

## 12.1 `EADDRINUSE`

Cause:

1. Port already in use.

Fix:

1. Change port (`PORT=8081 npm start`) or stop old process.

## 12.2 Office conversion fails

Cause:

1. LibreOffice missing/not in PATH.

Fix:

1. Install LibreOffice and verify `soffice` command works.

## 12.3 PDF compression fails

Cause:

1. Ghostscript missing or conversion error on file.

Fix:

1. Install Ghostscript.
2. Try larger target size.
3. Retry with Heavy Compression.

## 12.4 Split page not generating output

Check:

1. PDF is valid and <=100MB.
2. Range syntax is valid.
3. At least one page selected in extract mode.

## 13. Your Current Public URL

1. `https://nova-converter.onrender.com`

---

This is your single complete documentation file for Nova Converter.
