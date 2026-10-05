import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { groupIntoRows, parseRows, buildCsv } from '../src/lib/pdfTableParser.js';

async function main() {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const files = fs.existsSync(uploadsDir)
    ? fs.readdirSync(uploadsDir).filter(f => f.endsWith('.pdf')).sort().reverse()
    : [];
  if (!files.length) {
    console.error('No PDF files found in uploads/. Drop a UP timetable export there to test.');
    process.exit(1);
  }
  const pdfPath = path.join(uploadsDir, files[0]);
  console.log(`Testing PDF Parser with: ${path.basename(pdfPath)}\n`);

  // Node needs the legacy pdfjs-dist build (no DOM). The parsing logic itself
  // (column boundaries, row grouping, record building) lives in pdfTableParser.js
  // and is shared with the browser parser — this file only differs in how it
  // gets raw text items out of the PDF.
  const pdfjsLib = await import(
    pathToFileURL(path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href
  );
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;

  const allItems = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const tc = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;

    for (const item of tc.items) {
      if (item.str === undefined || item.str.trim() === '') continue;
      allItems.push({
        str: item.str.trim(),
        x: Math.round(item.transform[4]),
        y: Math.round(pageHeight - item.transform[5]),
        page: pageNum,
      });
    }
  }

  allItems.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);

  const rows = groupIntoRows(allItems);
  const records = parseRows(rows);
  const csvContent = buildCsv(records);

  fs.writeFileSync(path.join(process.cwd(), 'parsed_timetable.csv'), csvContent, 'utf-8');
  fs.writeFileSync(path.join(process.cwd(), 'parsed_timetable.json'), JSON.stringify(records, null, 2), 'utf-8');
  console.log(`Parsed ${records.length} records.`);
  console.log('Saved output to parsed_timetable.csv and parsed_timetable.json (gitignored — regenerate anytime)\n');

  console.log('Sample output (CSV format):');
  console.log(csvContent.split('\n').slice(0, 9).join('\n'));

  console.log('\nRunning test assertions against sample expected outputs...');
  const expected = [
    'ALL 121,S2,G01,E,L,Monday,09:30 - 10:20,HB 3-15,HATFIELD',
    'ALL 121,S2,G01,E,L,Thursday,09:30 - 10:20,HB 3-15,HATFIELD',
    'COS 110,S2,G01,E,L,Monday,07:30 - 08:20,Large Chemistry Hall,HATFIELD',
    'COS 110,S2,G01,E,L,Tuesday,12:30 - 13:20,IT 4-1,HATFIELD',
    'COS 110,S2,G01,E,L,Thursday,07:30 - 08:20,IT 4-5,HATFIELD',
    'COS 110,S2,G02,E,L,Monday,08:30 - 09:20,Large Chemistry Hall,HATFIELD',
    'COS 110,S2,G02,E,L,Tuesday,10:30 - 11:20,Louw hall,HATFIELD',
    'COS 110,S2,G02,E,L,Thursday,14:30 - 15:20,Roos hall,HATFIELD',
    'COS 110,S2,P01,E,P,Tuesday,14:30 - 17:20,Informatorium CBT Lab 1,HATFIELD',
    'COS 110,S2,P01,E,P,Tuesday,14:30 - 17:20,Informatorium CBT Lab 2,HATFIELD',
    'COS 110,S2,P01,E,P,Tuesday,14:30 - 17:20,Informatorium CBT Lab 3,HATFIELD',
    'COS 110,S2,T01,E,T,Monday,13:30 - 14:20,IT 4-1,HATFIELD',
    'GMC 110,S2,G01,E,P,Monday,12:30 - 14:20,Informatorium CBT Lab 1,HATFIELD',
    'GMC 110,S2,G01,E,P,Friday,15:30 - 17:20,Informatorium Blue Lab 1,HATFIELD',
    'WTW 114,S1,T02,E,T,Tuesday,10:30 - 13:20,South hall,HATFIELD',
    'WTW 114,S1,T02,E,T,Tuesday,10:30 - 13:20,Theology 1-9,HATFIELD',
  ];

  const formatted = records.map(r =>
    `${r.module},${r.semester},${r.group},${r.language},${r.activity},${r.day},${r.time},${r.venue},${r.campus}`
  );

  let allPass = true;
  for (const exp of expected) {
    if (formatted.includes(exp)) {
      console.log(`✅ MATCH: ${exp}`);
    } else {
      console.log(`❌ FAIL:  ${exp}`);
      allPass = false;
    }
  }

  console.log(allPass ? '\n🎉 ALL TESTS PASSED SUCCESSFULLY!' : '\n⚠️ Some tests failed.');
  process.exitCode = allPass ? 0 : 1;
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
