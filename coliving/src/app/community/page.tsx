"use client";

import { useEffect, useState, useCallback } from "react";
import type { Post } from "@/lib/types";

const categories = [
  { id: "all", label: "All" },
  { id: "notice", label: "Notices" },
  { id: "event", label: "Events" },
  { id: "chore", label: "Chores" },
  { id: "market", label: "Market" },
  { id: "chat", label: "Chat" },
];

const catColor: Record<string, string> = {
  notice: "#FF5A5F",
  event: "#00A699",
  chore: "#3E9BC4",
  market: "#7C6FE0",
  chat: "#717171",
};

export default function Community() {
  const [cat, setCat] = useState("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "", category: "chat" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/posts?category=${cat}`);
    const data = await res.json();
    setPosts(data.posts);
    setLoading(false);
  }, [cat]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!draft.title.trim()) return;
    await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, author: "You" }),
    });
    setDraft({ title: "", body: "", category: "chat" });
    setShowNew(false);
    setCat("all");
    load();
  }

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 820 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <span className="eyebrow">Seongsu Loom · house feed</span>
          <h1 className="display" style={{ fontSize: 40, marginTop: 8 }}>
            Community
          </h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew((s) => !s)}>
          {showNew ? "Close" : "New post"}
        </button>
      </div>

      {showNew && (
        <div className="card" style={{ padding: 20, marginTop: 20, display: "grid", gap: 14 }}>
          <div className="field">
            <label>Title</label>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="What's going on?"
            />
          </div>
          <div className="field">
            <label>Details</label>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="Add a little context for your housemates."
              rows={3}
              style={{ padding: 11, border: "1px solid var(--border)", borderRadius: 8, resize: "vertical" }}
            />
          </div>
          <div className="field">
            <label>Category</label>
            <div style={{ display: "flex", gap: 7 }}>
              {categories.slice(1).map((c) => (
                <button
                  key={c.id}
                  className="chip"
                  data-active={draft.category === c.id}
                  onClick={() => setDraft({ ...draft, category: c.id })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" style={{ justifySelf: "start" }} onClick={submit}>
            Post to the house
          </button>
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "22px 0" }}>
        {categories.map((c) => (
          <button key={c.id} className="chip" data-active={cat === c.id} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div style={{ display: "grid", gap: 12 }}>
        {loading && <div style={{ color: "var(--text-2)" }}>Loading feed…</div>}
        {posts.map((p) => (
          <article
            key={p.id}
            className="card"
            style={{
              padding: 18,
              borderLeft: `3px solid ${catColor[p.category]}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  className="chip"
                  style={{
                    background: `${catColor[p.category]}18`,
                    color: catColor[p.category],
                    border: "none",
                    fontSize: 11.5,
                    textTransform: "capitalize",
                  }}
                >
                  {p.category}
                </span>
                {p.pinned && (
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>📌 pinned</span>
                )}
              </div>
              <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                {timeAgo(p.createdAt)}
              </span>
            </div>
            <h3 style={{ fontSize: 17, marginTop: 10 }}>{p.title}</h3>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginTop: 6 }}>{p.body}</p>
            <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13, color: "var(--text-2)" }}>
              <span>by {p.author}</span>
              <span>💬 {p.replies} replies</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
