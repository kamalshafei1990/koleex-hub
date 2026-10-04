/* The print route is chrome-less on purpose: Puppeteer snapshots it and the
   "Export PDF" window prints it. Without this file the segment inherits the
   quotations app skeleton (../../loading.tsx), which is drawn inside the Hub
   shell and would flash — or be captured — on a page that has no shell. */
export default function Loading() {
  return null;
}
