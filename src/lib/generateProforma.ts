import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel,
  ShadingType, convertInchesToTwip,
} from 'docx';
import { saveAs } from 'file-saver';
import type { QuoteRequest } from '../types';

// ─── Seller info (à personnaliser) ────────────────────────────────────────────
const SELLER = {
  name: 'REDMAC MOROCCO',
  address: 'Zone Industrielle, Casablanca, Maroc',
  email: 'eyad.sobh@redmac.ma',
  phone: '+212 661 257 250',
  ice: 'ICE : 000000000000000',
  rc: 'RC : 000000',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bold(text: string, size = 22): TextRun {
  return new TextRun({ text, bold: true, size });
}

function normal(text: string, size = 20): TextRun {
  return new TextRun({ text, size });
}

function cell(content: string, opts: { bold?: boolean; shade?: boolean; align?: typeof AlignmentType[keyof typeof AlignmentType]; width?: number } = {}): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [new TextRun({ text: content, bold: opts.bold, size: 18 })],
      }),
    ],
    shading: opts.shade ? { type: ShadingType.SOLID, color: '4A3728', fill: '4A3728' } : undefined,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

function headerCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 18 })] })],
    shading: { type: ShadingType.SOLID, color: '4A3728', fill: '4A3728' },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 19, color: '4A3728' })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D4A853' } },
    spacing: { before: 240, after: 100 },
  });
}

