"use client";
import { useState } from "react";
import { createReport, type ReportTargetType } from "@/lib/api/reports";
const REASONS=["욕설·비방","광고·스팸","허위 정보","개인정보 노출","부적절한 거래","사기 의심","기타"];
export function CommunityReportModal({type,targetId,onClose}:{type:Extract<ReportTargetType,"COMMUNITY_POST"|"COMMUNITY_COMMENT">;targetId:string;onClose:()=>void}){
 const [reason,setReason]=useState(REASONS[0]); const [detail,setDetail]=useState(""); const [busy,setBusy]=useState(false);
 async function submit(){setBusy(true);try{await createReport(type,targetId,reason==="기타"?detail.trim():reason);alert("신고가 접수되었습니다.");onClose();}catch(e){alert(e instanceof Error?e.message:"신고하지 못했습니다.");}finally{setBusy(false)}}
 return <div role="dialog" aria-modal="true" style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.38)",display:"grid",placeItems:"center",padding:20}} onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}><div className="card" style={{width:"min(440px,100%)",padding:22}}><h2 style={{fontSize:20}}>신고하기</h2><p style={{fontSize:13,color:"var(--text-2)",margin:"6px 0 16px"}}>관리자가 원문과 신고 사유를 검토합니다.</p><div style={{display:"grid",gap:8}}>{REASONS.map(r=><label key={r} style={{display:"flex",gap:8,fontSize:14}}><input type="radio" checked={reason===r} onChange={()=>setReason(r)}/>{r}</label>)}</div>{reason==="기타"&&<textarea value={detail} onChange={e=>setDetail(e.target.value)} rows={3} placeholder="신고 사유를 입력하세요" style={{width:"100%",marginTop:12}}/>}<div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}><button className="btn btn-ghost" onClick={onClose}>취소</button><button className="btn btn-primary" disabled={busy||(reason==="기타"&&!detail.trim())} onClick={submit}>{busy?"접수 중…":"신고하기"}</button></div></div></div>
}
