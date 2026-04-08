const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const fs = require('fs');

const W = 1920;
const H = 1080;

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });

  const filePath = path.resolve(__dirname, 'proposta-ml.html');
  await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0', timeout: 30000 });

  await page.addStyleTag({
    content: `
      .reveal, .draw-line { opacity: 1 !important; transform: none !important; }
      .stack-bar { transform: scaleX(1) !important; }
      body::after { display: none !important; }
      .slide-nav { display: none !important; }
      .photo-container img { filter: none !important; }
      html, body { overflow: visible !important; }
      .mm-callout p { white-space: normal !important; }
    `
  });

  await page.evaluateHandle('document.fonts.ready');
  await new Promise(r => setTimeout(r, 2000));

  const slideIds = await page.$$eval('.slide', els => els.map(el => el.id));
  console.log(`${slideIds.length} slides`);

  const screenshots = [];

  for (const id of slideIds) {
    await page.evaluate((currentId, vw, vh) => {
      document.querySelectorAll('.slide').forEach(s => {
        if (s.id === currentId) {
          s.style.display = 'flex';
          s.style.position = 'fixed';
          s.style.top = '0';
          s.style.left = '0';
          s.style.width = vw + 'px';
          s.style.height = vh + 'px';
          s.style.minHeight = vh + 'px';
          s.style.maxHeight = vh + 'px';
          s.style.overflow = 'hidden';
          s.style.zIndex = '9999';
        } else {
          s.style.display = 'none';
        }
      });
    }, id, W, H);

    await new Promise(r => setTimeout(r, 200));

    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: W, height: H }
    });

    screenshots.push(screenshot);
    console.log(`  ✓ #${id}`);
  }

  const pdf = await PDFDocument.create();

  for (const imgBytes of screenshots) {
    const img = await pdf.embedPng(imgBytes);
    const p = pdf.addPage([W, H]);
    p.drawImage(img, { x: 0, y: 0, width: W, height: H });
  }

  const pdfBytes = await pdf.save();
  const outPath = path.resolve(__dirname, 'westack-proposta-ml.pdf');
  fs.writeFileSync(outPath, pdfBytes);

  const sizeMB = (pdfBytes.length / 1024 / 1024).toFixed(1);
  console.log(`\nPDF: ${sizeMB}MB, ${slideIds.length} páginas, ${W}x${H} landscape`);

  await browser.close();
})();
