"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listFriends, removeFriend, type FriendProfile } from "@/lib/api/friends";
import { openDirectConversation } from "@/lib/api/messages";
import { useRouter } from "next/navigation";

export default function FriendsPage() {
  const router = useRouter();
  const [items, setItems] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void listFriends().then(setItems).finally(() => setLoading(false)); }, []);
  async function message(userId: string) { const room = await openDirectConversation(userId); router.push(`/me/messages?direct=${room.id}`); }
  async function remove(userId: string) { await removeFriend(userId); setItems((v) => v.filter((x) => x.userId !== userId)); }
  return <div><h1 className="display" style={{fontSize:30,marginBottom:20}}>친구 목록</h1>{loading ? <p>불러오는 중…</p> : items.length===0 ? <div className="card" style={{padding:40,textAlign:"center"}}>아직 추가한 친구가 없습니다.</div> : <div style={{display:"grid",gap:12}}>{items.map((f)=><div key={f.userId} className="card" style={{padding:18,display:"flex",alignItems:"center",gap:14}}><div style={{width:48,height:48,borderRadius:99,background:f.avatarColor,color:"#fff",display:"grid",placeItems:"center",fontWeight:700}}>{f.name[0]}</div><div style={{flex:1}}><strong>{f.name}</strong><div style={{fontSize:13,color:"var(--text-2)"}}>{[f.age&&`${f.age}세`,f.job].filter(Boolean).join(" · ")||"프로필 정보 없음"}</div></div><Link className="btn" href={`/users/${f.userId}`}>프로필</Link><button className="btn btn-primary" onClick={()=>void message(f.userId)}>메시지</button><button className="btn" onClick={()=>void remove(f.userId)}>삭제</button></div>)}</div>}</div>;
}
