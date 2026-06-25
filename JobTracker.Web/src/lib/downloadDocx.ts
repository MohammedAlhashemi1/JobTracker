import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';

// ── Helpers ──────────────────────────────────────────────────────────────────
const decodeHtml = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// ── Design tokens ────────────────────────────────────────────────────────────
const FONT      = 'Calibri';
const NAME_CLR  = '0F172A';   // near-black
const BODY_CLR  = '1E293B';   // slate-800
const META_CLR  = '64748B';   // slate-500
const ACCENT    = '1D4ED8';   // professional blue
const RULE_CLR  = 'CBD5E1';   // slate-300
const PW        = 9360;       // right-tab position in twips (~6.5 in content width)

// ── Types ────────────────────────────────────────────────────────────────────
interface EntryItem { title: string; subtitle?: string; date?: string; bullets?: string[] }
interface SkillItem { key: string; value: string }
interface Section {
  title: string;
  type: 'paragraph' | 'entries' | 'skills';
  content?: string;
  items?: EntryItem[] | SkillItem[];
}
interface ResumeData { name: string; contact: string[]; sections: Section[] }

// ── Paragraph builders ───────────────────────────────────────────────────────

// Name — centered, 24 pt, bold
const nameBlock = (text: string) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 50 },
  children: [new TextRun({ text, bold: true, size: 48, font: FONT, color: NAME_CLR })],
});

// Contact items joined on one centered line with · separators
const contactBlock = (items: string[]) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 80 },
  children: items.flatMap((item, i) => [
    ...(i > 0 ? [new TextRun({ text: '  ·  ', size: 18, font: FONT, color: META_CLR })] : []),
    new TextRun({ text: item, size: 18, font: FONT, color: META_CLR }),
  ]),
});

// Thin rule below header block
const headerRule = () => new Paragraph({
  spacing: { before: 60, after: 0 },
  border: { bottom: { style: 'single' as const, size: 4, color: RULE_CLR, space: 0 } },
  children: [],
});

// Section heading — bold caps, blue bottom rule
const sectionHead = (title: string) => new Paragraph({
  spacing: { before: 240, after: 60 },
  border: { bottom: { style: 'single' as const, size: 6, color: ACCENT, space: 40 } },
  children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 21, font: FONT, color: BODY_CLR })],
});

// Entry title + right-aligned date
const entryTitle = (title: string, date?: string) => new Paragraph({
  tabStops: [{ type: 'right' as const, position: PW }],
  spacing: { before: 120, after: 20 },
  children: [
    new TextRun({ text: title, bold: true, size: 21, font: FONT, color: BODY_CLR }),
    ...(date ? [new TextRun({ text: '\t' + date, size: 19, font: FONT, color: META_CLR })] : []),
  ],
});

// Entry subtitle / company in italic gray
const entrySub = (text: string) => new Paragraph({
  spacing: { before: 0, after: 40 },
  children: [new TextRun({ text, italics: true, size: 19, font: FONT, color: META_CLR })],
});

// Bullet point
const bulletItem = (text: string) => new Paragraph({
  bullet: { level: 0 },
  spacing: { after: 40 },
  children: [new TextRun({ text, size: 20, font: FONT, color: BODY_CLR })],
});

// Body paragraph (summary / profile)
const bodyPara = (text: string) => new Paragraph({
  spacing: { after: 0 },
  children: [new TextRun({ text, size: 20, font: FONT, color: BODY_CLR })],
});

// Skill row — bold category key, normal values
const skillRow = (key: string, value: string) => new Paragraph({
  spacing: { after: 44 },
  children: [
    new TextRun({ text: key + ': ', bold: true, size: 20, font: FONT, color: BODY_CLR }),
    new TextRun({ text: value, size: 20, font: FONT, color: BODY_CLR }),
  ],
});

// ── JSON → paragraphs ────────────────────────────────────────────────────────
function buildFromJson(data: ResumeData): Paragraph[] {
  const out: Paragraph[] = [];
  const d = (s: string) => decodeHtml(s);

  out.push(nameBlock(d(data.name)));

  const contactItems = (data.contact ?? []).map(d).filter(Boolean);
  if (contactItems.length > 0) out.push(contactBlock(contactItems));

  out.push(headerRule());

  for (const section of data.sections ?? []) {
    out.push(sectionHead(d(section.title)));

    if (section.type === 'paragraph' && section.content) {
      out.push(bodyPara(d(section.content)));

    } else if (section.type === 'entries') {
      for (const item of (section.items ?? []) as EntryItem[]) {
        out.push(entryTitle(d(item.title), item.date ? d(item.date) : undefined));
        if (item.subtitle) out.push(entrySub(d(item.subtitle)));
        for (const b of item.bullets ?? []) out.push(bulletItem(d(b)));
      }

    } else if (section.type === 'skills') {
      for (const item of (section.items ?? []) as SkillItem[]) {
        out.push(skillRow(d(item.key), d(item.value)));
      }
    }
  }

  return out;
}

// ── Fallback: plain text ──────────────────────────────────────────────────────
function buildFromText(content: string): Paragraph[] {
  const strip = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*([^*]+?)\*/g, '$1');
  let first = true;
  return content.split('\n').map(line => {
    const t = line.trim();
    if (!t) return new Paragraph({ children: [], spacing: { after: 40 } });
    if (first) { first = false; return nameBlock(strip(t)); }
    return new Paragraph({
      children: [new TextRun({ text: strip(t), size: 20, font: FONT, color: BODY_CLR })],
      spacing: { after: 60 },
    });
  });
}

// ── Main export ──────────────────────────────────────────────────────────────
export async function downloadDocx(filename: string, content: string) {
  let paragraphs: Paragraph[];
  try {
    const start = content.indexOf('{');
    const end   = content.lastIndexOf('}');
    const json  = start >= 0 && end > start ? content.slice(start, end + 1) : content;
    paragraphs  = buildFromJson(JSON.parse(json) as ResumeData);
  } catch {
    paragraphs = buildFromText(content);
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 864, bottom: 864, left: 1008, right: 1008 } }, // 0.6 in top/bottom, 0.7 in sides
      },
      children: paragraphs,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Preview helper (JSON → readable text) ────────────────────────────────────
export function resumeToPreviewText(content: string): string {
  try {
    const start = content.indexOf('{');
    const end   = content.lastIndexOf('}');
    const json  = start >= 0 && end > start ? content.slice(start, end + 1) : content;
    const data  = JSON.parse(json) as ResumeData;
    const d = (s: string) => decodeHtml(s);
    const lines: string[] = [d(data.name), (data.contact ?? []).map(d).join('  ·  '), ''];
    for (const s of data.sections ?? []) {
      lines.push(d(s.title), '');
      if (s.type === 'paragraph' && s.content) {
        lines.push(d(s.content), '');
      } else if (s.type === 'entries') {
        for (const item of (s.items ?? []) as EntryItem[]) {
          lines.push(`${d(item.title)}${item.date ? '  ' + d(item.date) : ''}`);
          if (item.subtitle) lines.push(d(item.subtitle));
          for (const b of item.bullets ?? []) lines.push('• ' + d(b));
          lines.push('');
        }
      } else if (s.type === 'skills') {
        for (const item of (s.items ?? []) as SkillItem[]) {
          lines.push(`${d(item.key)}: ${d(item.value)}`);
        }
        lines.push('');
      }
    }
    return lines.join('\n');
  } catch {
    return content.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*([^*]+?)\*/g, '$1');
  }
}
