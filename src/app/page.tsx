"use client";

import { useEffect, useMemo, useState } from "react";
import { BASE } from "../data/base";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight, ChevronDown, Download, ExternalLink, Github,
  Linkedin, Mail, MapPin, Menu, Moon, Phone, Send, Sun, X,
  Edit3, Save, Plus, Trash2, Key, CheckCircle, AlertCircle, RefreshCw, Sparkles, Lock, Unlock, UserRound, Settings
} from "lucide-react";
import {
  profile as defaultProfile,
  experience as defaultExperience,
  engagements as defaultEngagements,
  skills as defaultSkills,
  software as defaultSoftware,
  tools as defaultTools,
  education as defaultEducation,
  certifications as defaultCertifications,
  projects as defaultProjects,
  ExperienceItem
} from "../data/profile";
import { generateResumePdf } from "../lib/resume";

const nav = [
  ["about", "About"],
  ["journey", "Journey"],
  ["expertise", "Expertise"],
  ["achievements", "Achievements"],
  ["projects", "Projects"],
  ["github", "GitHub"],
  ["education", "Education"],
  ["contact", "Contact"]
];

const projectFilters = ["All", "Procurement", "Automation", "Android", "Other"];
type EducationItem = (typeof defaultEducation)[number];
type ProjectItem = (typeof defaultProjects)[number];
const themeOptions = [
  { value: "obsidian", label: "Obsidian Cyan" },
  { value: "evergreen", label: "Evergreen" },
  { value: "amber", label: "Amber Copper" },
  { value: "violet", label: "Violet Rose" },
  { value: "polar", label: "Polar Blue" }
] as const;
type ThemeStyle = typeof themeOptions[number]["value"];

type GithubRepo = {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  fork: boolean;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}
function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
async function apiJson(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, credentials: "same-origin", headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

async function pngDataFromBlob(blob: Blob): Promise<{ dataUrl: string; base64: string }> {
  const bitmap = await createImageBitmap(blob);
  const maxDimension = 1200;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Your browser could not prepare the profile photo.");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const optimizedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error("Could not convert the profile photo.")), "image/png");
  });
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the converted profile photo."));
    reader.onerror = () => reject(new Error("Could not read the converted profile photo."));
    reader.readAsDataURL(optimizedBlob);
  });
  return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}

