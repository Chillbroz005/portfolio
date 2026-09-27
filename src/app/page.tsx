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

type RecoveryQuestion = {
  question: string;
  answerHash: string;
};

type EncryptedRecoveryBackup = {
  version: 1;
  iv: string;
  ciphertext: string;
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

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function generateRecoveryCode(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
}

async function encryptRecoveryBackup(questions: RecoveryQuestion[], recoveryCode: string): Promise<EncryptedRecoveryBackup> {
  const key = await crypto.subtle.importKey("raw", toArrayBuffer(base64ToBytes(recoveryCode)), { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify({ questions }));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(plaintext));
  return { version: 1, iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
}

async function decryptRecoveryBackup(backup: EncryptedRecoveryBackup, recoveryCode: string): Promise<RecoveryQuestion[]> {
  if (backup.version !== 1 || !backup.iv || !backup.ciphertext) throw new Error("The recovery backup has an unsupported format.");
  const key = await crypto.subtle.importKey("raw", toArrayBuffer(base64ToBytes(recoveryCode)), { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(base64ToBytes(backup.iv)) }, key, toArrayBuffer(base64ToBytes(backup.ciphertext)));
  const data = JSON.parse(new TextDecoder().decode(plaintext));
  if (!Array.isArray(data.questions) || data.questions.length === 0 || data.questions.length > 2) {
    throw new Error("The recovery backup does not contain valid questions.");
  }
  if (!data.questions.every((item: any) => item && typeof item.question === "string" && typeof item.answerHash === "string")) {
    throw new Error("The recovery backup is incomplete.");
  }
  return data.questions;
}

async function uploadRecoveryBackup(backup: EncryptedRecoveryBackup, token: string): Promise<void> {
  const path = "public/admin-recovery.enc.json";
  const url = `https://api.github.com/repos/Chillbroz005/portfolio/contents/${path}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
  const currentResponse = await fetch(url, { headers });
  let sha: string | undefined;
  if (currentResponse.ok) {
    const currentFile = await currentResponse.json();
    sha = currentFile.sha;
  } else if (currentResponse.status !== 404) {
    throw new Error(`Could not check the recovery backup (${currentResponse.status}).`);
  }

  const content = JSON.stringify(backup, null, 2);
  const encodedContent = bytesToBase64(new TextEncoder().encode(content));
  const updateResponse = await fetch(url, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Update encrypted admin recovery backup",
      content: encodedContent,
      ...(sha ? { sha } : {}),
      branch: "main"
    })
  });
  if (!updateResponse.ok) {
    const error = await updateResponse.json().catch(() => ({}));
    throw new Error(error.message || `Could not save the encrypted recovery backup (${updateResponse.status}).`);
  }
}

async function fetchRecoveryBackup(): Promise<EncryptedRecoveryBackup> {
  const response = await fetch("https://api.github.com/repos/Chillbroz005/portfolio/contents/public/admin-recovery.enc.json", {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(response.status === 404 ? "No cross-browser recovery backup has been published yet." : `Could not load the recovery backup (${response.status}).`);
  const file = await response.json();
  const parsed = JSON.parse(new TextDecoder().decode(base64ToBytes(file.content)));
  if (!parsed || parsed.version !== 1 || typeof parsed.iv !== "string" || typeof parsed.ciphertext !== "string") {
    throw new Error("The recovery backup file is invalid.");
  }
  return parsed as EncryptedRecoveryBackup;
}

async function hashRecoveryAnswer(answer: string): Promise<string> {
  const normalized = answer.trim().replace(/\s+/g, " ").toLowerCase();
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
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
  const [newSkill, setNewSkill] = useState("");
  const [newSoftware, setNewSoftware] = useState("");
  const [newTool, setNewTool] = useState("");

  // Auth & Token Security states
  const [authKeyInput, setAuthKeyInput] = useState("");
  const [savedAuthKey, setSavedAuthKey] = useState("SureshAdmin123");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [recoveryQuestions, setRecoveryQuestions] = useState<RecoveryQuestion[]>([]);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryCodeVisible, setRecoveryCodeVisible] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState("");
  const [recoveryCodeUnlocked, setRecoveryCodeUnlocked] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryLoadError, setRecoveryLoadError] = useState("");
  const [recoveryQuestion1, setRecoveryQuestion1] = useState("");
  const [recoveryAnswer1, setRecoveryAnswer1] = useState("");
  const [recoveryQuestion2, setRecoveryQuestion2] = useState("");
  const [recoveryAnswer2, setRecoveryAnswer2] = useState("");
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryAnswers, setRecoveryAnswers] = useState<string[]>([]);
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [recoveryNewKey, setRecoveryNewKey] = useState("");
  const [recoveryConfirmKey, setRecoveryConfirmKey] = useState("");
  const [recoveryError, setRecoveryError] = useState("");

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

  // Load saved local edits, token, and auth key
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem("sg_edited_profile");
      if (savedProfile) setProfileData(JSON.parse(savedProfile));

      const savedExp = localStorage.getItem("sg_edited_experience");
      if (savedExp) setExpList(JSON.parse(savedExp));

      const savedSkills = localStorage.getItem("sg_edited_skills");
      if (savedSkills) setSkillsList(JSON.parse(savedSkills));

      const savedSoftware = localStorage.getItem("sg_edited_software");
      if (savedSoftware) setSoftwareList(JSON.parse(savedSoftware));

      const savedTools = localStorage.getItem("sg_edited_tools");
      if (savedTools) setToolsList(JSON.parse(savedTools));

      const savedToken = localStorage.getItem("sg_github_token");
      if (savedToken) setGithubToken(savedToken);

      const savedKey = localStorage.getItem("sg_auth_key");
      if (savedKey) setSavedAuthKey(savedKey);

      const savedRecoveryQuestions = localStorage.getItem("sg_recovery_questions");
      if (savedRecoveryQuestions) {
        const parsed = JSON.parse(savedRecoveryQuestions);
        if (Array.isArray(parsed)) {
          setRecoveryQuestions(parsed.filter(item => item && typeof item.question === "string" && typeof item.answerHash === "string"));
          setRecoveryQuestion1(parsed[0]?.question || "");
          setRecoveryQuestion2(parsed[1]?.question || "");
        }
      }

      const savedRecoveryCode = localStorage.getItem("sg_recovery_code");
      if (savedRecoveryCode) setRecoveryCode(savedRecoveryCode);
    } catch {}
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
    if (filter === "All") return defaultProjects;
    return defaultProjects.filter(p => p.category === filter);
  }, [filter]);

  // Handle Edit Mode click
  const handleEditModeToggle = () => {
    if (isEditor) {
      setIsEditor(false);
    } else {
      setShowAuthModal(true);
    }
  };

  // Submit Authorization Key
  const handleAuthSubmit = () => {
    if (authKeyInput === savedAuthKey) {
      setIsEditor(true);
      setShowAuthModal(false);
      setAuthKeyInput("");
    } else {
      alert("❌ Incorrect Authorization Key!");
    }
  };

  const openRecoveryModal = () => {
    setRecoveryAnswers(Array(recoveryQuestions.length).fill(""));
    setRecoveryCodeInput(recoveryCode);
    setRecoveryCodeUnlocked(false);
    setRecoveryLoadError("");
    setRecoveryVerified(false);
    setRecoveryNewKey("");
    setRecoveryConfirmKey("");
    setRecoveryError("");
    setShowRecoveryModal(true);
  };

  const loadRecoveryQuestions = async () => {
    const code = recoveryCodeInput.trim();
    if (!code) {
      setRecoveryLoadError("Enter the recovery code saved when you configured these questions.");
      return;
    }

    setRecoveryLoading(true);
    setRecoveryLoadError("");
    try {
      const backup = await fetchRecoveryBackup();
      const questions = await decryptRecoveryBackup(backup, code);
      setRecoveryQuestions(questions);
      setRecoveryQuestion1(questions[0]?.question || "");
      setRecoveryQuestion2(questions[1]?.question || "");
      setRecoveryAnswers(Array(questions.length).fill(""));
      setRecoveryCode(code);
      setRecoveryCodeUnlocked(true);
    } catch (error: any) {
      setRecoveryLoadError(error?.name === "OperationError" ? "That recovery code did not unlock the backup." : error.message || "Could not load the recovery backup.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const verifyRecoveryAnswers = async () => {
    setRecoveryError("");
    if (recoveryQuestions.length === 0) {
      setRecoveryError("Recovery questions have not been configured in this browser.");
      return;
    }

    try {
      const matches = await Promise.all(recoveryQuestions.map(async (item, index) => {
        const answer = recoveryAnswers[index] || "";
        return Boolean(answer.trim()) && await hashRecoveryAnswer(answer) === item.answerHash;
      }));
      if (matches.every(Boolean)) {
        setRecoveryVerified(true);
      } else {
        setRecoveryError("Those answers do not match the configured recovery details.");
      }
    } catch {
      setRecoveryError("This browser could not verify the recovery answers. Try the latest version of a modern browser.");
    }
  };

  const resetAdminKey = () => {
    if (!recoveryNewKey.trim()) {
      setRecoveryError("Enter a new admin key.");
      return;
    }
    if (recoveryNewKey !== recoveryConfirmKey) {
      setRecoveryError("The new keys do not match.");
      return;
    }

    try {
      localStorage.setItem("sg_auth_key", recoveryNewKey);
      if (recoveryCodeUnlocked) {
        localStorage.setItem("sg_recovery_questions", JSON.stringify(recoveryQuestions));
        localStorage.setItem("sg_recovery_code", recoveryCodeInput.trim());
        setRecoveryCode(recoveryCodeInput.trim());
      }
      setSavedAuthKey(recoveryNewKey);
      setShowRecoveryModal(false);
      alert("Admin key updated in this browser.");
    } catch {
      setRecoveryError("Could not save the new key in this browser.");
    }
  };

  const saveEditorSettings = async () => {
    const configured: RecoveryQuestion[] = [];
    let code = recoveryCode;
    let generatedCode = false;
    const questionDrafts = [
      { question: recoveryQuestion1, answer: recoveryAnswer1, index: 0 },
      { question: recoveryQuestion2, answer: recoveryAnswer2, index: 1 }
    ];

    try {
      if (!recoveryQuestion1.trim() && recoveryQuestion2.trim()) {
        alert("Use question 1 before adding optional question 2.");
        return;
      }

      for (const draft of questionDrafts) {
        const question = draft.question.trim();
        const answer = draft.answer.trim();
        if (!question) {
          if (answer) {
            alert("Add a question for each recovery answer, or clear that answer.");
            return;
          }
          continue;
        }

        const existing = recoveryQuestions[draft.index];
        const answerHash = answer
          ? await hashRecoveryAnswer(answer)
          : existing?.question === question ? existing.answerHash : "";
        if (!answerHash) {
          alert(`Enter an answer for recovery question ${draft.index + 1}.`);
          return;
        }
        configured.push({ question, answerHash });
      }

      if (configured.length > 0) {
        if (!code) {
          code = generateRecoveryCode();
          generatedCode = true;
          setRecoveryCode(code);
          setRecoveryCodeVisible(true);
        }

        if (githubToken.trim()) {
          const backup = await encryptRecoveryBackup(configured, code);
          await uploadRecoveryBackup(backup, githubToken.trim());
        }
      }

      localStorage.setItem("sg_github_token", githubToken);
      localStorage.setItem("sg_auth_key", savedAuthKey);
      localStorage.setItem("sg_recovery_questions", JSON.stringify(configured));
      if (code) localStorage.setItem("sg_recovery_code", code);
      setRecoveryQuestions(configured);
      setRecoveryCode(code);
      setRecoveryAnswer1("");
      setRecoveryAnswer2("");

      if (configured.length > 0 && !githubToken.trim()) {
        setRecoveryCodeVisible(true);
        alert("Saved in this browser only. Add a GitHub token with repository Contents write access, then save again to enable recovery in other browsers.");
        return;
      }

      if (!generatedCode) setShowTokenModal(false);
      if (configured.length > 0) {
        alert(generatedCode
          ? "Encrypted recovery backup synced to GitHub. Copy the recovery code shown here and store it outside this browser."
          : "Editor settings and encrypted recovery backup synced to GitHub.");
      } else {
        alert("Editor settings saved in this browser.");
      }
    } catch (error: any) {
      alert(error?.message || "Could not save editor settings. Check browser support and GitHub token permissions.");
    }
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

  // Save changes locally
  const saveLocalChanges = () => {
    try {
      localStorage.setItem("sg_edited_profile", JSON.stringify(profileData));
      localStorage.setItem("sg_edited_experience", JSON.stringify(expList));
      localStorage.setItem("sg_edited_skills", JSON.stringify(skillsList));
      localStorage.setItem("sg_edited_software", JSON.stringify(softwareList));
      localStorage.setItem("sg_edited_tools", JSON.stringify(toolsList));
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

  // Push directly to GitHub via API
  const pushToGitHub = async () => {
    if (!githubToken) {
      setShowTokenModal(true);
      return;
    }

    setPushStatus("pushing");
    setPushMessage("Connecting to GitHub API...");

    try {
      const repoOwner = "Chillbroz005";
      const repoName = "portfolio";
      const filePath = "src/data/profile.ts";

      // 1. Get current file sha
      const getRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json"
        }
      });

      if (!getRes.ok) {
        throw new Error(`Failed to fetch current file from GitHub (${getRes.status}). Check token permissions.`);
      }

      const fileData = await getRes.json();
      const currentSha = fileData.sha;

      // 2. Generate updated TS code
      const updatedCode = `export const profile = ${JSON.stringify(profileData, null, 2)} as const;\n\nexport type ExperienceItem = {\n  company: string;\n  role: string;\n  location: string;\n  dates: string;\n  startDate: string;\n  endDate: string | null;\n  bullets: string[];\n};\n\nexport const experience: ExperienceItem[] = ${JSON.stringify(expList, null, 2)};\n\nexport const engagements = ${JSON.stringify(defaultEngagements, null, 2)};\n\nexport const skills = ${JSON.stringify(skillsList, null, 2)};\n\nexport const software = ${JSON.stringify(softwareList, null, 2)};\n\nexport const tools = ${JSON.stringify(toolsList, null, 2)};\n\nexport const education = ${JSON.stringify(defaultEducation, null, 2)};\n\nexport const certifications = ${JSON.stringify(defaultCertifications, null, 2)};\n\nexport const projects = ${JSON.stringify(defaultProjects, null, 2)};\n`;

      // 3. Encode to base64
      const utf8Bytes = new TextEncoder().encode(updatedCode);
      let binaryStr = "";
      for (let i = 0; i < utf8Bytes.length; i++) {
        binaryStr += String.fromCharCode(utf8Bytes[i]);
      }
      const base64Content = btoa(binaryStr);

      // 4. Commit to GitHub
      const putRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Update profile & experience data via Web Editor",
          content: base64Content,
          sha: currentSha,
          branch: "main"
        })
      });

      if (!putRes.ok) {
        const errData = await putRes.json();
        throw new Error(errData.message || "Push failed.");
      }

      setPushStatus("success");
      setPushMessage("🎉 Successfully pushed directly to GitHub repository! Your GitHub Pages build has started and will update in 1-2 minutes.");
    } catch (err: any) {
      setPushStatus("error");
      setPushMessage(`Push failed: ${err.message}`);
    }
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
            onClick={openRecoveryModal}
            aria-label="Recover admin key"
            title="Admin key recovery"
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
                onClick={() => setShowTokenModal(true)}
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
            <img className="profile-photo" src={`${BASE}/profile-photo.png`} alt="Suresh Ganesan professional portrait" loading="eager" />

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
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Projects */}
      <Section id="projects" eyebrow="05 / PROJECTS & ENGAGEMENTS" title="Selected project engagements and verified public work.">
        <div className="filter-tabs" role="tablist" aria-label="Project filters">
          {projectFilters.map(f => (
            <button role="tab" aria-selected={filter === f} className={`filter-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)} key={f}>
              {f}
            </button>
          ))}
        </div>
        <div className="projects-grid">
          {filtered.length ? filtered.map(p => (
            <article className="project-card" key={p.title}>
              <div>
                <div className="project-top">
                  <span>{p.category}</span>
                  <ArrowUpRight size={18} />
                </div>
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
              {defaultEducation.map(e => (
                <div key={e.degree} style={{ paddingBottom: "1.25rem", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent)" }}>{e.year}</span>
                  <h3 style={{ fontSize: "18px", fontWeight: 800, margin: "4px 0" }}>{e.degree}</h3>
                  <p style={{ color: "var(--muted)", margin: 0, fontSize: "14px" }}>{e.institution}</p>
                  <strong style={{ fontSize: "13px", marginTop: "4px", display: "block" }}>{e.detail}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="bento-card col-5">
            <span className="eyebrow">Certifications</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
              {defaultCertifications.map(c => (
                <div key={c} style={{ padding: "1.25rem", background: "var(--surface-soft)", border: "1px solid var(--line)", borderRadius: "14px", fontWeight: 700 }}>
                  🏆 {c}
                </div>
              ))}
            </div>
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
              <a className="contact-item" href={`tel:${p.replace(/\s/g, "")}`} key={p}>
                <Phone size={20} style={{ color: "var(--accent)" }} />
                <span>{p}</span>
              </a>
            ))}
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

      {/* Admin Authorization Prompt Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="modal-backdrop">
            <motion.div className="recruiter-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <button className="modal-close" onClick={() => setShowAuthModal(false)} aria-label="Close modal">
                <X size={18} />
              </button>
              <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                <Lock size={40} style={{ color: "var(--accent)", margin: "0 auto 10px" }} />
                <h2 style={{ fontSize: "24px", fontWeight: 900 }}>Admin Passkey Required</h2>
                <p style={{ color: "var(--muted)", fontSize: "14px" }}>Please enter your authorization phrase to enable editing.</p>
              </div>
              <div style={{ display: "grid", gap: "10px", marginBottom: "1.5rem" }}>
                <input
                  type="password"
                  style={{ width: "100%", padding: "12px", background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: "10px", color: "var(--text)" }}
                  value={authKeyInput}
                  placeholder="Enter access key..."
                  onKeyDown={e => e.key === "Enter" && handleAuthSubmit()}
                  onChange={e => setAuthKeyInput(e.target.value)}
                />
                <button
                  className="forgot-key-link"
                  type="button"
                  onClick={() => {
                    setAuthKeyInput("");
                    setShowAuthModal(false);
                    openRecoveryModal();
                  }}
                >
                  Forgot your admin key? Recover it
                </button>
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button className="secondary-btn" onClick={() => setShowAuthModal(false)}>Cancel</button>
                <button className="primary-btn" onClick={handleAuthSubmit}>Unlock Editor</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Key Recovery Modal */}
      <AnimatePresence>
        {showRecoveryModal && (
          <div className="modal-backdrop">
            <motion.div className="recruiter-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <button className="modal-close" onClick={() => setShowRecoveryModal(false)} aria-label="Close recovery dialog">
                <X size={18} />
              </button>
              <span className="eyebrow">ADMIN KEY RECOVERY</span>
              <h2 style={{ fontSize: "24px", fontWeight: 900, margin: "8px 0 12px 0" }}>Forgot your admin key?</h2>
              <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: 1.6, marginBottom: "1.25rem" }}>
                In a new browser, enter your saved recovery code first, then answer your configured question(s). Recovery does not provide GitHub publishing access.
              </p>

              {recoveryQuestions.length === 0 && !recoveryCodeUnlocked ? (
                <div style={{ display: "grid", gap: "12px" }}>
                  <label style={{ display: "grid", gap: "6px", fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                    Recovery code
                    <input
                      type="password"
                      autoComplete="off"
                      style={{ padding: "12px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "10px", color: "var(--text)" }}
                      value={recoveryCodeInput}
                      onChange={event => setRecoveryCodeInput(event.target.value)}
                    />
                  </label>
                  {recoveryLoadError && <p role="alert" style={{ color: "#ef4444", fontSize: "13px" }}>{recoveryLoadError}</p>}
                </div>
              ) : recoveryQuestions.length > 0 && !recoveryVerified ? (
                <div style={{ display: "grid", gap: "14px" }}>
                  {recoveryQuestions.map((item, index) => (
                    <label key={`${item.question}-${index}`} style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 700 }}>
                      {item.question}
                      <input
                        type="password"
                        autoComplete="off"
                        style={{ padding: "12px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "10px", color: "var(--text)" }}
                        value={recoveryAnswers[index] || ""}
                        onChange={event => setRecoveryAnswers(current => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
                  <label style={{ display: "grid", gap: "6px", fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                    New admin key
                    <input type="password" autoComplete="new-password" style={{ padding: "12px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "10px", color: "var(--text)" }} value={recoveryNewKey} onChange={event => setRecoveryNewKey(event.target.value)} />
                  </label>
                  <label style={{ display: "grid", gap: "6px", fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                    Confirm new admin key
                    <input type="password" autoComplete="new-password" style={{ padding: "12px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "10px", color: "var(--text)" }} value={recoveryConfirmKey} onChange={event => setRecoveryConfirmKey(event.target.value)} />
                  </label>
                </div>
              )}

              {recoveryError && <p role="alert" style={{ color: "#ef4444", fontSize: "13px", marginTop: "12px" }}>{recoveryError}</p>}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "1.5rem" }}>
                <button className="secondary-btn" onClick={() => setShowRecoveryModal(false)}>Close</button>
                {recoveryQuestions.length === 0 && !recoveryCodeUnlocked && <button className="primary-btn" disabled={recoveryLoading} onClick={loadRecoveryQuestions}>{recoveryLoading ? "Loading..." : "Load Questions"}</button>}
                {recoveryQuestions.length > 0 && !recoveryVerified && <button className="primary-btn" onClick={verifyRecoveryAnswers}>Verify Answers</button>}
                {recoveryVerified && <button className="primary-btn" onClick={resetAdminKey}>Save New Key</button>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Editor Settings Modal */}
      <AnimatePresence>
        {showTokenModal && (
          <div className="modal-backdrop">
            <motion.div className="recruiter-modal editor-settings-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <button className="modal-close" onClick={() => setShowTokenModal(false)} aria-label="Close modal">
                <X size={18} />
              </button>
              <span className="eyebrow">EDITOR ONLY</span>
              <h2 style={{ fontSize: "24px", fontWeight: 900, margin: "8px 0 12px 0" }}>Editor Settings</h2>

              {/* GitHub PAT Storage Description */}
              <div style={{ padding: "12px", background: "var(--accent-soft)", borderRadius: "12px", border: "1px solid var(--line)", fontSize: "13px", lineHeight: 1.5, marginBottom: "1.5rem" }}>
                Your token and admin key stay in this browser. The recovery backup is encrypted before it is committed to the public repository. Save the recovery code somewhere outside this browser.
              </div>

              <div style={{ display: "grid", gap: "15px", marginBottom: "1.5rem" }}>
                <label style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, display: "grid", gap: "6px" }}>
                  GitHub Personal Access Token:
                  <input
                    type="password"
                    style={{ padding: "12px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "10px", color: "var(--text)" }}
                    value={githubToken}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    onChange={e => setGithubToken(e.target.value)}
                  />
                </label>

                <label style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, display: "grid", gap: "6px" }}>
                  Customize Admin Passkey (Auth Key):
                  <input
                    type="text"
                    style={{ padding: "12px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "10px", color: "var(--text)" }}
                    value={savedAuthKey}
                    placeholder="SureshAdmin123"
                    onChange={e => setSavedAuthKey(e.target.value)}
                  />
                </label>

                <div style={{ display: "grid", gap: "10px", borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
                  <div>
                    <strong style={{ fontSize: "14px" }}>Forgot key recovery</strong>
                    <p style={{ color: "var(--muted)", fontSize: "12px", lineHeight: 1.5, margin: "4px 0 0" }}>
                      Configure one or two questions. Leave an existing answer blank to keep it. A GitHub token with repository Contents write access is needed to sync the encrypted backup across browsers.
                    </p>
                  </div>
                  <label style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, display: "grid", gap: "6px" }}>
                    Recovery question 1
                    <input type="text" autoComplete="off" style={{ padding: "12px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "10px", color: "var(--text)" }} value={recoveryQuestion1} placeholder="Example: What was your childhood nickname?" onChange={event => setRecoveryQuestion1(event.target.value)} />
                  </label>
                  <label style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, display: "grid", gap: "6px" }}>
                    Answer 1 {recoveryQuestions[0]?.question === recoveryQuestion1 && "(leave blank to keep saved answer)"}
                    <input type="password" autoComplete="new-password" style={{ padding: "12px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "10px", color: "var(--text)" }} value={recoveryAnswer1} onChange={event => setRecoveryAnswer1(event.target.value)} />
                  </label>
                  <label style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, display: "grid", gap: "6px" }}>
                    Recovery question 2 (optional)
                    <input type="text" autoComplete="off" style={{ padding: "12px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "10px", color: "var(--text)" }} value={recoveryQuestion2} placeholder="Example: What was the name of your first pet?" onChange={event => setRecoveryQuestion2(event.target.value)} />
                  </label>
                  <label style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, display: "grid", gap: "6px" }}>
                    Answer 2 {recoveryQuestions[1]?.question === recoveryQuestion2 && "(leave blank to keep saved answer)"}
                    <input type="password" autoComplete="new-password" style={{ padding: "12px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "10px", color: "var(--text)" }} value={recoveryAnswer2} onChange={event => setRecoveryAnswer2(event.target.value)} />
                  </label>
                  <div style={{ display: "grid", gap: "8px", borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
                    <strong style={{ fontSize: "14px" }}>Cross-browser recovery code</strong>
                    <p style={{ color: "var(--muted)", fontSize: "12px", lineHeight: 1.5, margin: 0 }}>
                      Keep this code in a password manager. You will need it with your answers to recover from another browser.
                    </p>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <input
                        type={recoveryCodeVisible ? "text" : "password"}
                        readOnly
                        aria-label="Cross-browser recovery code"
                        style={{ flex: "1 1 260px", minWidth: 0, padding: "10px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "10px", color: "var(--text)" }}
                        value={recoveryCode}
                        placeholder="Generated when you save recovery questions"
                      />
                      <button className="secondary-btn" type="button" disabled={!recoveryCode} onClick={() => setRecoveryCodeVisible(value => !value)}>
                        {recoveryCodeVisible ? "Hide" : "Reveal"}
                      </button>
                      <button
                        className="secondary-btn"
                        type="button"
                        disabled={!recoveryCode}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(recoveryCode);
                            alert("Recovery code copied. Store it somewhere outside this browser.");
                          } catch {
                            setRecoveryCodeVisible(true);
                            alert("Copy the revealed recovery code and store it somewhere outside this browser.");
                          }
                        }}
                      >
                        Copy Code
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button className="secondary-btn" onClick={() => setShowTokenModal(false)}>
                  Cancel
                </button>
                <button className="primary-btn" onClick={saveEditorSettings}>
                  Save Editor Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
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
