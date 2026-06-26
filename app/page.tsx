"use client";

import React, { useState } from "react";
import Link from "next/link";
import AssessmentForm from "@/components/AssessmentForm";
import { CreateAssessmentRequest, Assessment } from "@/types/assessment";
import styles from "./page.module.css";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const PAGE_SIZE = 6;

const STEP_DISPLAY: Record<string, string> = {
  ARCHITECTURE: "Architecture",
  CLOUD_ASSESSMENT: "Cloud",
  PLATFORM_ASSESSMENT: "Platform Assessment",
  OPERATIONAL_CONSIDERATIONS: "Operations",
  FINAL_RECOMMENDATION: "Final Recommendation",
};

const NAV_ITEMS = [
  { label: "Dashboard",          icon: "⊟", href: "/",       active: true  },
  { label: "Assessments",        icon: "📋", href: "/",       active: false },
  { label: "Templates",          icon: "📄", href: "#",       active: false },
  { label: "Reports",            icon: "📊", href: "#",       active: false },
  { label: "Platform Catalog",   icon: "🗂",  href: "#",       active: false },
  { label: "Rules & Framework",  icon: "📐", href: "#",       active: false },
  { label: "System Health",      icon: "💙", href: "/health", active: false },
  { label: "Audit Log",          icon: "📜", href: "#",       active: false },
  { label: "Settings",           icon: "⚙",  href: "#",       active: false },
];

