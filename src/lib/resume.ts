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
    .replace(/•/g, "-")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateResumePdf(data: ResumePayload, photoDataUrl: string): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const textWidth = pageWidth - margin * 2;
  let y = 0;

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - 42) {
      doc.addPage();
      y = 42;
    }
  };

  const addText = (value: unknown, options: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number; after?: number } = {}) => {
    const text = printable(value);
    if (!text) return;
    const { size = 9.5, bold = false, color = [43, 54, 67], indent = 0, after = 3 } = options;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, textWidth - indent) as string[];
    const lineHeight = size * 1.35;
    lines.forEach(line => {
      ensureSpace(lineHeight);
      doc.text(line, margin + indent, y);
      y += lineHeight;
    });
    y += after;
  };

  const addSection = (title: string) => {
    ensureSpace(34);
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(0, 155, 177);
    doc.text(printable(title).toUpperCase(), margin, y);
    y += 5;
    doc.setDrawColor(0, 190, 210);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 15;
  };

  // Branded first page header, with the same portrait used on the website.
  doc.setFillColor(8, 20, 35);
  doc.rect(0, 0, pageWidth, 124, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  const nameLines = doc.splitTextToSize(printable(data.profile.name || "Professional Profile"), 390) as string[];
  doc.text(nameLines.slice(0, 2), margin, 40);
  const titleY = 45 + Math.max(0, nameLines.length - 1) * 21;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(86, 220, 231);
  const titleLines = doc.splitTextToSize(printable(data.profile.title), 390) as string[];
  doc.text(titleLines.slice(0, 2), margin, titleY);
  const contactItems = [data.profile.location, data.profile.email, ...(data.profile.phones || []), data.profile.linkedin]
    .map(printable)
    .filter(Boolean);
  doc.setFontSize(8.5);
  doc.setTextColor(220, 230, 239);
  const contactLines = doc.splitTextToSize(contactItems.join(" | "), 390) as string[];
  doc.text(contactLines.slice(0, 2), margin, 96);
  try {
    if (photoDataUrl) doc.addImage(photoDataUrl, "PNG", pageWidth - margin - 66, 28, 66, 66, undefined, "FAST");
  } catch {
    // The resume remains usable if a browser cannot decode the optional portrait.
  }
  y = 145;

  addSection("Professional Summary");
  addText(data.profile.summary || data.profile.tagline, { size: 9.5, after: 4 });

  if (data.skills.length || data.software.length || data.tools.length) {
    addSection("Core Expertise");
    if (data.skills.length) addText(`Competencies: ${data.skills.join(", ")}`);
    if (data.software.length) addText(`Software: ${data.software.join(", ")}`);
    if (data.tools.length) addText(`Tools and platforms: ${data.tools.join(", ")}`);
  }

  if (data.experience.length) {
    addSection("Professional Experience");
    data.experience.forEach(item => {
      addText(`${item.role} | ${item.dates}`, { size: 10, bold: true, color: [22, 36, 51], after: 2 });
      addText(`${item.company} | ${item.location}`, { size: 9, color: [87, 101, 116], after: 3 });
      item.bullets.filter(Boolean).forEach(bullet => addText(`- ${bullet}`, { size: 9, indent: 9, after: 1 }));
      y += 5;
    });
  }

  if (data.projects.length) {
    addSection("Selected Projects");
    data.projects.forEach(project => {
      addText(`${project.title}${project.category ? ` | ${project.category}` : ""}`, { size: 10, bold: true, after: 2 });
      addText(project.description, { after: 2 });
      if (project.technologies.length) addText(`Tools and methods: ${project.technologies.join(", ")}`, { size: 8.5, color: [87, 101, 116] });
      if (project.github) addText(project.github, { size: 8, color: [0, 128, 155], after: 4 });
    });
  }

  if (data.engagements.length) {
    addSection("Project Engagements");
    data.engagements.forEach(item => addText(`- ${item}`, { indent: 9, after: 1 }));
  }

  if (data.education.length) {
    addSection("Education");
    data.education.forEach(item => {
      addText(`${item.degree} | ${item.year}`, { size: 9.5, bold: true, after: 1 });
      addText(`${item.institution}${item.detail ? ` | ${item.detail}` : ""}`, { after: 3 });
    });
  }

  if (data.certifications.length) {
    addSection("Certifications");
    addText(data.certifications.join(" | "));
  }

  if (data.profile.achievements?.length) {
    addSection("Achievements and Recognition");
    data.profile.achievements.forEach(item => addText(`- ${item}`, { indent: 9, after: 1 }));
  }

  if (data.profile.regions?.length || data.profile.industries?.length || data.profile.functions?.length) {
    addSection("Industry and Global Experience");
    if (data.profile.industries?.length) addText(`Industries: ${data.profile.industries.join(", ")}`);
    if (data.profile.functions?.length) addText(`Functions: ${data.profile.functions.join(", ")}`);
    if (data.profile.regions?.length) addText(`Regions: ${data.profile.regions.join(", ")}`);
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(115, 127, 140);
    doc.text(`${printable(data.profile.name)} | ${page} / ${totalPages}`, pageWidth - margin, pageHeight - 20, { align: "right" });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