async function loadCurrentPhotoData(): Promise<{ dataUrl: string; base64: string }> {
  const response = await fetch(`${BASE}/profile-photo.png`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the current profile photo to create the resume.");
  return pngDataFromBlob(await response.blob());
}

// Calculates exact duration in Years and Months (for total or per-role)
function calculateDuration(startDateStr: string, endDateStr: string | null): string {
  if (!startDateStr) return "";
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";

  let yearsDiff = end.getFullYear() - start.getFullYear();
  let monthsDiff = end.getMonth() - start.getMonth();
  let daysDiff = end.getDate() - start.getDate();

  if (daysDiff < 0) {
    monthsDiff -= 1;
  }
  let totalMonths = yearsDiff * 12 + monthsDiff;
  if (totalMonths < 0) totalMonths = 0;

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  return `${years} ${years === 1 ? "Year" : "Years"}, ${months} ${months === 1 ? "Month" : "Months"}`;
}

function calculateTotalExperience(experiences: ExperienceItem[]): string {
  let totalMonths = 0;
  for (const exp of experiences) {
    if (!exp.startDate) continue;
    const start = new Date(exp.startDate);
    const end = exp.endDate ? new Date(exp.endDate) : new Date();
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

    let yearsDiff = end.getFullYear() - start.getFullYear();
    let monthsDiff = end.getMonth() - start.getMonth();
    let daysDiff = end.getDate() - start.getDate();

    if (daysDiff < 0) {
      monthsDiff -= 1;
    }
    let expMonths = yearsDiff * 12 + monthsDiff;
    if (expMonths < 0) expMonths = 0;
    totalMonths += expMonths;
  }

  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  const yearStr = `${years} ${years === 1 ? "Year" : "Years"}`;
  const monthStr = `${remainingMonths} ${remainingMonths === 1 ? "Month" : "Months"}`;

  return `${yearStr}, ${monthStr}`;
}

export default function Home() {
  const [dark, setDark] = useState(true);
  const [themeStyle, setThemeStyle] = useState<ThemeStyle>("obsidian");
  const [themePreferencesLoaded, setThemePreferencesLoaded] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [recruiter, setRecruiter] = useState(false);
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [repoStatus, setRepoStatus] = useState<"loading" | "ready" | "fallback">("loading");

  // Editable state
  const [isEditor, setIsEditor] = useState(false);
  const [profileData, setProfileData] = useState<any>(defaultProfile);
  const [expList, setExpList] = useState<ExperienceItem[]>(defaultExperience);
  const [skillsList, setSkillsList] = useState<string[]>([...defaultSkills]);
  const [softwareList, setSoftwareList] = useState<string[]>([...defaultSoftware]);
  const [toolsList, setToolsList] = useState<string[]>([...defaultTools]);
  const [engagementList, setEngagementList] = useState<string[]>([...defaultEngagements]);
  const [educationList, setEducationList] = useState<EducationItem[]>([...defaultEducation]);
  const [certificationList, setCertificationList] = useState<string[]>([...defaultCertifications]);
  const [projectList, setProjectList] = useState<ProjectItem[]>([...defaultProjects]);
  const [newSkill, setNewSkill] = useState("");
  const [newSoftware, setNewSoftware] = useState("");
  const [newTool, setNewTool] = useState("");
  const [newEngagement, setNewEngagement] = useState("");
  const [newEducation, setNewEducation] = useState<EducationItem>({ degree: "", institution: "", year: "", detail: "" });
  const [newCertification, setNewCertification] = useState("");
  const [newAchievement, setNewAchievement] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newProject, setNewProject] = useState({ title: "", category: "Other", description: "", technologies: "", github: "" });
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoError, setPhotoError] = useState("");

  // Server-managed editor authentication.
  const [authPassword, setAuthPassword] = useState("");
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [recoveryQuestion, setRecoveryQuestion] = useState("");
  const [recoveryAnswer, setRecoveryAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetMethod, setResetMethod] = useState<"choose" | "email" | "question">("choose");
  const [resetQuestion, setResetQuestion] = useState("");
  const [resetAnswer, setResetAnswer] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetMode, setResetMode] = useState(false);

  // GitHub Push State
  const [pushStatus, setPushStatus] = useState<"idle" | "pushing" | "success" | "error">("idle");
  const [pushMessage, setPushMessage] = useState("");

  // Restore the visitor's appearance preferences before saving new selections.
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("suresh-theme");
      if (savedTheme === "dark" || savedTheme === "light") setDark(savedTheme === "dark");

      const savedStyle = localStorage.getItem("suresh-theme-style");
      if (themeOptions.some(option => option.value === savedStyle)) {
        setThemeStyle(savedStyle as ThemeStyle);
      }
    } catch {}
    setThemePreferencesLoaded(true);
  }, []);

  // Load local editing drafts and establish the server session.
  useEffect(() => {
    try {
      const keys = ["profile", "experience", "skills", "software", "tools", "engagements", "education", "certifications", "projects"];
      const setters = [setProfileData, setExpList, setSkillsList, setSoftwareList, setToolsList, setEngagementList, setEducationList, setCertificationList, setProjectList] as Array<(value: any) => void>;
      keys.forEach((key, index) => { const value = localStorage.getItem(`sg_edited_${key}`); if (value) setters[index](JSON.parse(value)); });
      ["sg_github_token", "sg_auth_key", "sg_recovery_questions", "sg_recovery_code"].forEach(key => localStorage.removeItem(key));
    } catch {}
    void apiJson("/api/auth/session").then(data => setIsEditor(data.authenticated === true)).catch(() => setIsEditor(false));
    const match = window.location.hash.match(/^#reset=(.+)$/);
    if (match) {
      const token = decodeURIComponent(match[1]);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setResetToken(token); setResetMethod("email"); setResetMode(true);
      void apiJson("/api/auth/reset/challenge", { method: "POST", body: JSON.stringify({ token }) }).then(data => setResetQuestion(data.question || "")).catch(error => setResetMessage(error.message));
    }
  }, []);

  const totalExperienceFormatted = useMemo(() => {
    return calculateTotalExperience(expList);
  }, [expList]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.themeStyle = themeStyle;

    if (!themePreferencesLoaded) return;
    try {
      localStorage.setItem("suresh-theme", dark ? "dark" : "light");
      localStorage.setItem("suresh-theme-style", themeStyle);
    } catch {}
  }, [dark, themeStyle, themePreferencesLoaded]);

  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoPreview("");
      return;
    }
    const previewUrl = URL.createObjectURL(selectedPhoto);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedPhoto]);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0);
      setShowTop(window.scrollY > 700);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`https://api.github.com/users/${profileData.githubUsername || defaultProfile.githubUsername}/repos?sort=updated&per_page=6`, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" }
    })
      .then(r => {
        if (!r.ok) throw new Error("GitHub API unavailable");
        return r.json();
      })
      .then((data: GithubRepo[]) => {
        if (controller.signal.aborted) return;
        setRepos(data.filter(r => !r.fork));
        setRepoStatus("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;

        // Keep featured, verified repository links visible if GitHub's API is
        // unavailable or rate-limited for a visitor.
        const fallbackRepos = defaultProjects
          .filter(project => project.github)
          .map((project, index) => ({
            id: -(index + 1),
            name: project.github.split("/").filter(Boolean).pop() || project.title,
            html_url: project.github,
            description: project.description,
            language: project.technologies[0] || null,
            stargazers_count: 0,
            updated_at: "",
            fork: false
          }));
        setRepos(fallbackRepos);
        setRepoStatus("fallback");
      });
    return () => controller.abort();
  }, [profileData.githubUsername]);

  const filtered = useMemo(() => {
    if (filter === "All") return projectList;
    return projectList.filter(p => p.category === filter);
  }, [filter, projectList]);

  const availableProjectFilters = useMemo(() => [
    "All",
    ...Array.from(new Set([...projectFilters.slice(1), ...projectList.map(project => project.category).filter(Boolean)]))
  ], [projectList]);

  const handleEditModeToggle = async () => {
    if (isEditor) { await apiJson("/api/auth/logout", { method: "POST" }).catch(() => undefined); setIsEditor(false); }
    else { setAuthError(""); setShowAuthModal(true); }
  };
  const handleAuthSubmit = async () => {
    setAuthError("");
    try { await apiJson("/api/auth/login", { method: "POST", body: JSON.stringify({ password: authPassword }) }); setIsEditor(true); setShowAuthModal(false); setAuthPassword(""); }
    catch (error: any) { setAuthError(error.message || "Sign in failed."); }
  };
  const openEditorSettings = async () => {
    setSettingsMessage("");
    try { const data = await apiJson("/api/auth/recovery-question"); setRecoveryQuestion(data.question || ""); }
    catch (error: any) { setSettingsMessage(error.message); }
    setShowSettingsModal(true);
  };
  const saveRecoveryQuestion = async () => {
    setSettingsMessage("");
    try { await apiJson("/api/auth/recovery-question", { method: "PUT", body: JSON.stringify({ question: recoveryQuestion, answer: recoveryAnswer }) }); setRecoveryAnswer(""); setSettingsMessage("Recovery question saved."); }
    catch (error: any) { setSettingsMessage(error.message); }
  };
  const changeAdminPassword = async () => {
    setSettingsMessage("");
    if (newPassword !== confirmPassword) { setSettingsMessage("The passwords do not match."); return; }
    try { await apiJson("/api/auth/password", { method: "POST", body: JSON.stringify({ currentPassword: currentPasswordInput, newPassword }) }); setCurrentPasswordInput(""); setNewPassword(""); setConfirmPassword(""); setSettingsMessage("Password updated."); }
    catch (error: any) { setSettingsMessage(error.message); }
  };
  const requestPasswordReset = async () => {
    setResetMessage("");
    setResetMethod("email");
    try { await apiJson("/api/auth/reset/request", { method: "POST", body: JSON.stringify({}) }); setResetMessage("If email reset is configured, a reset link has been sent."); }
    catch (error: any) { setResetMessage(error.message); }
  };
  const chooseQuestionRecovery = async () => {
    setResetMessage("");
    try {
      const data = await apiJson("/api/auth/reset/question");
      setResetQuestion(data.question || "");
      setResetMethod("question");
    } catch (error: any) { setResetMessage(error.message); }
  };
  const completePasswordReset = async () => {
    setResetMessage("");
    if (resetPassword !== resetConfirmPassword) { setResetMessage("The passwords do not match."); return; }
    const path = resetToken ? "/api/auth/reset/complete" : "/api/auth/reset/security";
    const body = resetToken
      ? { token: resetToken, answer: resetAnswer, newPassword: resetPassword }
      : { answer: resetAnswer, newPassword: resetPassword };
    try { await apiJson(path, { method: "POST", body: JSON.stringify(body) }); setResetMessage("Password reset. You can now sign in."); setResetMode(false); setResetToken(""); setResetAnswer(""); setResetPassword(""); setResetConfirmPassword(""); }
    catch (error: any) { setResetMessage(error.message); }
  };

  const addListItem = (
    value: string,
    items: string[],
    updateItems: (nextItems: string[]) => void,
    clearInput: () => void
  ) => {
    const item = value.trim();
    if (!item || items.some(existing => existing.toLowerCase() === item.toLowerCase())) return;
    updateItems([...items, item]);
    clearInput();
  };

  const updateProfileTextList = (key: "achievements" | "regions" | "phones", nextItems: string[]) => {
    setProfileData({ ...profileData, [key]: nextItems });
  };

  // Save changes locally
  const saveLocalChanges = () => {
    try {
      localStorage.setItem("sg_edited_profile", JSON.stringify(profileData));
      localStorage.setItem("sg_edited_experience", JSON.stringify(expList));
      localStorage.setItem("sg_edited_skills", JSON.stringify(skillsList));
      localStorage.setItem("sg_edited_software", JSON.stringify(softwareList));
      localStorage.setItem("sg_edited_tools", JSON.stringify(toolsList));
      localStorage.setItem("sg_edited_engagements", JSON.stringify(engagementList));
      localStorage.setItem("sg_edited_education", JSON.stringify(educationList));
      localStorage.setItem("sg_edited_certifications", JSON.stringify(certificationList));
      localStorage.setItem("sg_edited_projects", JSON.stringify(projectList));
      alert("✅ Changes saved to your browser! Click 'Push to GitHub' to publish them live.");
    } catch (e) {
      alert("Error saving locally.");
    }
  };

  // Add new experience
  const handleAddExperience = () => {
    const newExp: ExperienceItem = {
      company: "NEW COMPANY NAME",
      role: "Job Title / Role",
      location: "Location",
      dates: "Month Year – Present",
      startDate: new Date().toISOString().split("T")[0],
      endDate: null,
      bullets: ["Enter key achievements and responsibilities here."]
    };
    setExpList([newExp, ...expList]);
    setOpen(0);
  };

  // Publish updates through the authenticated Pages Function; the GitHub credential stays server-side.
  const pushToGitHub = async () => {
    if (!isEditor) { setShowAuthModal(true); return; }
    setPushStatus("pushing"); setPushMessage("Preparing your profile, photo, and resume...");
    try {
      const profileForPublish = selectedPhoto ? { ...profileData, profilePhotoVersion: Date.now() } : profileData;
      const updatedCode = `export const profile = ${JSON.stringify(profileForPublish, null, 2)} as const;\n\nexport type ExperienceItem = {\n  company: string;\n  role: string;\n  location: string;\n  dates: string;\n  startDate: string;\n  endDate: string | null;\n  bullets: string[];\n};\n\nexport const experience: ExperienceItem[] = ${JSON.stringify(expList, null, 2)};\n\nexport const engagements = ${JSON.stringify(engagementList, null, 2)};\n\nexport const skills = ${JSON.stringify(skillsList, null, 2)};\n\nexport const software = ${JSON.stringify(softwareList, null, 2)};\n\nexport const tools = ${JSON.stringify(toolsList, null, 2)};\n\nexport const education = ${JSON.stringify(educationList, null, 2)};\n\nexport const certifications = ${JSON.stringify(certificationList, null, 2)};\n\nexport const projects = ${JSON.stringify(projectList, null, 2)};\n`;
      const photoData = selectedPhoto ? await pngDataFromBlob(selectedPhoto) : await loadCurrentPhotoData();
      const resumeBytes = await generateResumePdf({ profile: profileForPublish, experience: expList, skills: skillsList, software: softwareList, tools: toolsList, engagements: engagementList, education: educationList, certifications: certificationList, projects: projectList }, photoData.dataUrl);
      const files: Array<{ path: string; bytes: Uint8Array }> = [{ path: "src/data/profile.ts", bytes: new TextEncoder().encode(updatedCode) }, { path: "public/resume.pdf", bytes: resumeBytes }];
      if (selectedPhoto) files.push({ path: "public/profile-photo.png", bytes: base64ToBytes(photoData.base64) });
      setPushMessage("Publishing the files through the server...");
      await apiJson("/api/editor/publish", { method: "POST", body: JSON.stringify({ files: files.map(file => ({ path: file.path, contentBase64: bytesToBase64(file.bytes) })) }) });
      setProfileData(profileForPublish);
      try {
        localStorage.setItem("sg_edited_profile", JSON.stringify(profileForPublish)); localStorage.setItem("sg_edited_experience", JSON.stringify(expList)); localStorage.setItem("sg_edited_skills", JSON.stringify(skillsList)); localStorage.setItem("sg_edited_software", JSON.stringify(softwareList)); localStorage.setItem("sg_edited_tools", JSON.stringify(toolsList)); localStorage.setItem("sg_edited_engagements", JSON.stringify(engagementList)); localStorage.setItem("sg_edited_education", JSON.stringify(educationList)); localStorage.setItem("sg_edited_certifications", JSON.stringify(certificationList)); localStorage.setItem("sg_edited_projects", JSON.stringify(projectList));
      } catch {}
      setPushStatus("success"); setPushMessage(`Published the profile and matching resume${selectedPhoto ? ", including your new photo" : ""}. Cloudflare Pages will rebuild the site.`);
    } catch (error: any) { setPushStatus("error"); setPushMessage(`Publish failed: ${error.message}`); }
  };

  return (
    <main id="top">
      <div className="scrollProgress" style={{ width: `${progress}%` }} aria-hidden="true" />

      {/* Navigation */}
      <header className="nav">
        <a className="brand" href="#top" aria-label="Suresh Ganesan home">
          SG<span>.</span>
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {nav.map(([id, label]) => (
            <a key={id} href={`#${id}`}>{label}</a>
          ))}
        </nav>
        <div className="navActions">
          <button onClick={() => setDark(!dark)} aria-label="Toggle dark and light mode">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <select
            className="theme-select"
            value={themeStyle}
            onChange={e => setThemeStyle(e.target.value as ThemeStyle)}
            aria-label="Choose website color theme"
          >
            {themeOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            className="editor-toggle-btn"
            onClick={handleEditModeToggle}
            aria-label={isEditor ? "Exit editor" : "Enter edit mode"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: isEditor ? "var(--accent)" : "var(--panel)",
              color: isEditor ? "var(--on-accent)" : "var(--accent)",
              fontWeight: 800,
              fontSize: "13px",
              borderColor: "var(--accent)"
            }}
          >
            {isEditor ? <Unlock size={15} /> : <Lock size={15} />}
            <span className="editor-toggle-label">{isEditor ? "Exit Editor" : "Edit Mode"}</span>
          </button>
          <button
            className="recruiterBtn"
            onClick={() => setRecruiter(true)}
            aria-label="Open 30-Second Profile"
            title="30-Second Profile"
          >
            <UserRound className="recruiterBtn-icon" size={15} />
            <span className="recruiterBtn-label">30-Second Profile</span>
          </button>
          <button
            className="editor-settings-btn"
            onClick={() => void openEditorSettings()}
            aria-label="Editor settings"
            title="Editor settings"
          >
            <Settings size={16} />
          </button>
          <button className="mobileOnly" onClick={() => setMobile(!mobile)} aria-label="Open mobile navigation">
            {mobile ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Editor Control Bar */}
      <AnimatePresence>
        {isEditor && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: "sticky",
              top: "80px",
              zIndex: 45,
              background: "linear-gradient(135deg, var(--panel-hover), var(--bg))",
              backdropFilter: "blur(20px)",
              borderBottom: "1px solid var(--accent)",
              padding: "12px 5vw",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "var(--accent)", fontWeight: 800, fontSize: "14px" }}>
                ⚙️ LIVE ADMIN & EDITOR MODE
              </span>
              <span style={{ color: "var(--muted)", fontSize: "12px" }}>
                Edit fields and publish directly to GitHub!
              </span>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                onClick={handleAddExperience}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  background: "var(--accent-soft)",
                  border: "1px solid var(--accent)",
                  borderRadius: "10px",
                  color: "var(--accent)",
                  fontSize: "13px",
                  fontWeight: 700
                }}
              >
                <Plus size={15} /> Add Experience
              </button>
              <button
                onClick={saveLocalChanges}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  color: "var(--text)",
                  fontSize: "13px",
                  fontWeight: 700
                }}
              >
                <Save size={15} /> Save Locally
              </button>
              <button
                onClick={pushToGitHub}
                disabled={pushStatus === "pushing"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                  border: 0,
                  borderRadius: "10px",
                  color: "var(--on-accent)",
                  fontSize: "13px",
                  fontWeight: 800
                }}
              >
                <Sparkles size={15} /> Push to GitHub 🚀
              </button>
              <button
                onClick={() => void openEditorSettings()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  color: "var(--muted)",
                  fontSize: "13px"
                }}
              >
                <Key size={14} /> Editor Settings
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Push Status Banner */}
      {pushStatus !== "idle" && (
        <div style={{
          padding: "16px 5vw",
          background: pushStatus === "success" ? "rgba(16, 185, 129, 0.2)" : pushStatus === "error" ? "rgba(239, 68, 68, 0.2)" : "var(--accent-soft)",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
            {pushStatus === "pushing" && <RefreshCw size={18} className="animate-spin" style={{ color: "var(--accent)" }} />}
            {pushStatus === "success" && <CheckCircle size={18} style={{ color: "var(--emerald)" }} />}
            {pushStatus === "error" && <AlertCircle size={18} style={{ color: "#ef4444" }} />}
            <strong>{pushMessage}</strong>
          </div>
          <button onClick={() => setPushStatus("idle")}><X size={16} /></button>
        </div>
      )}

      {/* Hero Bento Grid */}
      <section className="hero-section">
        <div className="bento-hero-grid">
          <div className="bento-card hero-main">
            <div>
              <span className="eyebrow">SUPPLY CHAIN • PROCUREMENT • PROJECTS</span>

              {isEditor ? (
                <div style={{ marginTop: "1rem", display: "grid", gap: "10px" }}>
                  <input
                    style={{ fontSize: "32px", fontWeight: 900, background: "var(--bg)", border: "1px solid var(--accent)", color: "var(--text)", padding: "8px 12px", borderRadius: "8px" }}
                    value={profileData.name}
                    onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                  />
                  <input
                    style={{ fontSize: "18px", fontWeight: 700, background: "var(--bg)", border: "1px solid var(--line)", color: "var(--accent)", padding: "6px 12px", borderRadius: "8px" }}
                    value={profileData.title}
                    onChange={e => setProfileData({ ...profileData, title: e.target.value })}
                  />
                  <textarea
                    style={{ fontSize: "14px", background: "var(--bg)", border: "1px solid var(--line)", color: "var(--muted)", padding: "8px 12px", borderRadius: "8px" }}
                    rows={2}
                    value={profileData.tagline}
                    onChange={e => setProfileData({ ...profileData, tagline: e.target.value })}
                  />
                </div>
              ) : (
                <>
                  <h1 className="hero-title">{profileData.name}</h1>
                  <h2 className="hero-subtitle">{profileData.title}</h2>
                  <p className="hero-tagline">{profileData.tagline}</p>
                </>
              )}
            </div>
            <div>
              <div className="hero-btns">
                <a className="secondary-btn" href="#projects">
                  View Projects <ArrowUpRight size={17} />
                </a>
              </div>
              <div style={{ display: "flex", gap: "1.5rem", marginTop: "2rem", flexWrap: "wrap" }}>
                <a href={profileData.linkedin} target="_blank" rel="noreferrer" style={{ display: "flex", gap: "8px", alignItems: "center", color: "var(--muted)", fontSize: "13px", fontWeight: 600 }}>
                  <Linkedin size={16} /> LinkedIn
                </a>
                <a href={profileData.github} target="_blank" rel="noreferrer" style={{ display: "flex", gap: "8px", alignItems: "center", color: "var(--muted)", fontSize: "13px", fontWeight: 600 }}>
                  <Github size={16} /> GitHub
                </a>
                <a href={`mailto:${profileData.email}`} style={{ display: "flex", gap: "8px", alignItems: "center", color: "var(--muted)", fontSize: "13px", fontWeight: 600 }}>
                  <Mail size={16} /> Email
                </a>
              </div>
            </div>
          </div>

          <div className="bento-card hero-sidebar">
            <img className="profile-photo" src={photoPreview || `${BASE}/profile-photo.png?v=${profileData.profilePhotoVersion || "1"}`} alt={`${profileData.name} professional portrait`} loading="eager" />
            {isEditor && (
              <div className="editor-photo-upload">
                <label htmlFor="profile-photo-upload">Replace profile photo</label>
                <input
                  id="profile-photo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
                      setPhotoError("Choose a PNG, JPEG, or WebP image.");
                      setSelectedPhoto(null);
                      event.target.value = "";
                      return;
                    }
                    if (file.size > 10 * 1024 * 1024) {
                      setPhotoError("Choose an image smaller than 10 MB.");
                      setSelectedPhoto(null);
                      event.target.value = "";
                      return;
                    }
                    setPhotoError("");
                    setSelectedPhoto(file);
                  }}
                />
                <small>Preview only. The photo and matching resume publish when you click Push to GitHub.</small>
                {photoError && <span role="alert">{photoError}</span>}
              </div>
            )}

            <div className="profile-stat">
              <span>Location</span>
              {isEditor ? (
                <input
                  style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--text)", padding: "4px 8px", borderRadius: "6px", fontSize: "13px" }}
                  value={profileData.location}
                  onChange={e => setProfileData({ ...profileData, location: e.target.value })}
                />
              ) : (
                <strong>{profileData.location}</strong>
              )}
            </div>

            {/* TOTAL EXPERIENCE IN YEARS & MONTHS */}
            <div className="profile-stat" style={{ background: "var(--accent-soft)", padding: "12px", borderRadius: "12px", margin: "6px 0", border: "1px solid var(--line)" }}>
              <span style={{ color: "var(--accent)" }}>Total Experience</span>
              <strong style={{ color: "var(--accent)", fontSize: "15px" }}>{totalExperienceFormatted}</strong>
            </div>

            <div className="profile-stat">
              <span>Global Reach</span>
              <strong>{profileData.regions?.length || 6}+ Countries</strong>
            </div>
          </div>
        </div>

        {/* Metrics Strip */}
        <div className="metrics-grid">
          <div className="metric-card">
            <strong>1800 Million</strong>
            <span>Modernization & Expansion Project (MEP)</span>
          </div>
          <div className="metric-card">
            <strong>1200 Million</strong>
            <span>AOP (CAPEX & Civil projects)</span>
          </div>
          <div className="metric-card">
            <strong>500 Million</strong>
            <span>Naidupeta AP fire-damage restoration</span>
          </div>
          <div className="metric-card">
            <strong>35+ / Awards</strong>
            <span>Kaizens & QCFI Gold / Best Employee</span>
          </div>
        </div>
      </section>

      {/* About Bento Section */}
      <Section id="about" eyebrow="01 / ABOUT ME" title="Commercial thinking, technical depth, operational discipline.">
        <div className="bento-grid-2">
          <div className="bento-card col-7">
            <span className="eyebrow">Professional Summary</span>
            {isEditor ? (
              <textarea
                style={{ width: "100%", marginTop: "1rem", background: "var(--bg)", border: "1px solid var(--line)", color: "var(--text)", padding: "12px", borderRadius: "10px", fontSize: "15px", lineHeight: 1.6 }}
                rows={5}
                value={profileData.summary}
                onChange={e => setProfileData({ ...profileData, summary: e.target.value })}
              />
            ) : (
              <p className="lead-text" style={{ marginTop: "1rem" }}>{profileData.summary}</p>
            )}
            <div className="pill-cloud" style={{ marginTop: "1.5rem" }}>
              {profileData.regions?.map((region: string) => (
                <span key={region}>🌍 {region}</span>
              ))}
            </div>
            {isEditor && <form className="editor-list-add" onSubmit={event => {
              event.preventDefault();
              addListItem(newRegion, profileData.regions || [], items => updateProfileTextList("regions", items), () => setNewRegion(""));
            }}>
              <input value={newRegion} onChange={event => setNewRegion(event.target.value)} placeholder="Add a region" aria-label="New region" />
              <button className="secondary-btn" type="submit"><Plus size={15} /> Add region</button>
            </form>}
          </div>
          <div className="bento-card col-5">
            <span className="eyebrow">Quick Facts</span>
            <div className="fact-subgrid" style={{ marginTop: "1rem" }}>
              <div className="mini-fact">
                <span>Industry</span>
                <strong>Manufacturing & SCM</strong>
              </div>
              <div className="mini-fact">
                <span>Qualification</span>
                <strong>B.E. Mechanical</strong>
              </div>
              <div className="mini-fact">
                <span>Core Domain</span>
                <strong>Technical Procurement</strong>
              </div>
              <div className="mini-fact">
                <span>Languages</span>
                <strong>Tamil & English</strong>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Career Journey */}
      <Section id="journey" eyebrow="02 / CAREER JOURNEY" title="A procurement career built around projects, suppliers and delivery.">
        <div className="timeline-container">
          {expList.map((e, i) => (
            <motion.div className="timeline-card" key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="timeline-header">
                <div style={{ width: "100%" }}>
                  {isEditor ? (
                    <div style={{ display: "grid", gap: "8px", width: "100%", paddingRight: "1rem" }}>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", color: "var(--muted)" }}>Start Date:</span>
                        <input
                          type="date"
                          style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--accent)", padding: "4px 8px", borderRadius: "6px" }}
                          value={e.startDate || ""}
                          onChange={ev => {
                            const updated = [...expList];
                            updated[i].startDate = ev.target.value;
                            setExpList(updated);
                          }}
                        />
                        <span style={{ fontSize: "12px", color: "var(--muted)" }}>End Date:</span>
                        <input
                          type="date"
                          style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--accent)", padding: "4px 8px", borderRadius: "6px" }}
                          value={e.endDate || ""}
                          onChange={ev => {
                            const updated = [...expList];
                            updated[i].endDate = ev.target.value.trim() === "" ? null : ev.target.value;
                            setExpList(updated);
                          }}
                        />
                        <button
                          style={{ fontSize: "11px", color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid var(--line)", padding: "2px 8px", borderRadius: "4px" }}
                          onClick={() => {
                            const updated = [...expList];
                            updated[i].endDate = null;
                            setExpList(updated);
                          }}
                        >
                          Set Present
                        </button>
                      </div>
                      <input
                        style={{ fontSize: "18px", fontWeight: 800, background: "var(--bg)", border: "1px solid var(--line)", color: "var(--text)", padding: "6px 10px", borderRadius: "8px" }}
                        value={e.role}
                        placeholder="Job Title"
                        onChange={ev => {
                          const updated = [...expList];
                          updated[i].role = ev.target.value;
                          setExpList(updated);
                        }}
                      />
                      <div style={{ display: "flex", gap: "10px" }}>
                        <input
                          style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--line)", color: "var(--muted)", padding: "4px 8px", borderRadius: "6px" }}
                          value={e.company}
                          placeholder="Company"
                          onChange={ev => {
                            const updated = [...expList];
                            updated[i].company = ev.target.value;
                            setExpList(updated);
                          }}
                        />
                        <input
                          style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--line)", color: "var(--muted)", padding: "4px 8px", borderRadius: "6px" }}
                          value={e.location}
                          placeholder="Location"
                          onChange={ev => {
                            const updated = [...expList];
                            updated[i].location = ev.target.value;
                            setExpList(updated);
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => setOpen(open === i ? -1 : i)} style={{ cursor: "pointer" }}>
                      <span className="date-badge">{e.dates} <span style={{ opacity: 0.7 }}>• {calculateDuration(e.startDate, e.endDate)}</span></span>
                      <h3>{e.role}</h3>
                      <p>{e.company} · {e.location}</p>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {isEditor && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${e.company}?`)) {
                          setExpList(expList.filter((_, idx) => idx !== i));
                        }
                      }}
                      style={{ color: "#ef4444", padding: "8px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "8px" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button onClick={() => setOpen(open === i ? -1 : i)}>
                    <ChevronDown size={20} style={{ transform: open === i ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {open === i && (
                  <motion.div className="timeline-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    {isEditor ? (
                      <div style={{ marginTop: "1rem", display: "grid", gap: "8px" }}>
                        <span style={{ fontSize: "12px", color: "var(--muted)" }}>Responsibilities (one per line):</span>
                        <textarea
                          style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--line)", color: "var(--text)", padding: "10px", borderRadius: "8px", fontSize: "13px", lineHeight: 1.6 }}
                          rows={6}
                          value={e.bullets.join("\n")}
                          onChange={ev => {
                            const updated = [...expList];
                            updated[i].bullets = ev.target.value.split("\n");
                            setExpList(updated);
                          }}
                        />
                      </div>
                    ) : (
                      <ul>
                        {e.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Core Expertise */}
      <Section id="expertise" eyebrow="03 / CORE EXPERTISE" title="The operating system behind the work.">
        <div className="bento-grid-2">
          <div className="bento-card col-12">
            <span className="eyebrow">Procurement & SCM Competencies</span>
            <div className="pill-cloud" style={{ marginTop: "1.25rem" }}>
              {skillsList.map((s, idx) => (
                <span key={idx}>
                  {s}
                  {isEditor && (
                    <button
                      type="button"
                      onClick={() => setSkillsList(skillsList.filter((_, i) => i !== idx))}
                      aria-label={`Remove competency ${s}`}
                      style={{ marginLeft: "6px", color: "#ef4444" }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {isEditor && (
              <form
                className="editor-list-add"
                onSubmit={event => {
                  event.preventDefault();
                  addListItem(newSkill, skillsList, setSkillsList, () => setNewSkill(""));
                }}
              >
                <input value={newSkill} onChange={event => setNewSkill(event.target.value)} placeholder="Add a competency" aria-label="New competency" />
                <button className="secondary-btn" type="submit"><Plus size={15} /> Add</button>
              </form>
            )}
          </div>
          <div className="bento-card col-6" style={{ gridColumn: "span 6" }}>
            <span className="eyebrow">Software Systems</span>
            <div className="pill-cloud" style={{ marginTop: "1.25rem" }}>
              {softwareList.map((software, idx) => (
                <span key={`${software}-${idx}`} style={{ background: "var(--surface-soft)" }}>
                  💻 {software}
                  {isEditor && <button type="button" onClick={() => setSoftwareList(softwareList.filter((_, i) => i !== idx))} aria-label={`Remove software ${software}`} style={{ marginLeft: "6px", color: "#ef4444" }}><X size={13} /></button>}
                </span>
              ))}
            </div>
            {isEditor && (
              <form
                className="editor-list-add"
                onSubmit={event => {
                  event.preventDefault();
                  addListItem(newSoftware, softwareList, setSoftwareList, () => setNewSoftware(""));
                }}
              >
                <input value={newSoftware} onChange={event => setNewSoftware(event.target.value)} placeholder="Add software" aria-label="New software" />
                <button className="secondary-btn" type="submit"><Plus size={15} /> Add</button>
              </form>
            )}
          </div>
          <div className="bento-card col-6" style={{ gridColumn: "span 6" }}>
            <span className="eyebrow">Tools & Platforms</span>
            <div className="pill-cloud" style={{ marginTop: "1.25rem" }}>
              {toolsList.map((tool, idx) => (
                <span key={`${tool}-${idx}`} style={{ background: "var(--surface-soft)" }}>
                  🛠️ {tool}
                  {isEditor && <button type="button" onClick={() => setToolsList(toolsList.filter((_, i) => i !== idx))} aria-label={`Remove tool ${tool}`} style={{ marginLeft: "6px", color: "#ef4444" }}><X size={13} /></button>}
                </span>
              ))}
            </div>
            {isEditor && (
              <form
                className="editor-list-add"
                onSubmit={event => {
                  event.preventDefault();
                  addListItem(newTool, toolsList, setToolsList, () => setNewTool(""));
                }}
              >
                <input value={newTool} onChange={event => setNewTool(event.target.value)} placeholder="Add a tool or platform" aria-label="New tool or platform" />
                <button className="secondary-btn" type="submit"><Plus size={15} /> Add</button>
              </form>
            )}
          </div>
        </div>
      </Section>

      {/* Achievements */}
      <Section id="achievements" eyebrow="04 / ACHIEVEMENTS & RECOGNITION" title="Documented outcomes and industry recognition.">
        <div className="achievements-grid">
          {profileData.achievements?.map((a: string, i: number) => (
            <motion.div className="achievement-bento" key={a} whileHover={{ y: -5 }}>
              <span>0{i + 1} // AWARD</span>
              <p>{a}</p>
              {isEditor && <button type="button" onClick={() => updateProfileTextList("achievements", profileData.achievements.filter((_: string, index: number) => index !== i))} aria-label={`Remove achievement ${a}`} style={{ color: "#ef4444" }}><Trash2 size={15} /> Remove</button>}
            </motion.div>
          ))}
        </div>
        {isEditor && <form className="editor-list-add" onSubmit={event => {
          event.preventDefault();
          addListItem(newAchievement, profileData.achievements || [], items => updateProfileTextList("achievements", items), () => setNewAchievement(""));
        }}>
          <input value={newAchievement} onChange={event => setNewAchievement(event.target.value)} placeholder="Add an achievement or recognition" aria-label="New achievement" />
          <button className="secondary-btn" type="submit"><Plus size={15} /> Add achievement</button>
        </form>}
      </Section>

      {/* Projects */}
      <Section id="projects" eyebrow="05 / PROJECTS & ENGAGEMENTS" title="Selected project engagements and verified public work.">
        <div className="filter-tabs" role="tablist" aria-label="Project filters">
          {availableProjectFilters.map(f => (
            <button role="tab" aria-selected={filter === f} className={`filter-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)} key={f}>
              {f}
            </button>
          ))}
        </div>
        <div className="projects-grid">
          {filtered.length ? filtered.map(p => (
            <article className="project-card" key={`${p.title}-${p.github}`}>
              <div>
                <div className="project-top">
                  <span>{p.category}</span>
                  <ArrowUpRight size={18} />
                </div>
                {isEditor && <button type="button" onClick={() => setProjectList(projectList.filter(project => project !== p))} aria-label={`Remove project ${p.title}`} style={{ float: "right", color: "#ef4444" }}><Trash2 size={15} /> Remove</button>}
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <div className="project-tags">
                  {p.technologies.map(t => <span key={t}>{t}</span>)}
                </div>
              </div>
              {p.github && (
                <a href={p.github} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--accent)", fontSize: "13px", fontWeight: 700 }}>
                  View Repository <ExternalLink size={14} />
                </a>
              )}
            </article>
          )) : (
            <div className="bento-card" style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--muted)" }}>
              No resume-verified project has been documented for this filter yet.
            </div>
          )}
        </div>
        {isEditor && <form className="editor-project-form" onSubmit={event => {
          event.preventDefault();
          if (!newProject.title.trim() || !newProject.description.trim()) return;
          setProjectList([...projectList, {
            title: newProject.title.trim(),
            category: newProject.category.trim() || "Other",
            description: newProject.description.trim(),
            technologies: newProject.technologies.split(",").map(item => item.trim()).filter(Boolean),
            github: newProject.github.trim()
          }]);
          setNewProject({ title: "", category: "Other", description: "", technologies: "", github: "" });
          setFilter("All");
        }}>
          <span className="eyebrow">Add a Project</span>
          <div className="editor-project-fields">
            <input value={newProject.title} onChange={event => setNewProject({ ...newProject, title: event.target.value })} placeholder="Project title" aria-label="Project title" required />
            <input value={newProject.category} onChange={event => setNewProject({ ...newProject, category: event.target.value })} placeholder="Category" aria-label="Project category" />
            <input value={newProject.github} onChange={event => setNewProject({ ...newProject, github: event.target.value })} placeholder="Project or repository URL (optional)" aria-label="Project URL" type="url" />
            <input value={newProject.technologies} onChange={event => setNewProject({ ...newProject, technologies: event.target.value })} placeholder="Skills / tools, separated by commas" aria-label="Project technologies" />
            <textarea value={newProject.description} onChange={event => setNewProject({ ...newProject, description: event.target.value })} placeholder="Short project description" aria-label="Project description" rows={3} required />
          </div>
          <button className="secondary-btn" type="submit"><Plus size={15} /> Add project</button>
        </form>}
        <div className="bento-card" style={{ marginTop: "1.5rem" }}>
          <span className="eyebrow">Project Engagements</span>
          <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
            {engagementList.map((engagement, index) => (
              <div key={`${engagement}-${index}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", padding: "0.8rem 1rem", borderRadius: "10px", background: "var(--surface-soft)" }}>
                <span>{engagement}</span>
                {isEditor && <button type="button" onClick={() => setEngagementList(engagementList.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove engagement ${engagement}`} style={{ color: "#ef4444", flexShrink: 0 }}><X size={15} /></button>}
              </div>
            ))}
          </div>
          {isEditor && <form className="editor-list-add" onSubmit={event => {
            event.preventDefault();
            addListItem(newEngagement, engagementList, setEngagementList, () => setNewEngagement(""));
          }}>
            <input value={newEngagement} onChange={event => setNewEngagement(event.target.value)} placeholder="Add a project engagement" aria-label="New project engagement" />
            <button className="secondary-btn" type="submit"><Plus size={15} /> Add engagement</button>
          </form>}
        </div>
      </Section>

      {/* GitHub Section */}
      <Section id="github" eyebrow="06 / GITHUB ACTIVITY" title="Public repository activity and code contributions.">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <p style={{ color: "var(--muted)", maxWidth: "600px", margin: 0 }}>
            Repositories are loaded live from GitHub's public API for user <strong>{profileData.githubUsername}</strong>.
          </p>
          <a className="secondary-btn" href={profileData.githubProfile} target="_blank" rel="noreferrer">
            <Github size={16} /> Open GitHub Profile
          </a>
        </div>
        {repoStatus === "loading" && <div className="bento-card" style={{ textAlign: "center", color: "var(--muted)" }}>Loading public repositories…</div>}
        {repoStatus === "fallback" && <div className="bento-card" style={{ textAlign: "center", color: "var(--muted)", marginBottom: "1rem" }}>Live GitHub data is unavailable; showing featured repositories.</div>}
        {(repoStatus === "ready" || repoStatus === "fallback") && (
          <div className="repo-grid">
            {repos.length ? repos.map(r => (
              <a className="repo-card" href={r.html_url} target="_blank" rel="noreferrer" key={r.id}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--accent)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                    <span>{r.language || "Public Repository"}</span>
                    <Github size={16} />
                  </div>
                  <h3>{r.name}</h3>
                  <p>{r.description || "No public description supplied."}</p>
                </div>
                <small style={{ color: "var(--muted)", fontSize: "12px" }}>★ {r.stargazers_count}{r.updated_at ? ` · Updated ${new Date(r.updated_at).toLocaleDateString()}` : " · Featured project"}</small>
              </a>
            )) : (
              <div className="bento-card" style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--muted)" }}>No public repositories were returned by the GitHub API.</div>
            )}
          </div>
        )}
      </Section>

      {/* Education */}
      <Section id="education" eyebrow="07 / EDUCATION & CERTIFICATIONS" title="Engineering foundation and continuous professional training.">
        <div className="bento-grid-2">
          <div className="bento-card col-7">
            <span className="eyebrow">Academic Background</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1.5rem" }}>
              {educationList.map((e, index) => (
                <div key={`${e.degree}-${index}`} style={{ paddingBottom: "1.25rem", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent)" }}>{e.year}</span>
                  <h3 style={{ fontSize: "18px", fontWeight: 800, margin: "4px 0" }}>{e.degree}</h3>
                  <p style={{ color: "var(--muted)", margin: 0, fontSize: "14px" }}>{e.institution}</p>
                  <strong style={{ fontSize: "13px", marginTop: "4px", display: "block" }}>{e.detail}</strong>
                  {isEditor && <button type="button" onClick={() => setEducationList(educationList.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove education ${e.degree}`} style={{ marginTop: "8px", color: "#ef4444" }}><Trash2 size={14} /> Remove</button>}
                </div>
              ))}
            </div>
            {isEditor && <form className="editor-project-form" onSubmit={event => {
              event.preventDefault();
              if (!newEducation.degree.trim() || !newEducation.institution.trim()) return;
              setEducationList([...educationList, { ...newEducation, degree: newEducation.degree.trim(), institution: newEducation.institution.trim(), year: newEducation.year.trim(), detail: newEducation.detail.trim() }]);
              setNewEducation({ degree: "", institution: "", year: "", detail: "" });
            }}>
              <span className="eyebrow">Add Education</span>
              <div className="editor-project-fields">
                <input value={newEducation.degree} onChange={event => setNewEducation({ ...newEducation, degree: event.target.value })} placeholder="Degree or qualification" aria-label="Degree or qualification" required />
                <input value={newEducation.institution} onChange={event => setNewEducation({ ...newEducation, institution: event.target.value })} placeholder="Institution" aria-label="Institution" required />
                <input value={newEducation.year} onChange={event => setNewEducation({ ...newEducation, year: event.target.value })} placeholder="Year" aria-label="Graduation year" />
                <input value={newEducation.detail} onChange={event => setNewEducation({ ...newEducation, detail: event.target.value })} placeholder="Grade or additional detail (optional)" aria-label="Education details" />
              </div>
              <button className="secondary-btn" type="submit"><Plus size={15} /> Add education</button>
            </form>}
          </div>
          <div className="bento-card col-5">
            <span className="eyebrow">Certifications</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
              {certificationList.map((c, index) => (
                <div key={`${c}-${index}`} style={{ padding: "1.25rem", background: "var(--surface-soft)", border: "1px solid var(--line)", borderRadius: "14px", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                  {isEditor && <button type="button" onClick={() => setCertificationList(certificationList.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove certification ${c}`} style={{ color: "#ef4444", flexShrink: 0 }}><X size={15} /></button>}
                  🏆 {c}
                </div>
              ))}
            </div>
            {isEditor && <form className="editor-list-add" onSubmit={event => {
              event.preventDefault();
              addListItem(newCertification, certificationList, setCertificationList, () => setNewCertification(""));
            }}>
              <input value={newCertification} onChange={event => setNewCertification(event.target.value)} placeholder="Add a certification" aria-label="New certification" />
              <button className="secondary-btn" type="submit"><Plus size={15} /> Add certification</button>
            </form>}
          </div>
        </div>
      </Section>

      {/* Contact */}
      <Section id="contact" eyebrow="08 / CONTACT" title="Let's connect around procurement, SCM and project delivery.">
        <div className="contact-grid">
          <div className="contact-info-list">
            <a className="contact-item" href={`mailto:${profileData.email}`}>
              <Mail size={20} style={{ color: "var(--accent)" }} />
              <span>{profileData.email}</span>
            </a>
            {profileData.phones?.map((p: string) => (
              <div className="contact-item" key={p}>
                <Phone size={20} style={{ color: "var(--accent)" }} />
                <a href={`tel:${p.replace(/\s/g, "")}`} style={{ color: "inherit" }}><span>{p}</span></a>
                {isEditor && <button type="button" onClick={() => updateProfileTextList("phones", profileData.phones.filter((phone: string) => phone !== p))} aria-label={`Remove phone ${p}`} style={{ color: "#ef4444", marginLeft: "auto" }}><X size={15} /></button>}
              </div>
            ))}
            {isEditor && <form className="editor-list-add" onSubmit={event => {
              event.preventDefault();
              addListItem(newPhone, profileData.phones || [], items => updateProfileTextList("phones", items), () => setNewPhone(""));
            }}>
              <input value={newPhone} onChange={event => setNewPhone(event.target.value)} placeholder="Add a phone number" aria-label="New phone number" type="tel" />
              <button className="secondary-btn" type="submit"><Plus size={15} /> Add phone</button>
            </form>}
            <div className="contact-item">
              <MapPin size={20} style={{ color: "var(--accent)" }} />
              <span>{profileData.location}</span>
            </div>
            <a className="contact-item" href={profileData.linkedin} target="_blank" rel="noreferrer">
              <Linkedin size={20} style={{ color: "var(--accent)" }} />
              <span>LinkedIn Profile</span>
            </a>
            <a className="contact-item" href={profileData.github} target="_blank" rel="noreferrer">
              <Github size={20} style={{ color: "var(--accent)" }} />
              <span>GitHub Profile</span>
            </a>
          </div>

          <form className="contact-form" action={`mailto:${profileData.email}`} method="post" encType="text/plain">
            <label>
              Your Name
              <input name="name" required placeholder="Name" />
            </label>
            <label>
              Your Email
              <input name="email" type="email" required placeholder="you@example.com" />
            </label>
            <label>
              Message
              <textarea name="message" rows={5} required placeholder="How can we connect?" />
            </label>
            <button className="primary-btn" type="submit" style={{ justifyContent: "center", width: "100%" }}>
              <Send size={16} /> Send via Email
            </button>
          </form>
        </div>
      </Section>

      {/* Footer */}
      <footer>
        <span>© {new Date().getFullYear()} {profileData.name}. All rights reserved.</span>
        <span>Supply Chain · Procurement · Projects</span>
      </footer>

      {/* Floating Action Buttons */}
      {showTop && (
        <button className="back-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">
          ↑
        </button>
      )}
      <a className="float-resume" href={`${BASE}/resume.pdf`} download>
        <Download size={16} /> Resume PDF
      </a>

      {/* Server-backed editor sign-in */}
      <AnimatePresence>
        {showAuthModal && <div className="modal-backdrop"><motion.div className="recruiter-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
          <button className="modal-close" onClick={() => setShowAuthModal(false)} aria-label="Close"><X size={18} /></button>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}><Lock size={40} style={{ color: "var(--accent)", margin: "0 auto 10px" }} /><h2 style={{ fontSize: "24px", fontWeight: 900 }}>Editor Sign In</h2><p style={{ color: "var(--muted)", fontSize: "14px" }}>Your password is verified by the site server.</p></div>
          <input type="password" autoComplete="current-password" style={{ width: "100%", padding: "12px", background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: "10px", color: "var(--text)" }} value={authPassword} placeholder="Admin password" onKeyDown={e => e.key === "Enter" && void handleAuthSubmit()} onChange={e => setAuthPassword(e.target.value)} />
          {authError && <p role="alert" style={{ color: "#ef4444", fontSize: "13px" }}>{authError}</p>}
          <button className="forgot-key-link" type="button" onClick={() => { setShowAuthModal(false); setResetMode(true); setResetMethod("choose"); setResetMessage(""); setResetToken(""); }}>Forgot password?</button>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "1rem" }}><button className="secondary-btn" onClick={() => setShowAuthModal(false)}>Cancel</button><button className="primary-btn" onClick={() => void handleAuthSubmit()}>Sign In</button></div>
        </motion.div></div>}
      </AnimatePresence>
      {/* Password recovery by email or security question */}
      <AnimatePresence>
        {resetMode && <div className="modal-backdrop"><motion.div className="recruiter-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
          <button className="modal-close" onClick={() => setResetMode(false)} aria-label="Close"><X size={18} /></button><span className="eyebrow">PASSWORD RECOVERY</span><h2 style={{ fontSize: "24px", fontWeight: 900, margin: "8px 0 12px" }}>Reset editor password</h2>
          {resetMethod === "choose" && !resetToken && <><p style={{ color: "var(--muted)", fontSize: "13px" }}>Choose how you want to recover your password.</p><div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}><button className="secondary-btn" onClick={() => void requestPasswordReset()}>Send email reset link</button><button className="secondary-btn" onClick={() => void chooseQuestionRecovery()}>Use recovery question</button></div></>}
          {resetMethod === "email" && !resetToken && <p style={{ color: "var(--muted)", fontSize: "13px" }}>A reset link will be sent to the configured email address.</p>}
          {(resetToken || resetMethod === "question") && <><p style={{ color: "var(--muted)", fontSize: "13px" }}>{resetToken ? "Email link verified. Answer your recovery question to continue." : "Answer your recovery question to reset the password."}</p><label style={{ display: "grid", gap: "6px", marginTop: "12px" }}>{resetQuestion}<input type="password" autoComplete="off" value={resetAnswer} onChange={event => setResetAnswer(event.target.value)} /></label><label style={{ display: "grid", gap: "6px", marginTop: "12px" }}>New password<input type="password" autoComplete="new-password" value={resetPassword} onChange={event => setResetPassword(event.target.value)} /></label><label style={{ display: "grid", gap: "6px", marginTop: "12px" }}>Confirm new password<input type="password" autoComplete="new-password" value={resetConfirmPassword} onChange={event => setResetConfirmPassword(event.target.value)} /></label></>}
          {resetMessage && <p role="status" style={{ color: "var(--muted)", fontSize: "13px", marginTop: "12px" }}>{resetMessage}</p>}<div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "1.5rem" }}><button className="secondary-btn" onClick={() => setResetMode(false)}>Close</button>{(resetToken || resetMethod === "question") && <button className="primary-btn" onClick={() => void completePasswordReset()}>Reset Password</button>}</div>
        </motion.div></div>}
      </AnimatePresence>
      {/* Server side editor settings */}
      <AnimatePresence>
        {showSettingsModal && <div className="modal-backdrop"><motion.div className="recruiter-modal editor-settings-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
          <button className="modal-close" onClick={() => setShowSettingsModal(false)} aria-label="Close"><X size={18} /></button><span className="eyebrow">EDITOR ONLY</span><h2 style={{ fontSize: "24px", fontWeight: 900, margin: "8px 0 12px" }}>Editor Settings</h2><p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: 1.5 }}>Secrets and credentials stay on the server. Email password reset requires a verified sender domain.</p>
          <div style={{ display: "grid", gap: "12px", marginTop: "1.25rem" }}><strong>Recovery question</strong><input type="text" autoComplete="off" value={recoveryQuestion} placeholder="Your recovery question" onChange={event => setRecoveryQuestion(event.target.value)} /><input type="password" autoComplete="new-password" value={recoveryAnswer} placeholder="Answer (leave blank to keep current answer)" onChange={event => setRecoveryAnswer(event.target.value)} /><button className="secondary-btn" onClick={() => void saveRecoveryQuestion()}>Save Recovery Question</button></div>
          <div style={{ display: "grid", gap: "12px", borderTop: "1px solid var(--line)", paddingTop: "14px", marginTop: "18px" }}><strong>Change password</strong><input type="password" autoComplete="current-password" value={currentPasswordInput} placeholder="Current password" onChange={event => setCurrentPasswordInput(event.target.value)} /><input type="password" autoComplete="new-password" value={newPassword} placeholder="New password" onChange={event => setNewPassword(event.target.value)} /><input type="password" autoComplete="new-password" value={confirmPassword} placeholder="Confirm new password" onChange={event => setConfirmPassword(event.target.value)} /><button className="secondary-btn" onClick={() => void changeAdminPassword()}>Change Password</button></div>
          {settingsMessage && <p role="status" style={{ color: "var(--muted)", fontSize: "13px", marginTop: "12px" }}>{settingsMessage}</p>}<div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}><button className="secondary-btn" onClick={() => setShowSettingsModal(false)}>Close</button></div>
        </motion.div></div>}
      </AnimatePresence>

      {/* Recruiter Modal */}
      <AnimatePresence>
        {recruiter && (
          <div className="modal-backdrop">
            <motion.div className="recruiter-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}>
              <button className="modal-close" onClick={() => setRecruiter(false)} aria-label="Close modal">
                <X size={18} />
              </button>
              <span className="eyebrow">30-SECOND RECRUITER PROFILE</span>
              <h2 style={{ fontSize: "28px", fontWeight: 900, margin: "8px 0 4px 0" }}>{profileData.name}</h2>
              <p style={{ color: "var(--muted)", fontSize: "16px", marginBottom: "2rem" }}>{profileData.title}</p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
                <div className="mini-fact">
                  <span>Total Experience</span>
                  <strong style={{ color: "var(--accent)" }}>{totalExperienceFormatted}</strong>
                </div>
                <div className="mini-fact">
                  <span>Latest Role</span>
                  <strong>{expList[0]?.role || expList[0]?.company || "Not specified"}</strong>
                  {expList[0]?.role && expList[0]?.company && (
                    <small style={{ color: "var(--muted)", display: "block", fontSize: "11px", lineHeight: 1.4, marginTop: "4px" }}>
                      {expList[0].company}
                    </small>
                  )}
                </div>
                <div className="mini-fact" style={{ gridColumn: "span 2" }}>
                  <span>Global Coverage</span>
                  <strong>{profileData.regions?.join(" · ")}</strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <a className="primary-btn" href={`${BASE}/resume.pdf`} download>
                  <Download size={16} /> Download Resume
                </a>
                <a className="secondary-btn" href={profileData.linkedin} target="_blank" rel="noreferrer">
                  <Linkedin size={16} /> LinkedIn
                </a>
                <a className="secondary-btn" href={`mailto:${profileData.email}`}>
                  <Mail size={16} /> Email
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="section wrap">
      <div className="section-header">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
