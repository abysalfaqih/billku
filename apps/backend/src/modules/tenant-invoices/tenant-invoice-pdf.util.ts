import PDFDocument from 'pdfkit';

interface InvoiceItem {
  description: string;
  qty: number;
  unitPrice: number;
  discPercent: number;
  tax: 'P' | 'N';
}

interface TenantInvoicePdfData {
  issuer: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string | null;
  };
  tenant: {
    name: string;
    address: string | null;
  };
  invoice: {
    invoiceNumber: string;
    invoiceDate: Date;
    periodMonth: number;
    periodYear: number;
    items: InvoiceItem[];
    subtotal: number;
    discountAmount: number;
    ppnPercent: number;
    ppnAmount: number;
    totalAmount: number;
    paymentDescription: string | null;
    authorizedBy: string | null;
    authorizedTitle: string | null;
  };
}

// ─── Terbilang ────────────────────────────────────────────────────────────────
function terbilang(n: number): string {
  const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima',
                  'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  function convert(num: number): string {
    if (num < 12)     return satuan[num];
    if (num < 20)     return convert(num - 10) + ' belas';
    if (num < 100)    return convert(Math.floor(num / 10)) + ' puluh' + (num % 10 ? ' ' + convert(num % 10) : '');
    if (num < 200)    return 'seratus' + (num % 100 ? ' ' + convert(num % 100) : '');
    if (num < 1000)   return convert(Math.floor(num / 100)) + ' ratus' + (num % 100 ? ' ' + convert(num % 100) : '');
    if (num < 2000)   return 'seribu' + (num % 1000 ? ' ' + convert(num % 1000) : '');
    if (num < 1e6)    return convert(Math.floor(num / 1000)) + ' ribu' + (num % 1000 ? ' ' + convert(num % 1000) : '');
    if (num < 1e9)    return convert(Math.floor(num / 1e6)) + ' juta' + (num % 1e6 ? ' ' + convert(num % 1e6) : '');
    return convert(Math.floor(num / 1e9)) + ' miliar' + (num % 1e9 ? ' ' + convert(num % 1e9) : '');
  }
  const r = convert(Math.round(n)).trim().replace(/\s+/g, ' ');
  return r.charAt(0).toUpperCase() + r.slice(1) + ' rupiah';
}

function formatRp(v: number): string {
  return new Intl.NumberFormat('id-ID').format(v);
}

function formatDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const PERIOD_NAMES = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function buildTenantInvoicePdf(data: TenantInvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pw   = doc.page.width - 80;   // usable width
    const ml   = 40;                     // margin left
    const mr   = doc.page.width - 40;   // margin right

    // ── Logo + Title ─────────────────────────────────────────────────────────
    // Issuer logo (kiri)
    if (data.issuer.logoUrl) {
      try {
        // Logo dari URL tidak bisa langsung — di sini kita skip
        // Caller perlu pass buffer jika ingin logo di PDF
      } catch { /* skip */ }
    }

    // "Sales Invoice" (kanan)
    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor('#1a1a2e')
      .text('Sales Invoice', ml, 40, { align: 'right', width: pw });

    // Issuer name kiri
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#1a1a2e')
      .text(data.issuer.name, ml, 40, { width: pw * 0.5 });

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#555')
      .text(data.issuer.address, ml, doc.y + 2, { width: pw * 0.5 })
      .text(`Telp: ${data.issuer.phone}  |  Email: ${data.issuer.email}`, ml, doc.y + 1, { width: pw * 0.5 });

    // ── Info Box (kanan atas) ─────────────────────────────────────────────────
    const boxX = ml + pw * 0.55;
    const boxW = pw * 0.45;
    let boxY   = 58;
    const boxH = 52;

    doc.rect(boxX, boxY, boxW, boxH).stroke('#cccccc');

    const labelX  = boxX + 4;
    const valueX  = boxX + boxW * 0.5;
    const rowH    = 16;

    const infoRows = [
      ['Invoice Date', formatDate(data.invoice.invoiceDate)],
      ['Invoice No.', data.invoice.invoiceNumber],
      ['Tax No.', ''],
    ];

    infoRows.forEach(([label, value], i) => {
      const y = boxY + 6 + i * rowH;
      // Garis pemisah antar baris
      if (i > 0) {
        doc.moveTo(boxX, y - 2).lineTo(boxX + boxW, y - 2).strokeColor('#dddddd').lineWidth(0.5).stroke();
      }
      // Garis vertikal tengah
      doc.moveTo(valueX - 2, boxY).lineTo(valueX - 2, boxY + boxH).strokeColor('#cccccc').lineWidth(0.5).stroke();

      doc.font('Helvetica').fontSize(8).fillColor('#555').text(label, labelX, y, { width: valueX - labelX - 4 });
      doc.font('Helvetica').fontSize(8).fillColor('#222').text(value, valueX + 2, y, { width: boxW - (valueX - boxX) - 4 });
    });

    // ── Bill To ───────────────────────────────────────────────────────────────
    let curY = Math.max(doc.y, boxY + boxH) + 20;

    doc.rect(ml, curY, pw, 55).stroke('#cccccc');
    doc.font('Helvetica').fontSize(9).fillColor('#555').text('Bill To  :', ml + 6, curY + 6);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#222').text(data.tenant.name, ml + 60, curY + 6);
    doc.font('Helvetica').fontSize(8).fillColor('#555')
       .text(data.tenant.address ?? '-', ml + 60, curY + 20, { width: pw - 70 });

    curY += 65;

    // ── Table Header ──────────────────────────────────────────────────────────
    const cols = {
      item:      { x: ml,          w: 50 },
      desc:      { x: ml + 50,     w: pw * 0.40 },
      qty:       { x: ml + 50 + pw * 0.40,  w: 30 },
      price:     { x: ml + 80 + pw * 0.40,  w: 80 },
      disc:      { x: ml + 160 + pw * 0.40, w: 35 },
      tax:       { x: ml + 195 + pw * 0.40, w: 25 },
      amount:    { x: ml + 220 + pw * 0.40, w: pw - (220 + pw * 0.40) },
    };

    const hdrH = 20;
    doc.rect(ml, curY, pw, hdrH).fill('#f0f0f0').stroke('#cccccc');
    doc.fillColor('#333').font('Helvetica-Bold').fontSize(8);

    const headers: [keyof typeof cols, string][] = [
      ['item', 'Item'], ['desc', 'Description:'], ['qty', 'Qty'],
      ['price', 'Unit Price'], ['disc', 'Disc %'], ['tax', 'Tax'], ['amount', 'Amount'],
    ];

    headers.forEach(([key, label]) => {
      const c = cols[key];
      const align = ['qty', 'price', 'disc', 'amount'].includes(key) ? 'right' : 'left';
      doc.text(label, c.x + 3, curY + 6, { width: c.w - 3, align });
    });

    curY += hdrH;

    // ── Table Rows ────────────────────────────────────────────────────────────
    data.invoice.items.forEach((item, i) => {
      const rowY  = curY + i * 18;
      const amount = item.unitPrice * item.qty * (1 - item.discPercent / 100);

      if (i % 2 === 0) {
        doc.rect(ml, rowY, pw, 18).fill('#fafafa');
      }
      doc.rect(ml, rowY, pw, 18).stroke('#eeeeee');

      doc.font('Helvetica').fontSize(8).fillColor('#333');
      const itemCode = `PM${String(i + 1).padStart(4, '0')}${String(i + 7)}`;
      doc.text(itemCode,            cols.item.x + 3,   rowY + 5, { width: cols.item.w - 3 });
      doc.text(item.description,    cols.desc.x + 3,   rowY + 5, { width: cols.desc.w - 3 });
      doc.text(String(item.qty),    cols.qty.x + 3,    rowY + 5, { width: cols.qty.w - 3,   align: 'right' });
      doc.text(formatRp(item.unitPrice), cols.price.x + 3, rowY + 5, { width: cols.price.w - 3, align: 'right' });
      doc.text(String(item.discPercent), cols.disc.x + 3,  rowY + 5, { width: cols.disc.w - 3,  align: 'right' });
      doc.text(item.tax,             cols.tax.x + 3,   rowY + 5, { width: cols.tax.w - 3 });
      doc.text(formatRp(amount),    cols.amount.x + 3, rowY + 5, { width: cols.amount.w - 3, align: 'right' });
    });

    curY += data.invoice.items.length * 18;

    // Isi baris kosong (min 6 baris)
    const minRows = 6;
    const emptyRows = Math.max(0, minRows - data.invoice.items.length);
    for (let i = 0; i < emptyRows; i++) {
      const rowY = curY + i * 18;
      doc.rect(ml, rowY, pw, 18).stroke('#eeeeee');
    }
    curY += emptyRows * 18;

    // ── Summary ───────────────────────────────────────────────────────────────
    const sumX = ml + pw * 0.6;
    const sumW = pw - pw * 0.6;

    // "Say" (terbilang) di kiri
    doc.font('Helvetica').fontSize(8).fillColor('#555').text('Say', ml, curY + 6);
    doc.text(':', ml + 30, curY + 6);
    doc.rect(ml + 40, curY, sumX - ml - 50, 50).stroke('#cccccc');
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#333')
       .text(terbilang(data.invoice.totalAmount), ml + 44, curY + 6, { width: sumX - ml - 60 });

    // Summary box (kanan)
    const sumRows = [
      ['Sub Total :', formatRp(data.invoice.subtotal)],
      ['Discount :', formatRp(data.invoice.discountAmount)],
      [`PPN (${data.invoice.ppnPercent}%) :`, formatRp(data.invoice.ppnAmount)],
      [':', '0'],
    ];

    sumRows.forEach(([label, value], i) => {
      const rowY = curY + i * 13;
      doc.font('Helvetica').fontSize(8).fillColor('#555')
         .text(label, sumX, rowY + 4, { width: sumW * 0.5, align: 'right' });
      doc.font('Helvetica').fontSize(8).fillColor('#333')
         .text(value, sumX + sumW * 0.5 + 4, rowY + 4, { width: sumW * 0.45, align: 'right' });
    });

    curY += 55;

    // Total Invoice
    doc.rect(sumX, curY - 5, sumW, 18).fill('#1a1a2e');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
       .text('Total Invoice :', sumX + 4, curY - 1, { width: sumW * 0.5, align: 'right' });
    doc.text(formatRp(data.invoice.totalAmount), sumX + sumW * 0.5 + 4, curY - 1, {
      width: sumW * 0.45, align: 'right',
    });

    curY += 22;

    // ── Payment Description ───────────────────────────────────────────────────
    if (data.invoice.paymentDescription) {
      doc.rect(ml, curY, pw * 0.55, 45).stroke('#cccccc');
      doc.font('Helvetica').fontSize(7.5).fillColor('#333')
         .text('Description:', ml + 4, curY + 4)
         .text(data.invoice.paymentDescription, ml + 4, curY + 14, { width: pw * 0.55 - 8 });
      curY += 55;
    } else {
      curY += 10;
    }

    // ── "Thank You" + Signature ───────────────────────────────────────────────
    doc.font('Helvetica').fontSize(9).fillColor('#555').text('Thank You For Your Business!', ml, curY + 10);

    if (data.invoice.authorizedBy) {
      const sigX = mr - 130;
      doc.font('Helvetica').fontSize(8).fillColor('#333')
         .text(data.invoice.authorizedBy, sigX, curY + 36, { width: 120, align: 'center' });
      doc.moveTo(sigX, curY + 34).lineTo(sigX + 120, curY + 34).strokeColor('#999').lineWidth(0.5).stroke();
      if (data.invoice.authorizedTitle) {
        doc.font('Helvetica').fontSize(8).fillColor('#777')
           .text(data.invoice.authorizedTitle, sigX, curY + 42, { width: 120, align: 'center' });
      }
    }

    curY += 60;

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 60;
    doc.moveTo(ml, footerY).lineTo(mr, footerY).strokeColor('#cccccc').lineWidth(0.5).stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#222')
       .text(data.issuer.name.toUpperCase(), ml, footerY + 6, { align: 'center', width: pw });
    doc.font('Helvetica').fontSize(7.5).fillColor('#555')
       .text(data.issuer.email, ml, footerY + 18, { width: pw * 0.35 })
       .text(data.issuer.address, mr - pw * 0.55, footerY + 14, { width: pw * 0.55, align: 'right' });

    doc.end();
  });
}