import PDFDocument from 'pdfkit';

interface BankAccount { bankName: string; accountNumber: string; accountName: string; }

interface InvoicePdfData {
  tenant: { name: string; address: string | null; phone: string; email: string; motto?: string | null; bankAccounts: BankAccount[] };
  customer: { id: number; customerCode: string | null; name: string; phone: string; address: string | null };
  bill: {
    billNumber: string; periodStart: Date; periodEnd: Date; dueDate: Date;
    packageName: string; amount: string; taxPercent: string | null; taxAmount: string;
    totalAmount: string; status: string; createdAt: Date;
  };
  payment?: { paidAt: Date } | null;
}

function formatRp(value: number | string): string {
  return new Intl.NumberFormat('id-ID').format(Number(value));
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function terbilang(n: number): string {
  const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  function convert(num: number): string {
    if (num < 12) return satuan[num];
    if (num < 20) return convert(num - 10) + ' belas';
    if (num < 100) return convert(Math.floor(num / 10)) + ' puluh' + (num % 10 ? ' ' + convert(num % 10) : '');
    if (num < 200) return 'seratus' + (num % 100 ? ' ' + convert(num % 100) : '');
    if (num < 1000) return convert(Math.floor(num / 100)) + ' ratus' + (num % 100 ? ' ' + convert(num % 100) : '');
    if (num < 2000) return 'seribu' + (num % 1000 ? ' ' + convert(num % 1000) : '');
    if (num < 1000000) return convert(Math.floor(num / 1000)) + ' ribu' + (num % 1000 ? ' ' + convert(num % 1000) : '');
    if (num < 1000000000) return convert(Math.floor(num / 1000000)) + ' juta' + (num % 1000000 ? ' ' + convert(num % 1000000) : '');
    return convert(Math.floor(num / 1000000000)) + ' miliar' + (num % 1000000000 ? ' ' + convert(num % 1000000000) : '');
  }
  const r = convert(Math.round(n)).trim().replace(/\s+/g, ' ');
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export function buildInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PRIMARY = '#4F46E5';
    const DARK = '#111827';
    const GRAY = '#6B7280';
    const pageW = doc.page.width - 100;

    doc.fillColor(DARK).fontSize(16).font('Helvetica-Bold').text(data.tenant.name.toUpperCase(), 50, 50);
    if (data.tenant.motto) {
      doc.fontSize(8).font('Helvetica-Oblique').fillColor(GRAY).text(data.tenant.motto, 50, doc.y + 2);
    }
    doc.fontSize(8).font('Helvetica').fillColor(GRAY).text(data.tenant.address ?? '', 50, doc.y + 4);
    doc.text(`Telepon: ${data.tenant.phone}  •  Email: ${data.tenant.email}`, 50, doc.y + 2);

    doc.fontSize(22).font('Helvetica-Bold').fillColor(PRIMARY).text('INVOICE', 50, 50, { align: 'right', width: pageW });
    doc.moveTo(50, 115).lineTo(50 + pageW, 115).strokeColor('#E5E7EB').stroke();

    const infoTop = 130;
    doc.fontSize(9).font('Helvetica').fillColor(GRAY).text('Kepada:', 50, infoTop);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(DARK).text(data.customer.name, 50, infoTop + 13);
    doc.fontSize(9).font('Helvetica').fillColor(GRAY).text(data.customer.phone, 50, infoTop + 30);
    if (data.customer.address) doc.text(data.customer.address, 50, infoTop + 44, { width: 250 });

    const metaX = 320;
    const metaRows: [string, string][] = [
      ['No. Pelanggan', data.customer.customerCode ?? '-'],
      ['No. Invoice', data.bill.billNumber],
      ['Tgl. Invoice', formatDate(data.bill.createdAt)],
      ['Jatuh Tempo', formatDate(data.bill.dueDate)],
    ];
    metaRows.forEach(([label, value], i) => {
      const y = infoTop + i * 15;
      doc.fontSize(9).font('Helvetica').fillColor(GRAY).text(label, metaX, y, { width: 110 });
      doc.font('Helvetica-Bold').fillColor(DARK).text(value, metaX + 110, y, { width: 130, align: 'right' });
    });

    const periodeLabel = new Date(data.bill.periodStart).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    doc.fontSize(9).font('Helvetica').fillColor(GRAY).text(`Periode ${periodeLabel}`, 50, infoTop + 70);

    let rowY = infoTop + 95;
    const col = { no: 50, item: 80, qty: 320, harga: 370, total: 460 };

    doc.rect(50, rowY, pageW, 22).fill('#F3F4F6');
    doc.fillColor(GRAY).fontSize(8).font('Helvetica-Bold');
    doc.text('NO', col.no, rowY + 7, { width: 25 });
    doc.text('ITEM', col.item, rowY + 7, { width: 230 });
    doc.text('QTY', col.qty, rowY + 7, { width: 40, align: 'center' });
    doc.text('HARGA', col.harga, rowY + 7, { width: 80, align: 'right' });
    doc.text('TOTAL', col.total, rowY + 7, { width: pageW - (col.total - 50), align: 'right' });
    rowY += 22;

    doc.fillColor(DARK).fontSize(9).font('Helvetica');
    doc.text('1', col.no, rowY + 8, { width: 25 });
    doc.text(data.bill.packageName, col.item, rowY + 8, { width: 230 });
    doc.text('1', col.qty, rowY + 8, { width: 40, align: 'center' });
    doc.text(formatRp(data.bill.amount), col.harga, rowY + 8, { width: 80, align: 'right' });
    doc.text(formatRp(data.bill.amount), col.total, rowY + 8, { width: pageW - (col.total - 50), align: 'right' });
    rowY += 26;

    const hasTax = data.bill.taxPercent && Number(data.bill.taxAmount) > 0;
    if (hasTax) {
      doc.fontSize(9).fillColor(GRAY).text(`PPN (${Number(data.bill.taxPercent)}%)`, col.item, rowY + 4, { width: 230 });
      doc.fillColor(DARK).text(formatRp(data.bill.taxAmount), col.total, rowY + 4, { width: pageW - (col.total - 50), align: 'right' });
      rowY += 20;
    }

    doc.moveTo(50, rowY).lineTo(50 + pageW, rowY).strokeColor('#E5E7EB').stroke();
    rowY += 8;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK).text('TOTAL', col.harga, rowY, { width: 80, align: 'right' });
    doc.fontSize(12).fillColor(PRIMARY).text(`Rp ${formatRp(data.bill.totalAmount)}`, col.total, rowY - 2, { width: pageW - (col.total - 50), align: 'right' });
    rowY += 28;

    doc.fontSize(8).font('Helvetica-Oblique').fillColor(GRAY)
      .text(`* Terbilang: ${terbilang(Number(data.bill.totalAmount))} rupiah`, 50, rowY, { width: pageW });
    rowY += 25;
    doc.fontSize(9).font('Helvetica').fillColor(DARK).text('Terima kasih telah membayar iuran tepat waktu.', 50, rowY);

    rowY += 25;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(DARK).text('Pembayaran via Transfer:', 50, rowY);
    rowY += 14;
    doc.font('Helvetica').fontSize(8.5).fillColor(GRAY);
    data.tenant.bankAccounts.forEach((b) => {
      doc.text(`${b.bankName} : ${b.accountNumber} a/n ${b.accountName}`, 50, rowY);
      rowY += 12;
    });

    rowY += 8;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(DARK).text('Konfirmasi Pembayaran:', 50, rowY);
    rowY += 14;
    doc.font('Helvetica').fontSize(8.5).fillColor(GRAY).text(`WhatsApp: ${data.tenant.phone}`, 50, rowY);

    const isPaid = data.bill.status === 'paid';
    doc.save();
    doc.rotate(-18, { origin: [430, 430] });
    doc.lineWidth(2).strokeColor(isPaid ? '#16A34A' : '#DC2626');
    doc.roundedRect(330, 400, 200, 60, 6).dash(5, { space: 4 }).stroke();
    doc.undash();
    doc.fontSize(20).font('Helvetica-Bold').fillColor(isPaid ? '#16A34A' : '#DC2626')
      .text(isPaid ? 'LUNAS' : 'BELUM LUNAS', 330, 420, { width: 200, align: 'center' });
    doc.restore();

    const footerY = 720;
    doc.fontSize(8.5).font('Helvetica').fillColor(GRAY).text('Diterima oleh: __________________', 50, footerY);
    doc.text(
      data.payment?.paidAt ? `Tanggal: ${formatDate(data.payment.paidAt)}` : 'Tanggal: ____________________',
      50 + pageW - 150, footerY, { width: 150, align: 'right' },
    );

    doc.end();
  });
}