function infoRow(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 18 }),
      new TextRun({ text: value || '—', size: 18 }),
    ],
    spacing: { after: 60 },
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateProforma(q: QuoteRequest): Promise<void> {
  const refNum = `PRO-${new Date().getFullYear()}-${q.id.slice(-6).toUpperCase()}`;
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Parse products list
  const productLines = (q.products_interested || '').split('\n').filter(Boolean);

  // ── Product table rows ────────────────────────────────────────────────────
  const productRows: TableRow[] = [
    new TableRow({
      children: [
        headerCell('Désignation du produit'),
        headerCell('Qté / Vol.'),
        headerCell('Unité'),
        headerCell('Observations'),
      ],
      tableHeader: true,
    }),
    ...productLines.map(line => {
      // line format: "Product name (Category) — 100 Cartons"
      const match = line.match(/^(.+?)(?:\s*—\s*(\d+)\s+(\w+))?$/);
      const name = match?.[1]?.trim() ?? line;
      const qty = match?.[2] ?? '';
      const unit = match?.[3] ?? '';
      return new TableRow({
        children: [
          cell(name),
          cell(qty, { align: AlignmentType.CENTER }),
          cell(unit, { align: AlignmentType.CENTER }),
          cell(''),
        ],
      });
    }),
    // Extra empty row for admin to fill
    ...Array.from({ length: Math.max(0, 3 - productLines.length) }).map(
      () => new TableRow({ children: [cell(''), cell(''), cell(''), cell('')] })
    ),
  ];

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.2),
            right: convertInchesToTwip(1.2),
          },
        },
      },
      children: [

        // ── Title ─────────────────────────────────────────────────────────
        new Paragraph({
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: 'PROFORMA INVOICE', bold: true, size: 36, color: '4A3728' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 360 },
          children: [new TextRun({ text: 'Facture Proforma — Non contractuelle', size: 18, italics: true, color: '888888' })],
        }),

        // ── Ref + Date header table ───────────────────────────────────────
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ children: [bold('VENDEUR / SELLER', 20)] }),
                    new Paragraph({ children: [normal(SELLER.name, 18)], spacing: { after: 40 } }),
                    new Paragraph({ children: [normal(SELLER.address, 17)], spacing: { after: 40 } }),
                    new Paragraph({ children: [normal(`Tél : ${SELLER.phone}`, 17)], spacing: { after: 40 } }),
                    new Paragraph({ children: [normal(`Email : ${SELLER.email}`, 17)], spacing: { after: 40 } }),
                    new Paragraph({ children: [normal(SELLER.ice, 17)], spacing: { after: 40 } }),
                    new Paragraph({ children: [normal(SELLER.rc, 17)] }),
                  ],
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                }),
                new TableCell({
                  children: [
                    new Paragraph({ alignment: AlignmentType.RIGHT, children: [bold('ACHETEUR / BUYER', 20)] }),
                    new Paragraph({ alignment: AlignmentType.RIGHT, children: [bold(q.company_name, 18)], spacing: { after: 40 } }),
                    ...(q.buyer_vat_number ? [new Paragraph({ alignment: AlignmentType.RIGHT, children: [normal(`TVA : ${q.buyer_vat_number}`, 17)], spacing: { after: 40 } })] : []),
                    new Paragraph({ alignment: AlignmentType.RIGHT, children: [normal(q.contact_name, 17)], spacing: { after: 40 } }),
                    new Paragraph({ alignment: AlignmentType.RIGHT, children: [normal(q.email, 17)], spacing: { after: 40 } }),
                    ...(q.phone ? [new Paragraph({ alignment: AlignmentType.RIGHT, children: [normal(q.phone, 17)], spacing: { after: 40 } })] : []),
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [normal([q.buyer_address, q.buyer_postal_code, q.buyer_city, q.country].filter(Boolean).join(', ') || q.country, 17)],
                    }),
                  ],
                  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ spacing: { after: 160 }, children: [] }),

        // ── Reference box ────────────────────────────────────────────────
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                headerCell('N° Proforma'),
                headerCell('Date'),
                headerCell('Validité'),
                headerCell('Devise'),
              ],
            }),
            new TableRow({
              children: [
                cell(refNum, { align: AlignmentType.CENTER, bold: true }),
                cell(today, { align: AlignmentType.CENTER }),
                cell('30 jours', { align: AlignmentType.CENTER }),
                cell(q.currency || 'EUR', { align: AlignmentType.CENTER, bold: true }),
              ],
            }),
          ],
        }),

        new Paragraph({ spacing: { after: 40 }, children: [] }),

        // ── Commercial terms ──────────────────────────────────────────────
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                headerCell('Incoterm'),
                headerCell('Port chargement'),
                headerCell('Port destination'),
                headerCell('Délai livraison'),
              ],
            }),
            new TableRow({
              children: [
                cell(q.incoterm || 'À définir', { align: AlignmentType.CENTER, bold: true }),
                cell(q.port_loading || 'Casablanca', { align: AlignmentType.CENTER }),
                cell(q.port_destination || '—', { align: AlignmentType.CENTER }),
                cell(q.delivery_date ? new Date(q.delivery_date).toLocaleDateString('fr-FR') : 'À confirmer', { align: AlignmentType.CENTER }),
              ],
            }),
          ],
        }),

        new Paragraph({ spacing: { after: 40 }, children: [] }),

        // ── Products table ────────────────────────────────────────────────
        sectionTitle('Désignation des marchandises'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: productRows,
        }),

        new Paragraph({ spacing: { after: 40 }, children: [] }),

        // ── Financial summary ─────────────────────────────────────────────
        sectionTitle('Conditions financières'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                headerCell('Conditions de paiement'),
                headerCell('Mode de transport'),
                headerCell('Type conteneur'),
                headerCell('Fréquence commande'),
              ],
            }),
            new TableRow({
              children: [
                cell(q.payment_terms || 'À définir'),
                cell('Maritime'),
                cell(q.container_type || 'À définir'),
                cell(q.order_frequency || '—'),
              ],
            }),
          ],
        }),

        new Paragraph({ spacing: { after: 40 }, children: [] }),

        // ── Requirements ──────────────────────────────────────────────────
        ...((q.required_certifications?.length || q.labeling_requirements || q.private_label || q.sample_request)
          ? [
              sectionTitle('Exigences spécifiques'),
              ...(q.required_certifications?.length ? [infoRow('Certifications requises', (q.required_certifications ?? []).join(' • '))] : []),
              ...(q.labeling_requirements ? [infoRow('Étiquetage', q.labeling_requirements)] : []),
              ...(q.private_label ? [infoRow('Marque distributeur', 'Oui — étiquetage private label demandé')] : []),
              ...(q.sample_request ? [infoRow('Échantillons', 'Oui — envoi d\'échantillons demandé avant commande')] : []),
            ]
          : []),

        // ── Notes ────────────────────────────────────────────────────────
        ...(q.message ? [
          sectionTitle('Remarques & instructions complémentaires'),
          new Paragraph({ children: [normal(q.message, 18)], spacing: { after: 60 } }),
        ] : []),

        new Paragraph({ spacing: { after: 40 }, children: [] }),

        // ── Price placeholder ─────────────────────────────────────────────
        sectionTitle('Récapitulatif financier'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [headerCell('Description'), headerCell(`Montant (${q.currency || 'EUR'})`)] }),
            new TableRow({ children: [cell('Prix marchandises (FOB)'), cell('_________________')] }),
            new TableRow({ children: [cell('Fret international'), cell('_________________')] }),
            new TableRow({ children: [cell('Assurance'), cell('_________________')] }),
            new TableRow({ children: [cell('Autres frais'), cell('_________________')] }),
            new TableRow({
              children: [
                cell('TOTAL', { bold: true }),
                cell('_________________', { bold: true }),
              ],
            }),
          ],
        }),

        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ── Footer ────────────────────────────────────────────────────────
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'D4A853' } },
          children: [
            new TextRun({ text: 'Ce document est une proforma indicative et non un engagement contractuel. ', size: 16, italics: true, color: '888888' }),
            new TextRun({ text: `${SELLER.name} — ${SELLER.email} — ${SELLER.phone}`, size: 16, color: '888888' }),
          ],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Proforma_${q.company_name.replace(/\s+/g, '_')}_${refNum}.docx`);
}
