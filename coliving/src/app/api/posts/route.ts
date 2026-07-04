import { NextRequest, NextResponse } from "next/server";
import { posts } from "@/lib/data";
import type { Post } from "@/lib/types";

// module-level copy so new posts persist across requests in dev
declare global {
  // eslint-disable-next-line no-var
  var __posts: Post[] | undefined;
}
const store: Post[] = globalThis.__posts ?? [...posts];
globalThis.__posts = store;

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category");
  let result = [...store];
  if (category && category !== "all") {
    result = result.filter((p) => p.category === category);
  }
  result.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return NextResponse.json({ posts: result });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const post: Post = {
    id: `p${Date.now()}`,
    houseId: "h1",
    author: body.author || "You",
    category: body.category || "chat",
    title: body.title,
    body: body.body,
    createdAt: new Date().toISOString(),
    replies: 0,
    pinned: false,
  };
  store.unshift(post);
  return NextResponse.json({ post });
}