export default function HomePage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  React.useEffect(() => {
    loadAssessments();
  }, []);

  const loadAssessments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/assessments`);
      const data = await res.json();
      setAssessments(data);
    } catch (err) {
      console.error("Failed to load assessments:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssessment = async (formData: CreateAssessmentRequest) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/assessment/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to create assessment");
      const data = await res.json();
      window.location.href = `${BASE_PATH}/assessment/${data.id}`;
    } catch (err) {
      console.error("Failed to create assessment:", err);
      setIsSubmitting(false);
    }
  };

  const handleDeleteAssessment = async (assessment: Assessment) => {
    const confirmed = window.confirm(
      `Delete assessment "${assessment.name}" and all related data (responses, recommendations, history, findings, embeddings)?`
    );
    if (!confirmed) return;
    setDeletingId(assessment.id);
    try {
      const res = await fetch(`${BASE_PATH}/api/assessment/${assessment.id}`, { method: "DELETE" });
      if (!res.ok) {
        const details = await res.json().catch(() => null);
        throw new Error(details?.error ?? "Failed to delete assessment");
      }
      await loadAssessments();
    } catch (err) {
      console.error("Failed to delete assessment:", err);
      window.alert("Failed to delete assessment. See console for details.");
    } finally {
      setDeletingId(null);
    }
  };

  // Computed stats
  const total = assessments.length;
  const completedCount = assessments.filter(a => a.status === "completed").length;
  const inProgressCount = assessments.filter(a => a.status === "in_progress").length;
  const draftCount = assessments.filter(a => a.status === "draft").length;

  // Filter + paginate
  const filtered = assessments.filter(a =>
    !search.trim() ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.business_requirement ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const sidebar = (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarLogo}>
        <div className={styles.logoMark}>S</div>
        <span className={styles.logoText}>EAAF</span>
      </div>
      <nav className={styles.sidebarNav}>
        {NAV_ITEMS.map(item => (
          <Link
            key={item.label}
            href={item.href}
            className={`${styles.navItem} ${item.active ? styles.navItemActive : ""}`}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className={styles.sidebarFooter}>
        <span className={styles.sidebarFooterShield}>🛡</span>
        <div>
          <p className={styles.sidebarTagline}>Deterministic. Transparent. Governed.</p>
          <p className={styles.sidebarTaglineSub}>Built for enterprise architecture decisions.</p>
        </div>
      </div>
    </aside>
  );

  if (showCreateForm) {
    return (
      <div className={styles.appShell}>
        {sidebar}
        <main className={styles.mainContent}>
          <div className={styles.formPage}>
            <div className={styles.formPageHeader}>
              <h1>Create New Assessment</h1>
              <button className={styles.backButton} onClick={() => setShowCreateForm(false)}>
                ← Back to Dashboard
              </button>
            </div>
            <AssessmentForm onSubmit={handleCreateAssessment} isLoading={isSubmitting} mode="create" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.appShell}>
      {sidebar}
      <main className={styles.mainContent}>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className={styles.heroSection}>
          <div className={styles.heroLeft}>
            <h1 className={styles.heroTitle}>Enterprise Architecture Assessment Framework</h1>
            <p className={styles.heroSubtitle}>
              EAAF: Structured assessment for architecture decisions across 5 steps
            </p>
            <div className={styles.heroActions}>
              <button onClick={() => setShowCreateForm(true)} className={styles.createButton}>
                + Create New Assessment
              </button>
              <Link href="/health" className={styles.healthButton}>
                ◎ View System Health
              </Link>
            </div>
          </div>
          <div className={styles.heroGraphic} aria-hidden="true">
            <svg viewBox="0 0 220 200" className={styles.heroSvg} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="faceTop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4a9fe8"/>
                  <stop offset="100%" stopColor="#1a73e8"/>
                </linearGradient>
                <linearGradient id="faceRight" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0057b8"/>
                  <stop offset="100%" stopColor="#003d82"/>
                </linearGradient>
                <linearGradient id="faceLeft" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="#1a73e8"/>
                  <stop offset="100%" stopColor="#5ab4f0"/>
                </linearGradient>
              </defs>
              <polygon points="110,20 185,80 110,140 35,80" fill="url(#faceTop)"/>
              <polygon points="110,140 185,80 185,108 110,168" fill="url(#faceRight)"/>
              <polygon points="110,140 35,80 35,108 110,168" fill="url(#faceLeft)"/>
              <text x="110" y="97" textAnchor="middle" fill="white" fontSize="42" fontWeight="bold">✓</text>
              <polygon points="28,42 48,56 28,70 8,56" fill="#4a9fe8" opacity="0.45"/>
              <polygon points="28,70 48,56 48,68 28,82" fill="#003d82" opacity="0.4"/>
              <polygon points="185,24 205,38 185,52 165,38" fill="#4a9fe8" opacity="0.38"/>
              <polygon points="185,52 205,38 205,50 185,64" fill="#003d82" opacity="0.32"/>
            </svg>
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statIconWrap}>📁</div>
            <div>
              <div className={styles.statNum}>{total}</div>
              <div className={styles.statLabel}>Total Assessments</div>
              <div className={styles.statSub}>All time</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIconWrap} ${styles.green}`}>✅</div>
            <div>
              <div className={styles.statNum}>{completedCount}</div>
              <div className={styles.statLabel}>Completed</div>
              <div className={styles.statSub}>
                {total > 0 ? Math.round((completedCount / total) * 100) : 0}% completion rate
              </div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIconWrap} ${styles.orange}`}>⏱</div>
            <div>
              <div className={styles.statNum}>{inProgressCount}</div>
              <div className={styles.statLabel}>In Progress</div>
              <div className={styles.statSub}>Active assessments</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIconWrap} ${styles.purple}`}>📄</div>
            <div>
              <div className={styles.statNum}>{draftCount}</div>
              <div className={styles.statLabel}>Draft</div>
              <div className={styles.statSub}>Not started</div>
            </div>
          </div>
        </div>

        {/* ── Assessments list ──────────────────────────────────────────── */}
        {loading ? (
          <p className={styles.loading}>Loading assessments…</p>
        ) : (
          <div>
            <div className={styles.assessmentsSectionHeader}>
              <h2 className={styles.assessmentsTitle}>Your Assessments ({filtered.length})</h2>
              <div className={styles.assessmentsSectionControls}>
                <div className={styles.searchWrap}>
                  <span className={styles.searchIcon}>🔍</span>
                  <input
                    className={styles.searchInput}
                    placeholder="Search assessments..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <button className={styles.filterBtn}>▼ Filter</button>
                <div className={styles.viewToggle}>
                  <button className={`${styles.viewBtn} ${styles.viewBtnActive}`} title="Grid view">⊞</button>
                  <button className={styles.viewBtn} title="List view">☰</button>
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className={styles.emptyState}>
                <h3>No assessments found</h3>
                <p>{search ? "Try a different search term." : "Create your first assessment to get started."}</p>
              </div>
            ) : (
              <>
                <div className={styles.grid}>
                  {paginated.map(a => (
                    <article key={a.id} className={styles.assessmentCard}>
                      <div className={styles.cardTop}>
                        <Link href={`/assessment/${a.id}`} className={styles.cardTitle}>
                          {a.name}
                        </Link>
                        <span className={`${styles.badge} ${styles[a.status]}`}>
                          {a.status.replace("_", " ")}
                        </span>
                      </div>

                      {a.recommendation && (
                        <p className={styles.cardMethod}>Deterministic {a.recommendation}</p>
                      )}

                      {a.business_requirement && (
                        <div className={styles.cardSection}>
                          <div className={styles.cardSectionLabel}>Requirement</div>
                          <p className={styles.cardSectionText}>
                            {a.business_requirement.length > 90
                              ? a.business_requirement.slice(0, 90) + "…"
                              : a.business_requirement}
                          </p>
                        </div>
                      )}

                      {a.recommendation && (
                        <div className={`${styles.cardSection} ${styles.cardSectionGreen}`}>
                          <div className={styles.cardSectionLabel}>Final Recommendation</div>
                          <p className={styles.cardSectionTextBold}>{a.recommendation}</p>
                        </div>
                      )}

                      <div className={styles.cardFooter}>
                        <span className={styles.cardStep}>
                          Step:{" "}
                          <Link href={`/assessment/${a.id}`} className={styles.cardStepLink}>
                            {a.current_step_id
                              ? (STEP_DISPLAY[a.current_step_id] ?? a.current_step_id.replace(/_/g, " "))
                              : "Not Started"}
                          </Link>
                        </span>
                        <span>📅 {new Date(a.created_at).toLocaleDateString("en-CA")}</span>
                      </div>

                      <div className={styles.cardActions}>
                        <button className={styles.cardIconBtn} title="View trends">📈</button>
                        <button
                          className={styles.cardMenuBtn}
                          title="Delete assessment"
                          onClick={() => handleDeleteAssessment(a)}
                          disabled={deletingId === a.id}
                        >
                          {deletingId === a.id ? "⏳" : "⋮"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className={styles.pagination}>
                  <span>
                    Showing {(safePage - 1) * PAGE_SIZE + 1} to{" "}
                    {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} assessments
                  </span>
                  <div className={styles.paginationControls}>
                    <button
                      className={styles.pageBtn}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                    >‹</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        className={`${styles.pageBtn} ${p === safePage ? styles.pageBtnActive : ""}`}
                        onClick={() => setCurrentPage(p)}
                      >{p}</button>
                    ))}
                    <button
                      className={styles.pageBtn}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                    >›</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
