"use client";

import { useEffect, useState } from "react";
import { listPublicNotices, type AdminNotice } from "@/lib/api/admin";

// A slim notice strip for the top of the home screen (스토리보드 02).
// Shows the most relevant notice (pinned first, else newest). Renders nothing
// while loading or when there are no notices, so it never leaves an empty bar.
export function NoticeBar() {
  const [notice, setNotice] = useState<AdminNotice | null>(null);

  useEffect(() => {
    let alive = true;
    listPublicNotices()
      .then((rows) => {
        if (!alive || rows.length === 0) return;
        // API already returns pinned-first, newest-next.
        setNotice(rows[0]);
      })
      .catch(() => {
        /* silent: the bar just doesn't show */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!notice) return null;

  return (
    <div
      style={{
        background: "var(--bg-2)",
        borderBottom: "1px solid var(--border)",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        justifyContent: "center",
        fontSize: 13.5,
      }}
    >
      <span
        className="chip"
        style={{ fontSize: 11, background: "var(--primary)", color: "#fff", border: "none", flexShrink: 0 }}
      >
        공지
      </span>
      <span style={{ color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {notice.title}
      </span>
    </div>
  );
}
