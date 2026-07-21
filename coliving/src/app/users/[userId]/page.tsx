"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { addFriend, removeFriend, type FriendProfile } from "@/lib/api/friends";
import { getPublicUserProfile } from "@/lib/api/users";
import { openDirectConversation } from "@/lib/api/messages";

export default function UserProfilePage() {
  const { userId } = useParams<{userId:string}>(); const router=useRouter();
  const [profile,setProfile]=useState<FriendProfile|null>(null);
  useEffect(()=>{void getPublicUserProfile(userId).then(setProfile)},[userId]);
  if(!profile) return <p>프로필을 불러오는 중…</p>;
  async function toggle(){ if(profile!.isFriend){await removeFriend(userId);setProfile({...profile!,isFriend:false});}else{await addFriend(userId);setProfile({...profile!,isFriend:true});}}
  async function message(){const c=await openDirectConversation(userId);router.push(`/me/messages?direct=${c.id}`)}
  return <div className="wrap" style={{maxWidth:760,padding:"40px 20px"}}><div className="card" style={{padding:28}}><div style={{display:"flex",gap:18,alignItems:"center"}}><div style={{width:88,height:88,borderRadius:99,background:profile.avatarColor,color:"#fff",display:"grid",placeItems:"center",fontSize:32,fontWeight:700}}>{profile.name[0]}</div><div><h1 className="display" style={{margin:0}}>{profile.name}</h1><p style={{color:"var(--text-2)"}}>{[profile.age&&`${profile.age}세`,profile.job].filter(Boolean).join(" · ")}</p></div></div><h3>자기소개</h3><p>{profile.intro||profile.bio||"등록된 소개가 없습니다."}</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{profile.keywords.map(k=><span className="chip" key={k}>{k}</span>)}</div>{!profile.isMe&&<div style={{display:"flex",gap:10,marginTop:24}}><button className="btn" onClick={()=>void toggle()}>{profile.isFriend?"친구 삭제":"친구 추가"}</button><button className="btn btn-primary" onClick={()=>void message()}>메시지 보내기</button></div>}</div></div>;
}
