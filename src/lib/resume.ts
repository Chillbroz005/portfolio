export type ResumePayload = {
  profile: {
    name?: string;
    title?: string;
    summary?: string;
    tagline?: string;
    location?: string;
    email?: string;
    phones?: string[];
    linkedin?: string;
    github?: string;
    regions?: string[];
    industries?: string[];
    functions?: string[];
    achievements?: string[];
  };
  experience: Array<{
    company: string;
    role: string;
    location: string;
    dates: string;
    bullets: string[];
  }>;
  skills: string[];
  software: string[];
  tools: string[];
  engagements: string[];
  education: Array<{ degree: string; institution: string; year: string; detail: string }>;
  certifications: string[];
  projects: Array<{ title: string; category: string; description: string; technologies: string[]; github: string }>;
};

function printable(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function makeRoundPhoto(dataUrl: string): Promise<string> {
  if (!dataUrl) return "";
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const size = 480;
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Your browser could not prepare the resume photo.");
  }
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  context.clip();
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL("image/png");
}

export async function generateResumePdf(data: ResumePayload, photoDataUrl: string): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const sidebarWidth = 190;
  const mainLeft = 214;
  const mainRight = pageWidth - 26;
  const mainWidth = mainRight - mainLeft;
  const sidebarLeft = 20;
  const sidebarWidthContent = sidebarWidth - sidebarLeft - 15;
  const bottom = pageHeight - 32;
  const roundPhoto = await makeRoundPhoto(photoDataUrl);

  const drawSidebarBase = () => {
    doc.setFillColor(11, 27, 51);
    doc.rect(0, 0, sidebarWidth, pageHeight, "F");
    doc.setFillColor(0, 194, 218);
    doc.rect(sidebarWidth, 0, 3, pageHeight, "F");
  };

  const sideText = (value: unknown, options: { bold?: boolean; color?: [number, number, number]; size?: number; gap?: number } = {}) => {
    const text = printable(value);
    if (!text) return;
    const { bold = false, color = [218, 228, 240], size = 8.4, gap = 2 } = options;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, sidebarWidthContent) as string[];
    const lineHeight = size * 1.35;
    lines.forEach(line => {
      doc.text(line, sidebarLeft, sideY);
      sideY += lineHeight;
    });
    sideY += gap;
  };

  let sideY = 0;
  const sideSection = (title: string) => {
    sideY += 9;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.7);
    doc.setTextColor(0, 211, 231);
    doc.text(printable(title).toUpperCase(), sidebarLeft, sideY);
    sideY += 4;
    doc.setDrawColor(0, 211, 231);
    doc.setLineWidth(1.4);
    doc.line(sidebarLeft, sideY, sidebarLeft + 21, sideY);
    sideY += 12;
  };

  const sideChips = (items: string[]) => {
    const fontSize = 7.3;
    const chipHeight = 15;
    const horizontalGap = 4;
    const verticalGap = 4;
    let x = sidebarLeft;
    let y = sideY;
    let rowHeight = chipHeight;
    items.map(printable).filter(Boolean).forEach(item => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(item, sidebarWidthContent - 12) as string[];
      const width = Math.min(sidebarWidthContent, Math.max(...lines.map(line => doc.getTextWidth(line))) + 12);
      const itemHeight = Math.max(chipHeight, lines.length * fontSize * 1.15 + 5);
      if (x > sidebarLeft && x + width > sidebarLeft + sidebarWidthContent) {
        x = sidebarLeft;
        y += rowHeight + verticalGap;
        rowHeight = chipHeight;
      }
      doc.setFillColor(23, 45, 79);
      doc.setDrawColor(44, 76, 122);
      doc.setLineWidth(0.65);
      doc.roundedRect(x, y, width, itemHeight, 6, 6, "FD");
      doc.setTextColor(238, 244, 250);
      lines.forEach((line, lineIndex) => doc.text(line, x + 6, y + 9.8 + lineIndex * fontSize * 1.15));
      rowHeight = Math.max(rowHeight, itemHeight);
      x += width + horizontalGap;
    });
    sideY = y + (items.length ? rowHeight + 2 : 0);
  };

  const sideBullet = (value: string, bold = false) => {
    const text = printable(value);
    if (!text) return;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(220, 230, 240);
    const lines = doc.splitTextToSize(text, sidebarWidthContent - 9) as string[];
    doc.setFillColor(0, 211, 231);
    doc.circle(sidebarLeft + 1.8, sideY - 2.8, 1.2, "F");
    lines.forEach((line, index) => {
      if (index > 0) sideY += 11.1;
      doc.text(line, sidebarLeft + 9, sideY);
    });
    sideY += 13;
  };

  const drawFirstSidebar = () => {
    drawSidebarBase();
    if (roundPhoto) {
      doc.addImage(roundPhoto, "PNG", 39, 31, 112, 112, undefined, "FAST");
      doc.setDrawColor(0, 211, 231);
      doc.setLineWidth(2.5);
      doc.circle(95, 87, 56, "S");
    }
    sideY = 169;
    sideSection("Contact");
    sideText(data.profile.email);
    (data.profile.phones || []).forEach(phone => sideText(phone));
    sideText(data.profile.location);
    sideText("LinkedIn     GitHub", { bold: true, color: [0, 211, 231], gap: 4 });

    sideSection("Core Skills");
    sideChips(data.skills);
    sideSection("Software");
    sideChips(data.software);
    sideSection("Tools");
    sideChips(data.tools);
  };

  const drawSecondSidebar = () => {
    drawSidebarBase();
    sideY = 49;
    sideSection("Education");
    data.education.forEach(item => {
      sideBullet(item.degree, true);
      sideText(item.institution, { gap: 0 });
      sideText(`${item.year}${item.detail ? ` | ${item.detail}` : ""}`, { gap: 5 });
    });

    if (data.certifications.length) {
      sideSection("Certifications");
      data.certifications.forEach(item => sideBullet(item));
    }

    if (data.profile.achievements?.length) {
      sideSection("Achievements");
      data.profile.achievements.forEach(item => sideBullet(item));
    }

    if (data.profile.regions?.length) {
      sideSection("Global Reach");
      sideText(data.profile.regions.join(", "));
    }
  };

  drawFirstSidebar();
  doc.addPage();
  drawSecondSidebar();
  doc.setPage(1);

  let mainY = 0;
  let mainPage = 1;
  const nextMainPage = () => {
    mainPage += 1;
    if (mainPage > doc.getNumberOfPages()) {
      doc.addPage();
      drawSecondSidebar();
    }
    doc.setPage(mainPage);
    mainY = 43;
  };
  const ensureMainSpace = (height: number) => {
    if (mainY + height > bottom) nextMainPage();
  };
  const mainText = (value: unknown, options: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number; after?: number } = {}) => {
    const text = printable(value);
    if (!text) return;
    const { size = 8.7, bold = false, color = [36, 51, 73], indent = 0, after = 2.4 } = options;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, mainWidth - indent) as string[];
    const lineHeight = size * 1.31;
    lines.forEach(line => {
      ensureMainSpace(lineHeight);
      doc.text(line, mainLeft + indent, mainY);
      mainY += lineHeight;
    });
    mainY += after;
  };
  const mainSection = (title: string) => {
    ensureMainSpace(32);
    mainY += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.2);
    doc.setTextColor(20, 37, 62);
    doc.text(printable(title).toUpperCase(), mainLeft, mainY);
    mainY += 3;
    doc.setDrawColor(0, 194, 218);
    doc.setLineWidth(1.25);
    doc.line(mainLeft, mainY, mainLeft + 24, mainY);
    mainY += 14;
  };
  const mainBullet = (value: string, options: { bold?: boolean; after?: number } = {}) => {
    const text = printable(value);
    if (!text) return;
    doc.setFillColor(29, 50, 77);
    ensureMainSpace(12);
    doc.circle(mainLeft + 2, mainY - 2.6, 1.15, "F");
    mainText(text, { size: 8.55, bold: options.bold, indent: 10, after: options.after ?? 2 });
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(12, 29, 54);
  doc.text(doc.splitTextToSize(printable(data.profile.name || "Professional Profile"), mainWidth) as string[], mainLeft, 48);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.7);
  doc.setTextColor(0, 130, 168);
  doc.text(doc.splitTextToSize(printable(data.profile.title).toUpperCase(), mainWidth) as string[], mainLeft, 67);
  doc.setDrawColor(0, 194, 218);
  doc.setLineWidth(3);
  doc.line(mainLeft, 76, mainLeft + 60, 76);
  mainY = 98;

  mainSection("Career Objective");
  mainText(data.profile.tagline || data.profile.summary, { size: 8.7, after: 5 });
  mainSection("Experience");

  data.experience.forEach(item => {
    ensureMainSpace(38);
    doc.setFillColor(0, 194, 218);
    doc.circle(mainLeft - 8, mainY - 3, 3, "F");
    mainText(item.company, { size: 9.6, bold: true, color: [17, 36, 65], after: 1 });
    mainText(item.role, { size: 9, bold: true, color: [0, 130, 168], after: 1 });
    mainText(`${item.dates}${item.location ? ` | ${item.location}` : ""}`, { size: 8, color: [94, 108, 127], after: 3 });
    item.bullets.filter(Boolean).forEach(bullet => mainBullet(bullet, { after: 1.5 }));
    mainY += 4;
  });

  if (data.engagements.length || data.projects.length) {
    mainSection("Key Engagements");
    data.engagements.forEach(item => mainBullet(item, { after: 2 }));
    data.projects.forEach(project => {
      const details = [project.title, project.category, project.description].filter(Boolean).join(" - ");
      mainBullet(details, { after: 2 });
    });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
