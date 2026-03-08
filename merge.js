(() => {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }

  const MAX_FILE_BYTES = 100 * 1024 * 1024;

  const dropzone = document.getElementById("mergeDropzone");
  const fileInput = document.getElementById("mergeFileInput");
  const fileInfo = document.getElementById("mergeFileInfo");
  const fileCountEl = document.getElementById("mergeFileCount");
  const pageCountEl = document.getElementById("mergePageCount");
  const fileListEl = document.getElementById("mergeFileList");
  const mergeBtn = document.getElementById("mergeBtn");
  const mergeStatus = document.getElementById("mergeStatus");
  const mergeProcessingWrap = document.getElementById("mergeProcessingWrap");
  const mergeProgressBar = document.getElementById("mergeProgressBar");
  const mergeProgressLabel = document.getElementById("mergeProgressLabel");
  const mergeProgressPercent = document.getElementById("mergeProgressPercent");
  const mergeDownloadLink = document.getElementById("mergeDownloadLink");

  if (
    !dropzone ||
    !fileInput ||
    !fileInfo ||
    !fileCountEl ||
    !pageCountEl ||
    !fileListEl ||
    !mergeBtn ||
    !mergeStatus ||
    !mergeProcessingWrap ||
    !mergeProgressBar ||
    !mergeProgressLabel ||
    !mergeProgressPercent ||
    !mergeDownloadLink
  ) {
    return;
  }

  if (!window.PDFLib) {
    mergeStatus.textContent = "Required PDF library is missing. Refresh and try again.";
    return;
  }

  const { PDFDocument } = window.PDFLib;
  let mergeItems = [];
  let mergedOutputUrl = null;

  function setStatus(message) {
    mergeStatus.textContent = message;
  }

  function bytesToMb(size) {
    return (size / (1024 * 1024)).toFixed(2);
  }

  function sanitizeName(value) {
    return String(value || "merged")
      .replace(/[^\w.\- ]+/g, "_")
      .replace(/\s+/g, "-");
  }

  function revokeOutputUrl() {
    if (!mergedOutputUrl) return;
    URL.revokeObjectURL(mergedOutputUrl);
    mergedOutputUrl = null;
  }

  function setProgress(percent, label) {
    const bounded = Math.max(0, Math.min(100, Math.round(percent)));
    mergeProgressBar.style.width = `${bounded}%`;
    mergeProgressPercent.textContent = `${bounded}%`;
    if (label) {
      mergeProgressLabel.textContent = label;
    }
  }

  function showProcessing(show) {
    mergeProcessingWrap.classList.toggle("hidden", !show);
    if (show) {
      setProgress(0, "Preparing...");
    }
  }

  function updateCounts() {
    fileCountEl.textContent = String(mergeItems.length);
    const totalPages = mergeItems.reduce((sum, item) => sum + item.pageCount, 0);
    pageCountEl.textContent = String(totalPages);
  }

  function updateControls() {
    mergeBtn.disabled = mergeItems.length < 2;
  }

  function hideDownload() {
    revokeOutputUrl();
    mergeDownloadLink.classList.add("hidden");
    mergeDownloadLink.removeAttribute("href");
    mergeDownloadLink.removeAttribute("download");
  }

  function renderList() {
    if (!mergeItems.length) {
      fileListEl.innerHTML = '<div class="merge-empty">Upload PDFs to build merge order.</div>';
      return;
    }

    fileListEl.innerHTML = mergeItems
      .map((item, index) => {
        return `
          <div class="merge-file-row">
            <div class="merge-file-main">
              <span class="merge-file-order">${index + 1}</span>
              <div class="merge-file-copy">
                <span class="merge-file-name">${item.file.name}</span>
                <span class="merge-file-meta">${item.pageCount} pages · ${bytesToMb(item.file.size)}MB</span>
              </div>
            </div>
            <div class="merge-file-actions">
              <button class="merge-icon-btn" type="button" data-action="up" data-index="${index}" aria-label="Move up">↑</button>
              <button class="merge-icon-btn" type="button" data-action="down" data-index="${index}" aria-label="Move down">↓</button>
              <button class="merge-icon-btn remove" type="button" data-action="remove" data-index="${index}" aria-label="Remove file">✕</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function refreshUi() {
    renderList();
    updateCounts();
    updateControls();
  }

  function moveItem(fromIndex, toIndex) {
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= mergeItems.length ||
      toIndex >= mergeItems.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const [item] = mergeItems.splice(fromIndex, 1);
    mergeItems.splice(toIndex, 0, item);
    refreshUi();
  }

  async function readPdfItem(file) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`${file.name} is ${bytesToMb(file.size)}MB. Max 100MB per file.`);
    }
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      throw new Error(`${file.name} is not a PDF.`);
    }
    const buffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(buffer);
    return {
      file,
      pageCount: pdfDoc.getPageCount(),
    };
  }

  async function loadFiles(fileList, { append = true } = {}) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    hideDownload();
    if (!append) {
      mergeItems = [];
      refreshUi();
    }
    showProcessing(true);
    setStatus("Reading PDF files...");

    try {
      const loaded = [];
      const rejected = [];
      for (let i = 0; i < files.length; i += 1) {
        try {
          const item = await readPdfItem(files[i]);
          loaded.push(item);
        } catch (error) {
          rejected.push(error?.message || `${files[i]?.name || "File"} failed to load.`);
        }
        setProgress(((i + 1) / files.length) * 92, `Reading file ${i + 1}/${files.length}`);
      }

      mergeItems = append ? mergeItems.concat(loaded) : loaded;
      fileInfo.textContent = `${mergeItems.length} PDF file(s) loaded`;
      refreshUi();
      setProgress(100, "Ready");

      if (!loaded.length && rejected.length) {
        setStatus(`Load failed: ${rejected[0]}`);
      } else if (rejected.length) {
        setStatus(
          `Loaded ${loaded.length} file(s). ${rejected.length} skipped. Ready to merge.`
        );
      } else if (mergeItems.length >= 2) {
        setStatus("Ready. Adjust order and click Merge PDF.");
      } else {
        setStatus("Upload at least 2 PDFs to start merge.");
      }
    } catch (error) {
      if (!append) {
        mergeItems = [];
      }
      refreshUi();
      if (!mergeItems.length) {
        fileInfo.textContent = "Drag & drop PDFs here or click to upload";
      }
      setStatus(`Load failed: ${error.message || "Unknown error"}`);
    } finally {
      showProcessing(false);
    }
  }

  async function mergePdfFiles() {
    if (mergeItems.length < 2) {
      setStatus("Upload at least 2 PDFs.");
      return;
    }

    hideDownload();
    showProcessing(true);
    mergeBtn.disabled = true;
    setStatus("Merging PDF files...");

    try {
      const mergedDoc = await PDFDocument.create();

      for (let i = 0; i < mergeItems.length; i += 1) {
        const sourceBuffer = await mergeItems[i].file.arrayBuffer();
        const sourceDoc = await PDFDocument.load(sourceBuffer);
        const pageIndices = sourceDoc.getPageIndices();
        const copiedPages = await mergedDoc.copyPages(sourceDoc, pageIndices);
        copiedPages.forEach((page) => mergedDoc.addPage(page));
        setProgress(((i + 1) / mergeItems.length) * 90, `Merging ${i + 1}/${mergeItems.length}`);
      }

      setProgress(96, "Saving merged PDF...");
      const mergedBytes = await mergedDoc.save();
      const mergedBlob = new Blob([mergedBytes], { type: "application/pdf" });
      mergedOutputUrl = URL.createObjectURL(mergedBlob);

      const mergedName = `${sanitizeName(mergeItems[0].file.name.replace(/\.pdf$/i, ""))}-merged.pdf`;
      mergeDownloadLink.href = mergedOutputUrl;
      mergeDownloadLink.download = mergedName;
      mergeDownloadLink.classList.remove("hidden");
      setProgress(100, "Completed");
      setStatus(
        `Done: ${mergeItems.length} files merged into ${mergedDoc.getPageCount()} pages. Download is ready.`
      );
    } catch (error) {
      hideDownload();
      setStatus(`Merge failed: ${error.message || "Unknown error"}`);
    } finally {
      showProcessing(false);
      updateControls();
    }
  }

  function handleDropzoneVisual(event, isDragOver) {
    event.preventDefault();
    event.stopPropagation();
    dropzone.classList.toggle("dragover", !!isDragOver);
  }

  dropzone.addEventListener("dragenter", (event) => handleDropzoneVisual(event, true));
  dropzone.addEventListener("dragover", (event) => handleDropzoneVisual(event, true));
  dropzone.addEventListener("dragleave", (event) => handleDropzoneVisual(event, false));
  dropzone.addEventListener("drop", (event) => {
    handleDropzoneVisual(event, false);
    const files = event.dataTransfer?.files;
    if (!files?.length) return;
    loadFiles(files, { append: true });
  });

  fileInput.addEventListener("change", () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = "";
    if (!files.length) return;
    loadFiles(files, { append: true });
  });

  fileListEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute("data-action");
    const index = Number(target.getAttribute("data-index"));
    if (!action || !Number.isInteger(index)) return;

    if (action === "up") {
      moveItem(index, index - 1);
      return;
    }
    if (action === "down") {
      moveItem(index, index + 1);
      return;
    }
    if (action === "remove") {
      mergeItems.splice(index, 1);
      refreshUi();
      hideDownload();
      setStatus(
        mergeItems.length >= 2
          ? "File removed. Ready to merge."
          : "Upload at least 2 PDFs to start merge."
      );
    }
  });

  mergeBtn.addEventListener("click", mergePdfFiles);

  window.addEventListener("beforeunload", () => {
    revokeOutputUrl();
  });

  hideDownload();
  refreshUi();
})();
