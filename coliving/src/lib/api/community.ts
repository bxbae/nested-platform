import { USE_REAL_API } from "./config";
import { api } from "./client";
import type { Post } from "@/lib/types";
export type ApiCategory = "NOTICE" | "EVENT" | "CHORE" | "MARKET" | "CHAT" | "SEEKING";
export type PostStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CLOSED";
export interface ApiAuthor { id: string; name: string; avatarColor?: string | null; avatarUrl?: string | null; }
export interface ApiComment { id: string; body: string; createdAt: string; updatedAt?: string; parentId?: string | null; author: ApiAuthor; replies?: ApiComment[]; }
interface ApiPost { id: string; roomId: string; category: ApiCategory; status: PostStatus; title: string; body: string; pinned: boolean; createdAt: string; updatedAt?: string; author: ApiAuthor; lifestyleSnapshot?: Record<string, unknown> | null; sharedLifestyleFields?: string[]; _count?: { comments: number }; comments?: ApiComment[]; }
export interface PostDetail extends Post { authorId: string; status: PostStatus; comments: ApiComment[]; lifestyleSnapshot: Record<string, unknown> | null; sharedLifestyleFields: string[]; }
const toUi=(c:ApiCategory)=>c.toLowerCase() as Post["category"];
const toApi=(c:string)=>c.toUpperCase() as ApiCategory;
function adapt(p:ApiPost):Post { return { id:p.id, houseId:p.roomId, author:p.author?.name??"알 수 없음", authorId:p.author?.id, category:toUi(p.category), title:p.title, body:p.body, createdAt:p.createdAt, replies:p._count?.comments??0, pinned:p.pinned }; }
export async function listPosts(category="all",q="",status="all"):Promise<Post[]> { const keyword=q.trim(); if(!USE_REAL_API){ const r=await fetch(`/api/posts?category=${category}`); if(!r.ok)return[]; let rows:(Post[])=(await r.json()).posts??[]; if(keyword){const k=keyword.toLowerCase();rows=rows.filter(x=>x.title.toLowerCase().includes(k)||x.body.toLowerCase().includes(k));}return rows;} try { const p=new URLSearchParams({category,status}); if(keyword)p.set("q",keyword); return (await api.get<ApiPost[]>(`/posts?${p}`,{auth:false})).map(adapt); } catch{return[];} }
export async function getPost(id:string):Promise<PostDetail|null>{ if(!USE_REAL_API)return null; try{const p=await api.get<ApiPost>(`/posts/${id}`,{auth:false}); return {...adapt(p),authorId:p.author.id,status:p.status,comments:p.comments??[],lifestyleSnapshot:p.lifestyleSnapshot??null,sharedLifestyleFields:p.sharedLifestyleFields??[]};}catch{return null;} }
export async function createPost(input:{roomId:string;category:string;title:string;body:string;status?:PostStatus;sharedLifestyleFields?:string[]}):Promise<Post|null>{ if(!USE_REAL_API)return null; const p=await api.post<ApiPost>("/posts",{...input,category:toApi(input.category)});return adapt(p); }
export const addComment=(postId:string,body:string,parentId?:string)=>api.post<ApiComment>(`/posts/${postId}/comments`,{body,parentId});
export const updateComment=(id:string,body:string)=>api.patch<ApiComment>(`/posts/comments/${id}`,{body});
export async function deleteComment(id:string){await api.delete(`/posts/comments/${id}`);}
export async function updatePost(id:string,input:{category?:string;title?:string;body?:string;status?:PostStatus}){await api.patch(`/posts/${id}`,input.category?{...input,category:toApi(input.category)}:input);}
export async function deletePost(id:string){await api.delete(`/posts/${id}`);}
