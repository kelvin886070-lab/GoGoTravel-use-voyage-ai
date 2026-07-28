// src/services/booking/pdfText.ts
// 🔒 隔離模組：檔案 → 文字。整個 app 只有這裡碰 pdfjs。
//   未來若轉真・原生（React Native），只換這一顆成原生 PDF API，上層抽取管線完全不動。
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// 抽出多頁 PDF 的全部文字（文字型 PDF 近乎無損）。掃描型 PDF 會抽到近乎空字串。
export async function extractPdfText(file: File): Promise<string> {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let out = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        out += content.items.map(it => ('str' in it ? it.str : '')).join(' ') + '\n';
    }
    return out.trim();
}

// 判斷抽出的文字是否「夠實」——掃描型 PDF 會低於門檻，交呼叫端降級處理。
export function hasUsableText(text: string): boolean {
    return text.replace(/\s/g, '').length >= 20;
}
