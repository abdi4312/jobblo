import React, { useEffect, useMemo, useState } from "react";

type Duration = { unit: "hours" | "days" | string; value?: number };
type UserRef = { _id: string; name?: string; email?: string };

type Job = {
  _id: string;
  userId: UserRef;
  title: string;
  description: string;
  price: number;
  location: string;
  categories: string[];
  images: string[];
  urgent: boolean;
  status: "open" | "closed" | "archived" | string;
  tags: string[];
  needTools: boolean;
  duration: Duration;
  createdAt: string;
  updatedAt: string;
  __v?: number;
};

type JobInput = Partial<Omit<Job, "_id" | "createdAt" | "updatedAt" | "__v">>;

const API = "/api/jobs";

export default function JobsBeautiful() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  const [form, setForm] = useState<JobInput>(emptyForm());

  const selectedJob = useMemo(
    () => jobs.find((j) => j._id === selectedId) || null,
    [selectedId, jobs]
  );

  useEffect(() => {
    loadAll();
  }, []);

  // Keep form in sync when selecting a job for edit
  useEffect(() => {
    if (editId) {
      const j = jobs.find((x) => x._id === editId);
      if (j) {
        setForm({
          userId: j.userId?._id ? { _id: j.userId._id } : { _id: "" },
          title: j.title,
          description: j.description,
          price: j.price,
          location: j.location,
          categories: j.categories || [],
          images: j.images || [],
          urgent: j.urgent,
          status: j.status,
          tags: j.tags || [],
          needTools: j.needTools,
          duration: { unit: j.duration?.unit ?? "hours", value: j.duration?.value },
        });
      }
    } else {
      setForm(emptyForm());
    }
  }, [editId, jobs]);

  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "—");

  const json = (res: Response) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  };

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const data = (await fetch(API).then(json)) as Job[] | Job;
      setJobs(Array.isArray(data) ? data : [data]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function createJob() {
    setLoading(true);
    setError(null);
    try {
      await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanForm(form)),
      }).then(json);
      await loadAll();
      resetEditor();
      toast("Created");
    } catch (e: any) {
      setError(e?.message ?? "Failed to create");
    } finally {
      setLoading(false);
    }
  }

  async function updateJob() {
    if (!editId) return;
    setLoading(true);
    setError(null);
    try {
      await fetch(`${API}/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanForm(form)),
      }).then(json);
      await loadAll();
      toast("Updated");
    } catch (e: any) {
      setError(e?.message ?? "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  async function deleteJob(id: string) {
    if (!confirm("Delete this job?")) return;
    setLoading(true);
    setError(null);
    try {
      await fetch(`${API}/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      });
      await loadAll();
      if (selectedId === id) setSelectedId(null);
      if (editId === id) resetEditor();
      toast("Deleted");
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete");
    } finally {
      setLoading(false);
    }
  }

  function cleanForm(f: JobInput): JobInput {
    return {
      ...f,
      price: typeof f.price === "string" ? Number(f.price) : (f.price as number),
      categories: toArray(f.categories),
      images: toArray(f.images),
      tags: toArray(f.tags),
      userId:
        typeof f.userId === "string"
          ? { _id: f.userId }
          : f.userId && f.userId._id
          ? f.userId
          : { _id: "" },
      duration: f.duration
        ? { unit: f.duration.unit, value: toNumOrUndef(f.duration.value) }
        : undefined,
    };
  }

  function toArray(v: any): string[] {
    if (Array.isArray(v)) return v;
    if (typeof v === "string")
      return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return [];
  }
  function toNumOrUndef(v: any): number | undefined {
    if (v === null || v === undefined || v === "") return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }
  function emptyForm(): JobInput {
    return {
      userId: { _id: "" },
      title: "",
      description: "",
      price: 0,
      location: "",
      categories: [],
      images: [],
      urgent: false,
      status: "open",
      tags: [],
      needTools: false,
      duration: { unit: "hours", value: undefined },
    };
  }
  function setField<K extends keyof JobInput>(key: K, value: JobInput[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }
  function resetEditor() {
    setEditId(null);
    setForm(emptyForm());
  }
  function toast(msg: string) {
    // tiny inline toast
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      padding: "10px 14px",
      background: "#111827",
      color: "white",
      borderRadius: "8px",
      boxShadow: "0 10px 20px rgba(0,0,0,0.25)",
      zIndex: "9999",
      fontSize: "14px",
    } as CSSStyleDeclaration);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => {
      const hay = [
        j.title,
        j.description,
        j.location,
        j.status,
        ...(j.categories || []),
        ...(j.tags || []),
        j.userId?._id,
        j.userId?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [jobs, search]);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.h1}>Jobs</h1>
          <span style={styles.countBadge}>{jobs.length}</span>
        </div>

        <div style={styles.actions}>
          <div style={styles.searchWrap}>
            <input
              style={styles.search}
              placeholder="Search title, tags, location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span style={styles.searchIcon}>🔎</span>
          </div>

          <button
            style={{ ...styles.btn, ...styles.primary }}
            onClick={() => {
              resetEditor();
              setEditId(null);
            }}
            title="Create new job"
          >
            + New
          </button>

          <button
            style={{ ...styles.btn, ...styles.ghost }}
            onClick={loadAll}
            disabled={loading}
            title="Refresh"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {/* Left: List */}
        <section style={styles.listPane}>
          {!loading && !error && filtered.length === 0 && (
            <div style={styles.emptyCard}>No jobs match your search.</div>
          )}

          <div style={styles.grid}>
            {filtered.map((j) => (
              <article
                key={j._id}
                style={{
                  ...styles.card,
                  ...(selectedId === j._id ? styles.cardSelected : {}),
                }}
                onClick={() => setSelectedId(j._id)}
              >
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>{j.title || "Untitled job"}</h3>
                  <span style={{ ...styles.status, ...statusStyle(j.status) }}>
                    {j.status}
                  </span>
                </div>

                <p style={styles.cardDesc}>
                  {j.description?.length
                    ? truncate(j.description, 140)
                    : "No description provided."}
                </p>

                <div style={styles.metaRow}>
                  <Meta label="Price" value={typeof j.price === "number" ? `NOK ${j.price}` : "—"} />
                  <Meta label="Location" value={j.location || "—"} />
                  <Meta label="Duration" value={`${j.duration?.value ?? "?"} ${j.duration?.unit ?? ""}`} />
                </div>

                {(j.categories?.length || j.tags?.length) && (
                  <div style={styles.chipsRow}>
                    {(j.categories || []).slice(0, 3).map((c, i) => (
                      <Chip key={i} text={c} variant="cyan" />
                    ))}
                    {(j.tags || []).slice(0, 3).map((t, i) => (
                      <Chip key={i} text={t} variant="indigo" />
                    ))}
                  </div>
                )}

                <div style={styles.cardFooter}>
                  <small style={styles.time}>
                    Created {fmt(j.createdAt)} • Updated {fmt(j.updatedAt)}
                  </small>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={{ ...styles.btnSm, ...styles.ghost }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditId(j._id);
                        setSelectedId(j._id);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      style={{ ...styles.btnSm, ...styles.danger }}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteJob(j._id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {error && <div style={styles.error}>{error}</div>}
        </section>

        {/* Right: Editor */}
        <aside style={styles.editorPane}>
          <div style={styles.editorCard}>
            <div style={styles.editorHeader}>
              <h2 style={styles.h2}>{editId ? "Edit Job" : "Create Job"}</h2>
              {selectedJob && (
                <span style={styles.smallId}>ID: {selectedJob._id}</span>
              )}
            </div>

            <div style={styles.formGrid}>
              <Field label="User ID">
                <input
                  style={styles.input}
                  placeholder="user _id"
                  value={
                    typeof form.userId === "string"
                      ? form.userId
                      : form.userId?._id || ""
                  }
                  onChange={(e) => setField("userId", { _id: e.target.value })}
                />
              </Field>

              <Field label="Title">
                <input
                  style={styles.input}
                  placeholder="e.g., Paint living room"
                  value={form.title || ""}
                  onChange={(e) => setField("title", e.target.value)}
                />
              </Field>

              <Field label="Price (NOK)">
                <input
                  style={styles.input}
                  type="number"
                  placeholder="0"
                  value={(form.price as any) ?? ""}
                  onChange={(e) => setField("price", e.target.value)}
                />
              </Field>

              <Field label="Location">
                <input
                  style={styles.input}
                  placeholder="Oslo"
                  value={form.location || ""}
                  onChange={(e) => setField("location", e.target.value)}
                />
              </Field>

              <Field label="Status">
                <select
                  style={styles.input}
                  value={form.status || "open"}
                  onChange={(e) => setField("status", e.target.value)}
                >
                  <option value="open">open</option>
                  <option value="closed">closed</option>
                  <option value="archived">archived</option>
                </select>
              </Field>

              <Field label="Urgent">
                <Toggle
                  checked={!!form.urgent}
                  onChange={(v) => setField("urgent", v)}
                />
              </Field>

              <Field label="Need Tools">
                <Toggle
                  checked={!!form.needTools}
                  onChange={(v) => setField("needTools", v)}
                />
              </Field>

              <Field label="Duration Unit">
                <input
                  style={styles.input}
                  placeholder="hours"
                  value={form.duration?.unit || "hours"}
                  onChange={(e) =>
                    setField("duration", { ...form.duration, unit: e.target.value })
                  }
                />
              </Field>

              <Field label="Duration Value">
                <input
                  style={styles.input}
                  type="number"
                  placeholder="e.g., 3"
                  value={(form.duration?.value as any) ?? ""}
                  onChange={(e) =>
                    setField("duration", { ...form.duration, value: e.target.value })
                  }
                />
              </Field>

              <Field label="Categories (comma)">
                <input
                  style={styles.input}
                  placeholder="cat1, cat2"
                  value={
                    Array.isArray(form.categories)
                      ? form.categories.join(", ")
                      : (form.categories as any) || ""
                  }
                  onChange={(e) => setField("categories", e.target.value)}
                />
              </Field>

              <Field label="Tags (comma)">
                <input
                  style={styles.input}
                  placeholder="tag1, tag2"
                  value={
                    Array.isArray(form.tags)
                      ? form.tags.join(", ")
                      : (form.tags as any) || ""
                  }
                  onChange={(e) => setField("tags", e.target.value)}
                />
              </Field>

              <Field label="Images (comma URLs)" full>
                <input
                  style={styles.input}
                  placeholder="https://..., https://..."
                  value={
                    Array.isArray(form.images)
                      ? form.images.join(", ")
                      : (form.images as any) || ""
                  }
                  onChange={(e) => setField("images", e.target.value)}
                />
              </Field>

              <Field label="Description" full>
                <textarea
                  style={{ ...styles.input, height: 120, resize: "vertical" }}
                  placeholder="Describe the job"
                  value={form.description || ""}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </Field>
            </div>

            <div style={styles.editorActions}>
              {!editId ? (
                <button
                  style={{ ...styles.btn, ...styles.primary }}
                  onClick={createJob}
                  disabled={loading}
                >
                  {loading ? "Saving…" : "Create Job"}
                </button>
              ) : (
                <>
                  <button
                    style={{ ...styles.btn, ...styles.primary }}
                    onClick={updateJob}
                    disabled={loading}
                  >
                    {loading ? "Saving…" : "Save Changes"}
                  </button>
                  <button
                    style={{ ...styles.btn, ...styles.ghost }}
                    onClick={resetEditor}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

/* ---------- Small presentational helpers ---------- */

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ color: "#6b7280", fontSize: 12 }}>{label}</span>
      <span style={{ color: "#111827", fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Chip({ text, variant = "indigo" as const }: { text: string; variant?: "indigo" | "cyan" }) {
  const palette =
    variant === "indigo"
      ? { bg: "#eef2ff", fg: "#3730a3" }
      : { bg: "#ecfeff", fg: "#155e75" };
  return (
    <span
      style={{
        background: palette.bg,
        color: palette.fg,
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
      }}
    >
      {text}
    </span>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 6, gridColumn: full ? "1 / -1" : undefined }}>
      <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 48,
        height: 28,
        borderRadius: 999,
        background: checked ? "#16a34a" : "#e5e7eb",
        position: "relative",
        border: "none",
        outline: "none",
        cursor: "pointer",
      }}
      aria-pressed={checked}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 24 : 3,
          width: 22,
          height: 22,
          background: "white",
          borderRadius: 999,
          transition: "left 160ms",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fafc, #ffffff)",
    color: "#111827",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "16px 20px",
    borderBottom: "1px solid #e5e7eb",
    background: "rgba(255,255,255,0.9)",
    backdropFilter: "saturate(180%) blur(8px)",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  h1: { fontSize: 22, margin: 0, letterSpacing: 0.2 },
  countBadge: {
    fontSize: 12,
    background: "#111827",
    color: "white",
    padding: "2px 8px",
    borderRadius: 999,
  },
  actions: { display: "flex", alignItems: "center", gap: 10 },
  searchWrap: { position: "relative" as const },
  search: {
    width: 260,
    padding: "10px 30px 10px 36px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    outline: "none",
  },
  searchIcon: {
    position: "absolute",
    left: 10,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 14,
    color: "#6b7280",
  },
  btn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  btnSm: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
  },
  primary: { background: "#111827", color: "white", border: "1px solid #111827" },
  ghost: { background: "#ffffff", color: "#111827" },
  danger: { background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" },
  main: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 1fr) minmax(420px, 520px)",
    gap: 16,
    padding: 16,
    alignItems: "start",
  },
  listPane: { display: "grid", gap: 12 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 12,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
    transition: "transform 120ms, box-shadow 120ms, border-color 120ms",
    cursor: "pointer",
  },
  cardSelected: {
    borderColor: "#111827",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    transform: "translateY(-1px)",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 },
  cardTitle: { margin: 0, fontSize: 16, lineHeight: 1.2 },
  status: {
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 999,
    textTransform: "capitalize",
  },
  cardDesc: { color: "#374151", fontSize: 14, margin: "8px 0 6px" },
  metaRow: { display: "flex", gap: 16, flexWrap: "wrap" },
  chipsRow: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 },
  cardFooter: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  time: { color: "#6b7280", fontSize: 12 },
  emptyCard: {
    padding: 16,
    background: "#fafafa",
    border: "1px dashed #e5e7eb",
    borderRadius: 12,
    color: "#6b7280",
    textAlign: "center" as const,
  },
  editorPane: { position: "sticky", top: 72 },
  editorCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
  },
  editorHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  h2: { margin: 0, fontSize: 18 },
  smallId: { color: "#6b7280", fontSize: 12 },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(160px, 1fr))",
    gap: 10,
    marginTop: 6,
  },
  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    outline: "none",
    background: "#fff",
  },
  editorActions: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 10,
  },
  error: {
    padding: 12,
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fee2e2",
    borderRadius: 10,
  },
};

function statusStyle(s?: string): React.CSSProperties {
  const map: Record<string, { bg: string; fg: string; border?: string }> = {
    open: { bg: "#ecfdf5", fg: "#065f46" },
    closed: { bg: "#fef3c7", fg: "#92400e" },
    archived: { bg: "#f3f4f6", fg: "#374151" },
  };
  const x = (s && map[s]) || map.open;
  return { background: x.bg, color: x.fg };
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}