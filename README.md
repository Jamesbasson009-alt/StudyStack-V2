# StudyStack — UP Timetable Generator

Generates a conflict-free timetable from a University of Pretoria module
timetable PDF export. Pick your modules and a preference (morning, afternoon,
free day, early Friday finish) and it picks the best combination of lecture,
practical, and tutorial groups.

PDF parsing and the scheduling algorithm run entirely in the browser — your
PDF is never uploaded to a server.

**Live:** https://studystack.me

## Tech stack

React 18 · Vite · Supabase (auth) · pdfjs-dist · jsPDF + html2canvas

## Project structure

```
src/
├── App.jsx                     main UI: upload, module selection, timetable grid, export
├── components/
│   └── PortalGuideModal.jsx    "where do I get my PDF?" guide
├── lib/
│   ├── pdfParser.js            extracts text from the PDF (pdfjs-dist)
│   ├── pdfTableParser.js       column/row parsing logic, shared with the test script
│   ├── timetableGenerator.js   backtracking search + preference scoring
│   ├── auth.js                 Supabase auth wrapper
│   ├── books.js                books data layer
│   └── supabaseClient.js       shared Supabase client
└── pages/                      Landing, Auth, Books, Legal
scripts/
└── test-parser.mjs             parses a sample PDF and prints the result
```

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL and anon key
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | start the Vite dev server |
| `npm run build` | production build |
| `npm run test:parse` | parse a PDF from `uploads/` and print the output |

To test the parser, put a UP timetable export (filename starting `UP_MOD_XLS`)
in an `uploads/` folder at the project root, then run `npm run test:parse`.

## Notes

If UP changes the PDF export layout, the column X-boundaries (`COLUMNS`) in
`src/lib/pdfTableParser.js` will need re-measuring.
