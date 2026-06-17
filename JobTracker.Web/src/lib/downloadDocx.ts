import { Document, Paragraph, TextRun, Packer } from 'docx';

export async function downloadDocx(filename: string, content: string) {
  const paragraphs = content.split('\n').map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line, size: 24, font: 'Calibri' })],
        spacing: { after: 120 },
      })
  );

  const doc = new Document({
    sections: [{ children: paragraphs }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
