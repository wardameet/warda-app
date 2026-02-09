// @ts-nocheck
import React, { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════
// 🌹 WARDA UNIFIED PORTAL — Phase 1: Login + Auth + Role Routing
// API: https://api.meetwarda.com | Auth: AWS Cognito via backend
// ═══════════════════════════════════════════════════════════════════

const API = "https://api.meetwarda.com";

// ─── API Helper ───
const api = {
  post: async (path: string, body: any) => {
    const token = localStorage.getItem("warda_token");
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return res.json();
  },
  get: async (path: string) => {
    const token = localStorage.getItem("warda_token");
    const res = await fetch(`${API}${path}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    return res.json();
  },
};

const T={bg:"#F8F7F4",card:"#FFF",sidebar:"#1A1F2E",sidebarActive:"#0D9488",teal:"#0D9488",tealLight:"#CCFBF1",tealDark:"#0F766E",gold:"#D4A853",goldLight:"#FEF3C7",rose:"#E11D48",roseLight:"#FFE4E6",blue:"#3B82F6",blueLight:"#DBEAFE",purple:"#8B5CF6",purpleLight:"#EDE9FE",amber:"#F59E0B",amberLight:"#FEF3C7",green:"#10B981",greenLight:"#D1FAE5",text:"#1E293B",textMuted:"#64748B",textLight:"#94A3B8",border:"#E2E8F0",borderLight:"#F1F5F9"};

// Mock Data
const CARE_HOMES=[{id:1,name:"Sunny Gardens",location:"Edinburgh",residents:32,staff:8,status:"active",engagement:78,monthlyRevenue:960,plan:"Premium",manager:"Emma MacLeod"},{id:2,name:"Highland Rest",location:"Inverness",residents:28,staff:6,status:"active",engagement:72,monthlyRevenue:700,plan:"Standard",manager:"Ian Ross"},{id:3,name:"Loch View Care",location:"Glasgow",residents:30,staff:7,status:"pending",engagement:0,monthlyRevenue:0,plan:"Premium",manager:"—"}];

const RESIDENTS=[
{id:1,name:"Margaret MacLeod",age:82,room:"Room 12",careHome:"Sunny Gardens",careHomeId:1,mood:8.2,lastActive:"2 min ago",status:"active",conversations:12,family:["Sarah (Daughter)","Tom (Son)"],medication:"10 AM Paracetamol, 2 PM Simvastatin",questionnaire:"complete"},
{id:2,name:"James Campbell",age:79,room:"Room 5",careHome:"Sunny Gardens",careHomeId:1,mood:6.5,lastActive:"1 hr ago",status:"active",conversations:8,family:["Mary (Wife)"],medication:"8 AM Metformin",questionnaire:"complete"},
{id:3,name:"Agnes Murray",age:88,room:"Room 3",careHome:"Highland Rest",careHomeId:2,mood:4.2,lastActive:"3 hrs ago",status:"flagged",conversations:3,family:["Robert (Son)"],medication:"9 AM Amlodipine",questionnaire:"complete"},
{id:4,name:"Robert Fraser",age:75,room:"Room 8",careHome:"Highland Rest",careHomeId:2,mood:7.8,lastActive:"30 min ago",status:"active",conversations:15,family:["Jean (Wife)","Claire (Daughter)"],medication:"8 AM Aspirin",questionnaire:"complete"},
{id:5,name:"Dorothy Stewart",age:91,room:"Room 1",careHome:"Sunny Gardens",careHomeId:1,mood:7.0,lastActive:"45 min ago",status:"active",conversations:9,family:["William (Son)"],medication:"7 AM Levothyroxine",questionnaire:"in_progress"},
{id:6,name:"George Hamilton",age:85,room:"Room 7",careHome:"Sunny Gardens",careHomeId:1,mood:7.5,lastActive:"15 min ago",status:"active",conversations:11,family:["Linda (Daughter)"],medication:"9 AM Warfarin",questionnaire:"complete"}
];

const STAFF=[{id:1,name:"Emma MacLeod",role:"Manager",email:"emma@sunnygardens.care",assigned:32,status:"active",lastLogin:"Today 8:15 AM"},{id:2,name:"Fiona Grant",role:"Carer",email:"fiona@sunnygardens.care",assigned:8,status:"active",lastLogin:"Today 9:30 AM"},{id:3,name:"Callum Murray",role:"Nurse",email:"callum@sunnygardens.care",assigned:12,status:"active",lastLogin:"Today 7:45 AM"},{id:4,name:"Isla Thompson",role:"Carer",email:"isla@sunnygardens.care",assigned:0,status:"on_leave",lastLogin:"3 days ago"}];

const FAMILY_CONTACTS=[{id:1,name:"Sarah MacLeod",rel:"Daughter",resident:"Margaret MacLeod",phone:"07700 123456",email:"sarah@email.com",primary:true,lastContact:"Today 10:30 AM"},{id:2,name:"Tom MacLeod",rel:"Son",resident:"Margaret MacLeod",phone:"07700 654321",email:"tom@email.com",primary:false,lastContact:"Yesterday"},{id:3,name:"Mary Campbell",rel:"Wife",resident:"James Campbell",phone:"07700 111222",email:"mary@email.com",primary:true,lastContact:"2 hrs ago"}];

const B2C_ORDERS=[{id:"ORD-001",family:"James Wilson",elderly:"Mary Wilson (68)",plan:"Family Plus",status:"pending_payment",date:"2026-02-08",amount:29.99},{id:"ORD-002",family:"Sarah Ahmed",elderly:"Fatima Ahmed (84)",plan:"Family Premium",status:"paid_awaiting_dispatch",date:"2026-02-07",amount:39.99},{id:"ORD-003",family:"Tom MacGregor",elderly:"Jean MacGregor (77)",plan:"Family Basic",status:"dispatched",date:"2026-02-05",amount:19.99}];

const ALERTS=[
{id:1,type:"mood",resident:"Agnes Murray",careHome:"Highland Rest",chId:2,severity:"high",msg:"Mood below 5.0 for 3 days",time:"10 min ago",resolved:false},
{id:2,type:"help",resident:"James Campbell",careHome:"Sunny Gardens",chId:1,severity:"critical",msg:"Help button — auto-escalated after 5 min",time:"25 min ago",resolved:false},
{id:3,type:"inactivity",resident:"Dorothy Stewart",careHome:"Sunny Gardens",chId:1,severity:"medium",msg:"No interaction in 8 hours",time:"1 hr ago",resolved:true},
{id:4,type:"health",resident:"Robert Fraser",careHome:"Highland Rest",chId:2,severity:"low",msg:"Mentioned chest discomfort",time:"2 hrs ago",resolved:false},
{id:5,type:"medication",resident:"Margaret MacLeod",careHome:"Sunny Gardens",chId:1,severity:"medium",msg:"Missed afternoon medication",time:"3 hrs ago",resolved:false}
];

const MESSAGES=[
{id:1,from:"Sarah",content:"Hi Mum! The kids loved the park today. Sending you photos! 💕",time:"10:30 AM",type:"text",dir:"in"},
{id:2,from:"Margaret",content:"Tell Sarah I love her and the wee ones!",time:"10:45 AM",type:"warda",dir:"out"},
{id:3,from:"Tom",content:"Morning Mum! I'll visit Saturday around 2pm. Love you!",time:"9:15 AM",type:"text",dir:"in"},
{id:4,from:"Sarah",content:"",time:"11:00 AM",type:"photo",dir:"in",caption:"Emily at the swings!"},
{id:5,from:"Margaret",content:"Warda helped me record this for you.",time:"11:30 AM",type:"voice",dir:"out"}
];

const REV_DATA=[{m:"Sep",b2b:1200,b2c:340},{m:"Oct",b2b:1450,b2c:480},{m:"Nov",b2b:1660,b2c:620},{m:"Dec",b2b:1660,b2c:750},{m:"Jan",b2b:1960,b2c:890},{m:"Feb",b2b:2160,b2c:1040}];

const DEVICES=[
{code:"SUNNY-ABCD-1234-EFGH",ch:"Sunny Gardens",device:"Lounge Tablet 1",status:"ACTIVE",resident:"Margaret MacLeod",activated:"2026-01-15"},
{code:"SUNNY-WXYZ-5678-IJKL",ch:"Sunny Gardens",device:"Room 5 Tablet",status:"ACTIVE",resident:"James Campbell",activated:"2026-01-15"},
{code:"HIGH-MNOP-9012-QRST",ch:"Highland Rest",device:"Room 3 Tablet",status:"SUSPENDED",resident:"Agnes Murray",activated:"2026-01-20"},
{code:"LOCH-UVWX-3456-YZAB",ch:"Loch View Care",device:"Unassigned",status:"PENDING",resident:"—",activated:"—"}
];

const Q_STEPS=[{s:1,t:"Personal Details",f:["Full name","Preferred name","Date of birth","Room number","Emergency contact"]},{s:2,t:"Family & Relationships",f:["Family members","Relationships","Visit schedule","Important people"]},{s:3,t:"Life History",f:["Where they grew up","Occupation","Proudest moments","Hobbies & interests"]},{s:4,t:"Health & Mobility",f:["Conditions","Medications","Mobility level","Hearing/vision","GP details"]},{s:5,t:"Daily Routine",f:["Wake time","Meals preference","Activities","Bedtime","Night needs"]},{s:6,t:"Communication Style",f:["Language","Pace preference","Humour type","Topics to avoid","Formality"]},{s:7,t:"Faith & Culture",f:["Religion/faith","Cultural practices","Dietary requirements","Music preferences","Comfort phrases"]}];


// Shared Components
const Ico=({d,s=20,c="currentColor",d2}:any)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d}/>{d2&&<path d={d2}/>}</svg>;
const ic={
  dashboard:"M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  careHome:"M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  residents:"M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  clipboard:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  bell:"M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  tablet:"M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  billing:"M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  chart:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  settings:"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  home:"M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  chat:"M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  camera:"M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z",
  video:"M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
  user:"M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  staff:"M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  family:"M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  search:"M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  plus:"M12 4v16m8-8H4",
  heart:"M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  send:"M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
};
const NavIco=({name,s=18,c}:any)=>{const d2=name==="settings"?"M15 12a3 3 0 11-6 0 3 3 0 016 0z":name==="camera"?"M15 13a3 3 0 11-6 0 3 3 0 016 0z":name==="user"?null:null;return <Ico d={ic[name]||ic.dashboard} s={s} c={c} d2={d2}/>};

const Badge=({children,color=T.teal,bg}:any)=><span style={{display:"inline-flex",alignItems:"center",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:600,letterSpacing:.3,color,backgroundColor:bg||(color+"18")}}>{children}</span>;
const Avatar=({name,size=32,bg=T.tealLight,color=T.teal}:any)=><div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.38,fontWeight:700,color,flexShrink:0}}>{name.split(" ").map(n=>n[0]).join("")}</div>;
const MoodBadge=({mood}:any)=><span style={{fontWeight:700,color:mood>=7?T.green:mood>=5?T.amber:T.rose}}>{mood}<span style={{color:T.textLight,fontSize:11,fontWeight:400}}>/10</span></span>;
const StatCard=({label,value,trend,color=T.teal}:any)=><div style={{background:T.card,borderRadius:16,padding:"22px 24px",border:`1px solid ${T.border}`,flex:"1 1 160px",minWidth:160,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:-8,right:-8,width:60,height:60,borderRadius:"50%",background:color+"10"}}/><div style={{fontSize:11,color:T.textMuted,fontWeight:500,marginBottom:6,textTransform:"uppercase",letterSpacing:.8}}>{label}</div><div style={{fontSize:28,fontWeight:700,color:T.text,letterSpacing:-.5}}>{value}</div>{trend&&<div style={{fontSize:12,color:trend.startsWith("+")||trend.startsWith("↑")?T.green:T.textMuted,marginTop:4,fontWeight:500}}>{trend}</div>}</div>;
const SH=({title,action,al}:any)=><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h2 style={{fontSize:18,fontWeight:700,color:T.text,margin:0}}>{title}</h2>{action&&<button onClick={action} style={{background:T.teal,color:"#fff",border:"none",borderRadius:10,padding:"8px 18px",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Ico d={ic.plus} s={14} c="#fff"/>{al}</button>}</div>;
const Btn=({children,color=T.teal,outline,small,onClick}:any)=><button onClick={onClick} style={{padding:small?"4px 12px":"8px 18px",borderRadius:small?6:10,border:outline?`1px solid ${T.border}`:"none",background:outline?T.card:color,color:outline?T.text:"#fff",fontSize:small?11:13,fontWeight:600,cursor:"pointer"}}>{children}</button>;

const Tbl=({headers,children}:any)=><div style={{background:T.card,borderRadius:16,border:`1px solid ${T.border}`,overflow:"hidden"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{background:T.borderLight}}>{headers.map(h=><th key={h} style={{padding:"12px 16px",textAlign:"left",fontWeight:600,color:T.textMuted,fontSize:11,textTransform:"uppercase",letterSpacing:.5}}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
const Td=({children,bold,mono,muted,style:s}:any)=><td style={{padding:"14px 16px",fontWeight:bold?600:400,fontFamily:mono?"monospace":"inherit",color:muted?T.textMuted:T.text,fontSize:mono?12:13,...s}}>{children}</td>;

const AlertCard=({a,showCH=true}:any)=><div style={{background:T.card,borderRadius:14,padding:"18px 22px",border:`1px solid ${a.severity==="critical"?T.rose+"40":a.severity==="high"?T.amber+"40":T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",opacity:a.resolved?.5:1,flexWrap:"wrap",gap:10}}><div style={{display:"flex",alignItems:"center",gap:16,flex:1,minWidth:200}}><div style={{width:40,height:40,borderRadius:10,background:a.severity==="critical"?T.roseLight:a.severity==="high"?T.amberLight:T.blueLight,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ico d={ic.bell} s={18} c={a.severity==="critical"?T.rose:a.severity==="high"?T.amber:T.blue}/></div><div><div style={{fontSize:14,fontWeight:600,marginBottom:2}}>{a.resident}{showCH&&a.careHome&&<span style={{fontWeight:400,color:T.textMuted}}> — {a.careHome}</span>}</div><div style={{fontSize:12,color:T.textMuted}}>{a.msg}</div></div></div><div style={{display:"flex",alignItems:"center",gap:14}}><Badge color={{critical:T.rose,high:T.amber,medium:T.blue,low:T.green}[a.severity]} bg={{critical:T.roseLight,high:T.amberLight,medium:T.blueLight,low:T.greenLight}[a.severity]}>{a.severity}</Badge><span style={{fontSize:11,color:T.textLight}}>{a.time}</span>{!a.resolved?<Btn small outline>Resolve</Btn>:<span style={{fontSize:11,color:T.green,fontWeight:600}}>✓ Resolved</span>}</div></div>;

const MiniChart=({data}:any)=>{const max=Math.max(...data.map(d=>d.b2b+d.b2c));return<div style={{display:"flex",alignItems:"flex-end",gap:8,height:120,padding:"0 4px"}}>{data.map((d,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{width:"100%",display:"flex",flexDirection:"column",gap:1,alignItems:"center"}}><div style={{width:"80%",height:Math.max(4,(d.b2c/max)*100),background:T.amber,borderRadius:"4px 4px 0 0"}}/><div style={{width:"80%",height:Math.max(4,(d.b2b/max)*100),background:T.teal,borderRadius:"0 0 4px 4px"}}/></div><span style={{fontSize:10,color:T.textLight}}>{d.m}</span></div>)}</div>};


// ══════ SUPER ADMIN SCREENS ══════
const SA_Dashboard=()=><div style={{display:"flex",flexDirection:"column",gap:24}}><div><h1 style={{fontSize:24,fontWeight:700,margin:"0 0 4px"}}>Platform Overview</h1><p style={{color:T.textMuted,margin:0,fontSize:14}}>Welcome back. Here's what's happening across Warda.</p></div><div style={{display:"flex",gap:16,flexWrap:"wrap"}}><StatCard label="Care Homes" value="3" trend="+1 this month" color={T.teal}/><StatCard label="Total Residents" value="90" trend="+12 this month" color={T.green}/><StatCard label="Active Today" value="61" trend="68% engagement" color={T.blue}/><StatCard label="B2C Subscribers" value="23" trend="+5 this month" color={T.amber}/><StatCard label="Monthly Revenue" value="£3,200" trend="+18% MoM" color={T.gold}/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><div style={{fontSize:15,fontWeight:700}}>Revenue (6 months)</div><div style={{display:"flex",gap:12,fontSize:11}}><span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:T.teal,display:"inline-block"}}/>B2B</span><span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:T.amber,display:"inline-block"}}/>B2C</span></div></div><MiniChart data={REV_DATA}/></div><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{fontSize:15,fontWeight:700,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>Active Alerts <Badge color={T.rose} bg={T.roseLight}>{ALERTS.filter(a=>!a.resolved).length}</Badge></div><div style={{display:"flex",flexDirection:"column",gap:10}}>{ALERTS.filter(a=>!a.resolved).slice(0,3).map(a=><div key={a.id} style={{padding:"10px 14px",borderRadius:10,background:a.severity==="critical"?T.roseLight:a.severity==="high"?T.amberLight:T.borderLight,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:13,fontWeight:600}}>{a.resident}</div><div style={{fontSize:11,color:T.textMuted}}>{a.msg}</div></div><span style={{fontSize:10,color:T.textLight}}>{a.time}</span></div>)}</div></div></div><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><SH title="Care Homes"/><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>{CARE_HOMES.map(ch=><div key={ch.id} style={{padding:20,borderRadius:14,border:`1px solid ${T.border}`,background:ch.status==="pending"?T.amberLight:T.borderLight,cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><div style={{fontSize:15,fontWeight:700}}>{ch.name}</div><Badge color={ch.status==="active"?T.green:T.amber} bg={ch.status==="active"?T.greenLight:T.amberLight}>{ch.status}</Badge></div><div style={{fontSize:12,color:T.textMuted,marginBottom:12}}>{ch.location}</div><div style={{display:"flex",gap:16,fontSize:12}}><span><strong>{ch.residents}</strong> residents</span><span><strong>{ch.staff}</strong> staff</span><span><strong>{ch.engagement}%</strong> engaged</span></div></div>)}</div></div></div>;

const SA_CareHomes=()=><div><SH title="Care Homes" action={()=>{}} al="Add Care Home"/><Tbl headers={["Name","Location","Manager","Residents","Plan","Engagement","Revenue/mo","Status"]}>{CARE_HOMES.map(ch=><tr key={ch.id} style={{borderTop:`1px solid ${T.borderLight}`}}><Td bold>{ch.name}</Td><Td muted>{ch.location}</Td><Td>{ch.manager}</Td><Td>{ch.residents}</Td><Td><Badge color={ch.plan==="Premium"?T.gold:T.teal}>{ch.plan}</Badge></Td><Td><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,height:6,background:T.borderLight,borderRadius:3,maxWidth:80}}><div style={{width:`${ch.engagement}%`,height:"100%",background:ch.engagement>70?T.green:T.amber,borderRadius:3}}/></div><span style={{fontSize:12,color:T.textMuted}}>{ch.engagement}%</span></div></Td><Td bold>£{ch.monthlyRevenue}</Td><Td><Badge color={ch.status==="active"?T.green:T.amber} bg={ch.status==="active"?T.greenLight:T.amberLight}>{ch.status}</Badge></Td></tr>)}</Tbl></div>;

const SA_Residents=()=><div><SH title="All Residents"/><div style={{display:"flex",gap:12,marginBottom:16}}><div style={{flex:1,display:"flex",alignItems:"center",gap:8,background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 14px"}}><Ico d={ic.search} s={16} c={T.textLight}/><input placeholder="Search residents..." style={{border:"none",outline:"none",flex:1,fontSize:13,background:"transparent"}}/></div><select style={{padding:"8px 14px",borderRadius:10,border:`1px solid ${T.border}`,fontSize:13,background:T.card}}><option>All Care Homes</option>{CARE_HOMES.map(ch=><option key={ch.id}>{ch.name}</option>)}</select></div><Tbl headers={["Resident","Age","Room","Care Home","Mood","Last Active","Status"]}>{RESIDENTS.map(r=><tr key={r.id} style={{borderTop:`1px solid ${T.borderLight}`}}><Td bold style={{display:"flex",alignItems:"center",gap:10}}><Avatar name={r.name}/>{r.name}</Td><Td muted>{r.age}</Td><Td>{r.room}</Td><Td muted>{r.careHome}</Td><Td><MoodBadge mood={r.mood}/></Td><Td muted style={{fontSize:12}}>{r.lastActive}</Td><Td><Badge color={r.status==="active"?T.green:T.rose} bg={r.status==="active"?T.greenLight:T.roseLight}>{r.status}</Badge></Td></tr>)}</Tbl></div>;

const SA_Orders=()=><div><SH title="B2C Orders" action={()=>{}} al="Manual Order"/><div style={{display:"flex",gap:12,marginBottom:20}}>{[{l:"Pending Payment",c:1,co:T.amber},{l:"Awaiting Dispatch",c:1,co:T.blue},{l:"Dispatched",c:1,co:T.green}].map((f,i)=><div key={i} style={{flex:1,padding:"14px 18px",borderRadius:12,border:`1px solid ${T.border}`,background:T.card,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,fontWeight:500}}>{f.l}</span><span style={{fontSize:18,fontWeight:700,color:f.co}}>{f.c}</span></div>)}</div><Tbl headers={["Order","Family","Elderly","Plan","Amount","Date","Status","Actions"]}>{B2C_ORDERS.map(o=><tr key={o.id} style={{borderTop:`1px solid ${T.borderLight}`}}><Td mono bold>{o.id}</Td><Td bold>{o.family}</Td><Td muted>{o.elderly}</Td><Td><Badge>{o.plan}</Badge></Td><Td bold>£{o.amount}</Td><Td muted style={{fontSize:12}}>{o.date}</Td><Td><Badge color={o.status.includes("pending")?T.amber:o.status.includes("awaiting")?T.blue:T.green} bg={o.status.includes("pending")?T.amberLight:o.status.includes("awaiting")?T.blueLight:T.greenLight}>{o.status.replace(/_/g," ")}</Badge></Td><Td>{o.status.includes("pending")&&<Btn small color={T.teal}>Send Stripe Link</Btn>}{o.status.includes("awaiting")&&<Btn small color={T.blue}>Generate Credentials</Btn>}{o.status==="dispatched"&&<Btn small outline>View</Btn>}</Td></tr>)}</Tbl></div>;

const SA_Alerts=()=><div><SH title="Platform Alerts"/><div style={{display:"flex",flexDirection:"column",gap:12}}>{ALERTS.map(a=><AlertCard key={a.id} a={a}/>)}</div></div>;

const SA_Devices=()=><div><SH title="Device Codes" action={()=>{}} al="Generate Code"/><Tbl headers={["Code","Care Home","Device","Resident","Status","Activated","Actions"]}>{DEVICES.map((d,i)=><tr key={i} style={{borderTop:`1px solid ${T.borderLight}`}}><Td mono bold style={{color:T.teal}}>{d.code}</Td><Td>{d.ch}</Td><Td muted>{d.device}</Td><Td>{d.resident}</Td><Td><Badge color={d.status==="ACTIVE"?T.green:d.status==="SUSPENDED"?T.rose:T.amber} bg={d.status==="ACTIVE"?T.greenLight:d.status==="SUSPENDED"?T.roseLight:T.amberLight}>{d.status}</Badge></Td><Td muted style={{fontSize:12}}>{d.activated}</Td><Td>{d.status==="ACTIVE"&&<Btn small outline>Suspend</Btn>}{d.status==="SUSPENDED"&&<Btn small>Reactivate</Btn>}{d.status==="PENDING"&&<Btn small color={T.blue}>Assign</Btn>}</Td></tr>)}</Tbl></div>;

const SA_Billing=()=><div><SH title="Billing & Subscriptions"/><div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}><StatCard label="Monthly Recurring" value="£3,200" trend="+18% MoM" color={T.gold}/><StatCard label="B2B Revenue" value="£2,160" trend="3 care homes" color={T.teal}/><StatCard label="B2C Revenue" value="£1,040" trend="23 subscribers" color={T.amber}/><StatCard label="Outstanding" value="£450" trend="2 unpaid" color={T.rose}/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>B2B Invoices</div>{CARE_HOMES.filter(c=>c.status==="active").map(ch=><div key={ch.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${T.borderLight}`}}><div><div style={{fontSize:13,fontWeight:600}}>{ch.name}</div><div style={{fontSize:11,color:T.textMuted}}>{ch.residents} × £{ch.plan==="Premium"?35:25}/mo</div></div><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontWeight:700}}>£{ch.monthlyRevenue}</span><Badge color={T.green} bg={T.greenLight}>Paid</Badge></div></div>)}</div><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>B2C Summary</div>{[{p:"Family Basic (£19.99)",c:10,r:199.90},{p:"Family Plus (£29.99)",c:8,r:239.92},{p:"Family Premium (£39.99)",c:5,r:199.95}].map((p,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${T.borderLight}`}}><div><div style={{fontSize:13,fontWeight:600}}>{p.p}</div><div style={{fontSize:11,color:T.textMuted}}>{p.c} subscribers</div></div><span style={{fontWeight:700}}>£{p.r.toFixed(2)}</span></div>)}</div></div></div>;

const SA_Analytics=()=><div><SH title="Engagement Analytics"/><div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}><StatCard label="Avg Daily Conversations" value="8.3" trend="per resident" color={T.teal}/><StatCard label="Avg Session Duration" value="4m 22s" color={T.blue}/><StatCard label="Voice vs Text" value="73/27%" color={T.purple}/><StatCard label="Proactive Engagement" value="89%" trend="+5% this week" color={T.green}/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Feature Usage</div>{[{f:"AI Conversation",p:92,c:T.teal},{f:"Voice Interaction",p:73,c:T.blue},{f:"Family Messages",p:61,c:T.purple},{f:"Photo Gallery",p:48,c:T.amber},{f:"Music",p:35,c:T.rose},{f:"Help Button",p:12,c:T.green}].map((f,i)=><div key={i} style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{fontWeight:500}}>{f.f}</span><span style={{color:T.textMuted}}>{f.p}%</span></div><div style={{height:6,background:T.borderLight,borderRadius:3}}><div style={{width:`${f.p}%`,height:"100%",background:f.c,borderRadius:3}}/></div></div>)}</div><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Platform Mood</div><div style={{textAlign:"center",padding:"30px 0"}}><div style={{fontSize:48,fontWeight:700,color:T.teal}}>7.2</div><div style={{fontSize:13,color:T.textMuted,marginTop:4}}>7-day average</div><div style={{fontSize:12,color:T.green,marginTop:8,fontWeight:600}}>↑ 0.3 from last week</div></div><div style={{borderTop:`1px solid ${T.borderLight}`,paddingTop:16}}>{[{r:"Happy (8-10)",p:42,c:T.green},{r:"Content (6-7)",p:35,c:T.teal},{r:"Neutral (5)",p:13,c:T.amber},{r:"Low (< 5)",p:10,c:T.rose}].map((m,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><div style={{width:10,height:10,borderRadius:"50%",background:m.c}}/><span style={{fontSize:12,flex:1}}>{m.r}</span><span style={{fontSize:12,fontWeight:600}}>{m.p}%</span></div>)}</div></div></div></div>;

const SA_Settings=()=><div><SH title="System Settings"/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>{[{t:"Pricing",items:["B2B Standard: £25/resident/mo","B2B Premium: £35/resident/mo","B2C Basic: £19.99/mo","B2C Plus: £29.99/mo","B2C Premium: £39.99/mo"]},{t:"Email Templates",items:["Welcome Email","Payment Link","Family Invitation","Password Reset","Weekly Summary"]},{t:"Platform Config",items:["AI: claude-sonnet-4-20250514","Proactive Cycle: 30 min","Alert Escalation: 5 min","Session Timeout: 1 hr","SES Mode: Sandbox"]},{t:"Security",items:["MFA: Required (Super Admin)","JWT Expiry: 1 hour","Refresh Token: 30 days","Encryption: AES-256","GDPR: Compliant"]}].map((s,i)=><div key={i} style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>{s.t}</div>{s.items.map((item,j)=><div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:j<s.items.length-1?`1px solid ${T.borderLight}`:"none",fontSize:13}}><span>{item}</span><Btn small outline>Edit</Btn></div>)}</div>)}</div></div>;


// ══════ CARE HOME SCREENS ══════
const CH_Dashboard=()=>{const my=RESIDENTS.filter(r=>r.careHomeId===1);const myA=ALERTS.filter(a=>a.chId===1&&!a.resolved);return<div style={{display:"flex",flexDirection:"column",gap:24}}><div><h1 style={{fontSize:24,fontWeight:700,margin:"0 0 4px"}}>Sunny Gardens</h1><p style={{color:T.textMuted,margin:0,fontSize:14}}>42 Morningside Drive, Edinburgh — Manager: Emma MacLeod</p></div><div style={{display:"flex",gap:16,flexWrap:"wrap"}}><StatCard label="Residents" value={my.length} trend="+2 this month" color={T.teal}/><StatCard label="Active Now" value={my.filter(r=>r.lastActive.includes("min")).length} color={T.green}/><StatCard label="Avg Mood" value="7.1" trend="↑ 0.4 this week" color={T.blue}/><StatCard label="Alerts" value={myA.length} trend="unresolved" color={T.rose}/><StatCard label="Staff On Duty" value="3" trend="of 4 total" color={T.purple}/></div><div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20}}><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Residents</div><div style={{display:"flex",flexDirection:"column",gap:10}}>{my.map(r=><div key={r.id} style={{display:"flex",alignItems:"center",gap:14,padding:"10px 14px",borderRadius:10,background:T.borderLight,cursor:"pointer"}}><Avatar name={r.name}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{r.name}</div><div style={{fontSize:11,color:T.textMuted}}>{r.room} · {r.lastActive}</div></div><MoodBadge mood={r.mood}/><Badge color={r.status==="active"?T.green:T.rose} bg={r.status==="active"?T.greenLight:T.roseLight}>{r.status}</Badge></div>)}</div></div><div style={{display:"flex",flexDirection:"column",gap:20}}><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{fontSize:15,fontWeight:700,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>Alerts <Badge color={T.rose} bg={T.roseLight}>{myA.length}</Badge></div>{myA.map(a=><div key={a.id} style={{padding:"10px 12px",borderRadius:8,background:a.severity==="critical"?T.roseLight:T.amberLight,marginBottom:8}}><div style={{fontSize:12,fontWeight:600}}>{a.resident}</div><div style={{fontSize:11,color:T.textMuted}}>{a.msg}</div></div>)}</div><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Quick Actions</div>{["Add New Resident","Fill Questionnaire","Invite Family","View Reports"].map((a,i)=><button key={i} style={{display:"block",width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${T.border}`,background:T.card,cursor:"pointer",marginBottom:8,fontSize:13,fontWeight:500,textAlign:"left",color:T.text}}>{a}</button>)}</div></div></div></div>};

const CH_Residents=()=>{const[sel,setSel]=useState(null);const my=RESIDENTS.filter(r=>r.careHomeId===1);return<div><SH title="Residents" action={()=>{}} al="Add Resident"/><Tbl headers={["Resident","Age","Room","Mood","Last Active","Questionnaire","Family","Status"]}>{my.map(r=><tr key={r.id} style={{borderTop:`1px solid ${T.borderLight}`,cursor:"pointer"}} onClick={()=>setSel(sel===r.id?null:r.id)}><Td bold style={{display:"flex",alignItems:"center",gap:10}}><Avatar name={r.name}/>{r.name}</Td><Td muted>{r.age}</Td><Td>{r.room}</Td><Td><MoodBadge mood={r.mood}/></Td><Td muted style={{fontSize:12}}>{r.lastActive}</Td><Td><Badge color={r.questionnaire==="complete"?T.green:T.amber} bg={r.questionnaire==="complete"?T.greenLight:T.amberLight}>{r.questionnaire}</Badge></Td><Td muted style={{fontSize:12}}>{r.family.length} members</Td><Td><Badge color={r.status==="active"?T.green:T.rose} bg={r.status==="active"?T.greenLight:T.roseLight}>{r.status}</Badge></Td></tr>)}</Tbl>{sel&&(()=>{const r=my.find(x=>x.id===sel);return r?<div style={{marginTop:20,background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><h3 style={{margin:"0 0 16px",fontSize:16,fontWeight:700}}>{r.name} — Profile</h3><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>{[{l:"ROOM",v:r.room},{l:"MEDICATION",v:r.medication},{l:"FAMILY",v:r.family.join(", ")},{l:"CONVERSATIONS TODAY",v:r.conversations},{l:"7-DAY MOOD",v:r.mood},{l:"LAST ACTIVE",v:r.lastActive}].map((f,i)=><div key={i} style={{padding:16,background:T.borderLight,borderRadius:10}}><div style={{color:T.textMuted,fontSize:11,marginBottom:4}}>{f.l}</div><div style={{fontSize:typeof f.v==="number"?20:13,fontWeight:typeof f.v==="number"?700:400,color:typeof f.v==="number"?T.teal:T.text}}>{f.v}</div></div>)}</div><div style={{display:"flex",gap:10,marginTop:16}}><Btn>Edit Questionnaire</Btn><Btn color={T.blue}>View Health Log</Btn><Btn outline>Send Message</Btn></div></div>:null})()}</div>};

const CH_Questionnaire=()=>{const[step,setStep]=useState(1);return<div><SH title="Therapeutic Questionnaire"/><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{display:"flex",gap:4,marginBottom:32}}>{Q_STEPS.map(s=><div key={s.s} onClick={()=>setStep(s.s)} style={{flex:1,cursor:"pointer",textAlign:"center"}}><div style={{height:6,borderRadius:3,background:s.s<=step?T.teal:T.borderLight,marginBottom:8}}/><div style={{fontSize:11,fontWeight:s.s===step?700:400,color:s.s===step?T.teal:T.textMuted}}>Step {s.s}</div><div style={{fontSize:10,color:T.textLight}}>{s.t}</div></div>)}</div><div style={{maxWidth:600,margin:"0 auto"}}><h3 style={{fontSize:18,fontWeight:700,color:T.teal,marginBottom:4}}>Step {step}: {Q_STEPS[step-1].t}</h3><p style={{color:T.textMuted,fontSize:13,marginBottom:24}}>All information helps Warda provide personalised care.</p>{Q_STEPS[step-1].f.map((field,i)=><div key={i} style={{marginBottom:18}}><label style={{display:"block",fontSize:13,fontWeight:600,marginBottom:6}}>{field}</label><input style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1px solid ${T.border}`,fontSize:13,background:T.borderLight,outline:"none",boxSizing:"border-box"}} placeholder={`Enter ${field.toLowerCase()}...`}/></div>)}<div style={{display:"flex",justifyContent:"space-between",marginTop:24}}><Btn outline onClick={()=>setStep(Math.max(1,step-1))}>← Back</Btn><div style={{display:"flex",gap:10}}><Btn outline>Save Draft</Btn><Btn onClick={()=>setStep(Math.min(7,step+1))}>{step===7?"Save & Activate":"Next Step →"}</Btn></div></div></div></div></div>};

const CH_Staff=()=><div><SH title="Staff Members" action={()=>{}} al="Add Staff"/><Tbl headers={["Staff Member","Role","Email","Assigned","Last Login","Status"]}>{STAFF.map(s=><tr key={s.id} style={{borderTop:`1px solid ${T.borderLight}`}}><Td bold style={{display:"flex",alignItems:"center",gap:10}}><Avatar name={s.name} bg={T.purpleLight} color={T.purple}/>{s.name}</Td><Td><Badge color={s.role==="Manager"?T.gold:s.role==="Nurse"?T.blue:T.teal}>{s.role}</Badge></Td><Td muted style={{fontSize:12}}>{s.email}</Td><Td>{s.assigned}</Td><Td muted style={{fontSize:12}}>{s.lastLogin}</Td><Td><Badge color={s.status==="active"?T.green:T.amber} bg={s.status==="active"?T.greenLight:T.amberLight}>{s.status.replace("_"," ")}</Badge></Td></tr>)}</Tbl></div>;

const CH_Families=()=><div><SH title="Family Contacts" action={()=>{}} al="Invite Family"/><Tbl headers={["Family Member","Relationship","Resident","Phone","Primary","Last Contact"]}>{FAMILY_CONTACTS.map(f=><tr key={f.id} style={{borderTop:`1px solid ${T.borderLight}`}}><Td bold style={{display:"flex",alignItems:"center",gap:10}}><Avatar name={f.name} bg={T.roseLight} color={T.rose}/>{f.name}</Td><Td>{f.rel}</Td><Td muted>{f.resident}</Td><Td muted style={{fontSize:12}}>{f.phone}</Td><Td>{f.primary?<Badge color={T.teal} bg={T.tealLight}>Primary</Badge>:<span style={{color:T.textLight,fontSize:12}}>—</span>}</Td><Td muted style={{fontSize:12}}>{f.lastContact}</Td></tr>)}</Tbl></div>;

const CH_Alerts=()=><div><SH title="Care Home Alerts"/><div style={{display:"flex",flexDirection:"column",gap:12}}>{ALERTS.filter(a=>a.chId===1).map(a=><AlertCard key={a.id} a={a} showCH={false}/>)}</div></div>;

const CH_Billing=()=><div><SH title="Billing & Invoices"/><div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}><StatCard label="Monthly Charge" value="£1,120" trend="32 × £35/mo" color={T.teal}/><StatCard label="Payment Status" value="Paid" trend="Next due: 1 Mar" color={T.green}/><StatCard label="Referral Earnings" value="£180" trend="3 referrals" color={T.gold}/></div><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Invoice History</div>{["February 2026 — £1,120 — Paid","January 2026 — £1,050 — Paid","December 2025 — £980 — Paid"].map((inv,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${T.borderLight}`,fontSize:13}}><span>{inv}</span><Btn small outline>Download PDF</Btn></div>)}</div></div>;


// ══════ FAMILY MEMBER SCREENS ══════
const FM_Home=()=>{const r=RESIDENTS[0];return<div style={{display:"flex",flexDirection:"column",gap:24}}><div style={{background:`linear-gradient(135deg,${T.teal},${T.tealDark})`,borderRadius:20,padding:"28px 30px",color:"#fff"}}><div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}><Avatar name={r.name} size={56} bg="rgba(255,255,255,0.2)" color="#fff"/><div><div style={{fontSize:22,fontWeight:700}}>{r.name}</div><div style={{opacity:.7,fontSize:13}}>{r.room} · Sunny Gardens, Edinburgh</div></div></div><div style={{display:"flex",gap:20,fontSize:14}}><div><div style={{opacity:.6,fontSize:11}}>MOOD TODAY</div><div style={{fontWeight:700,fontSize:20}}>😊 {r.mood}/10</div></div><div><div style={{opacity:.6,fontSize:11}}>LAST ACTIVE</div><div style={{fontWeight:700}}>{r.lastActive}</div></div><div><div style={{opacity:.6,fontSize:11}}>CONVERSATIONS</div><div style={{fontWeight:700}}>{r.conversations} today</div></div></div></div><div style={{background:T.card,borderRadius:16,padding:20,border:`1px solid ${T.border}`}}><div style={{fontSize:14,fontWeight:600,marginBottom:4,color:T.teal}}>🌹 Warda says:</div><div style={{fontSize:13,color:T.textMuted,lineHeight:1.6}}>"Margaret had a lovely morning! She chatted about the grandchildren and asked me to play Bobby Darin. She's in great spirits today."</div></div><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>{[{i:"chat",l:"Send Message",c:T.teal},{i:"camera",l:"Send Photo",c:T.blue},{i:"video",l:"Video Call",c:T.purple},{i:"heart",l:"Send Love",c:T.rose}].map((a,j)=><button key={j} style={{padding:"20px 16px",borderRadius:14,border:`1px solid ${T.border}`,background:T.card,cursor:"pointer",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:10}}><div style={{width:44,height:44,borderRadius:12,background:a.c+"15",display:"flex",alignItems:"center",justifyContent:"center"}}><NavIco name={a.i} s={22} c={a.c}/></div><span style={{fontSize:12,fontWeight:600}}>{a.l}</span></button>)}</div><div style={{background:T.card,borderRadius:16,padding:20,border:`1px solid ${T.border}`}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Recent Activity</div>{[{t:"11:30 AM",x:"Margaret sent you a voice message via Warda",e:"🎤"},{t:"10:45 AM",x:'Margaret replied: "Tell Sarah I love her"',e:"💬"},{t:"10:30 AM",x:"You sent a message and 3 photos",e:"📸"},{t:"9:00 AM",x:"Margaret started morning chat with Warda",e:"🌹"}].map((a,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<3?`1px solid ${T.borderLight}`:"none"}}><span style={{fontSize:20}}>{a.e}</span><div style={{flex:1,fontSize:13}}>{a.x}</div><span style={{fontSize:11,color:T.textLight}}>{a.t}</span></div>)}</div></div>};

const FM_Messages=()=><div><SH title="Messages"/><div style={{background:T.card,borderRadius:16,border:`1px solid ${T.border}`,overflow:"hidden"}}><div style={{maxHeight:420,overflow:"auto",padding:20,display:"flex",flexDirection:"column",gap:12}}>{MESSAGES.map(m=><div key={m.id} style={{display:"flex",justifyContent:m.dir==="out"?"flex-end":"flex-start"}}><div style={{maxWidth:"75%",padding:"12px 16px",borderRadius:16,background:m.dir==="out"?T.tealLight:T.borderLight,borderBottomRightRadius:m.dir==="out"?4:16,borderBottomLeftRadius:m.dir==="in"?4:16}}><div style={{fontSize:11,fontWeight:600,color:m.dir==="out"?T.tealDark:T.textMuted,marginBottom:4}}>{m.from} {m.type==="warda"&&<Badge color={T.teal} bg={T.tealLight}>via Warda</Badge>}</div>{m.type==="photo"?<div style={{background:T.border,borderRadius:10,padding:30,textAlign:"center",fontSize:12,color:T.textMuted}}>📸 {m.caption}</div>:m.type==="voice"?<div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:36,height:36,borderRadius:"50%",background:T.teal+"20",display:"flex",alignItems:"center",justifyContent:"center"}}>🎤</div><span style={{fontSize:13}}>{m.content||"Voice message (0:12)"}</span></div>:<div style={{fontSize:13,lineHeight:1.5}}>{m.content}</div>}<div style={{fontSize:10,color:T.textLight,marginTop:6,textAlign:"right"}}>{m.time}</div></div></div>)}</div><div style={{padding:"14px 20px",borderTop:`1px solid ${T.border}`,display:"flex",gap:10}}><input placeholder="Type a message to Mum..." style={{flex:1,padding:"10px 16px",borderRadius:24,border:`1px solid ${T.border}`,fontSize:13,outline:"none"}}/><button style={{width:40,height:40,borderRadius:"50%",background:T.teal,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Ico d={ic.send} s={18} c="#fff"/></button></div></div></div>;

const FM_Photos=()=><div><SH title="Photo Gallery" action={()=>{}} al="Send Photo"/><div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>{[{id:1,cap:"Emily at the swings!",from:"Sarah MacLeod",date:"Today 11:00 AM",viewed:true},{id:2,cap:"Sunday roast with the family",from:"Tom MacLeod",date:"Yesterday 6:30 PM",viewed:true},{id:3,cap:"Grandchildren at school play",from:"Sarah MacLeod",date:"3 Feb 2026",viewed:true},{id:4,cap:"New garden flowers blooming",from:"Sarah MacLeod",date:"1 Feb 2026",viewed:false}].map(p=><div key={p.id} style={{background:T.card,borderRadius:16,border:`1px solid ${T.border}`,overflow:"hidden"}}><div style={{background:`linear-gradient(135deg,${T.tealLight},${T.blueLight})`,height:160,display:"flex",alignItems:"center",justifyContent:"center",fontSize:40}}>📸</div><div style={{padding:16}}><div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{p.cap}</div><div style={{fontSize:12,color:T.textMuted,display:"flex",justifyContent:"space-between"}}><span>From: {p.from}</span><span>{p.date}</span></div><div style={{marginTop:8}}>{p.viewed?<Badge color={T.green} bg={T.greenLight}>Viewed by Mum</Badge>:<Badge color={T.amber} bg={T.amberLight}>Not yet viewed</Badge>}</div></div></div>)}</div></div>;

const FM_Alerts=()=><div><SH title="Alerts & Notifications"/><div style={{display:"flex",flexDirection:"column",gap:12}}>{[{t:"Mood Update",m:"Margaret's mood is 8.2/10 — great day! 😊",time:"Today 2:00 PM",e:"😊"},{t:"Voice Message from Mum",m:"Margaret sent you a voice message via Warda",time:"Today 11:30 AM",e:"💬"},{t:"Medication Taken",m:"Afternoon medication taken on time ✓",time:"Today 2:15 PM",e:"💊"},{t:"Activity Summary",m:"12 conversations today, listened to music, viewed photos",time:"Yesterday 8 PM",e:"📊"}].map((a,i)=><div key={i} style={{background:T.card,borderRadius:14,padding:"18px 22px",border:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:16}}><div style={{width:40,height:40,borderRadius:10,background:T.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{a.e}</div><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,marginBottom:2}}>{a.t}</div><div style={{fontSize:12,color:T.textMuted}}>{a.m}</div></div><span style={{fontSize:11,color:T.textLight,whiteSpace:"nowrap"}}>{a.time}</span></div>)}</div></div>;

const FM_Profile=()=><div><SH title="Profile & Settings"/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Your Details</div>{[{l:"Name",v:"Sarah MacLeod"},{l:"Relationship",v:"Daughter"},{l:"Email",v:"sarah@email.com"},{l:"Phone",v:"07700 123456"},{l:"Notifications",v:"Push + Email"}].map((f,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${T.borderLight}`,fontSize:13}}><span style={{color:T.textMuted}}>{f.l}</span><span style={{fontWeight:600}}>{f.v}</span></div>)}</div><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Mum's Details</div>{[{l:"Name",v:"Margaret MacLeod"},{l:"Care Home",v:"Sunny Gardens, Edinburgh"},{l:"Room",v:"Room 12"},{l:"Age",v:"82"},{l:"Device Code",v:"SUNNY-ABCD-1234-EFGH"}].map((f,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${T.borderLight}`,fontSize:13}}><span style={{color:T.textMuted}}>{f.l}</span><span style={{fontWeight:600}}>{f.v}</span></div>)}</div></div></div>;

const FM_Subscription=()=><div><SH title="Subscription"/><div style={{background:`linear-gradient(135deg,${T.teal},${T.tealDark})`,borderRadius:16,padding:24,color:"#fff",marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:12,opacity:.7,marginBottom:4}}>CURRENT PLAN</div><div style={{fontSize:22,fontWeight:700}}>Family Plus — £29.99/month</div><div style={{fontSize:13,opacity:.7,marginTop:4}}>Next billing: 8th March 2026</div></div><Badge color="#fff" bg="rgba(255,255,255,0.2)">Active</Badge></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:20}}>{[{n:"Family Basic",p:"£19.99",f:["AI Companion","Basic messaging","Daily mood updates"],cur:false},{n:"Family Plus",p:"£29.99",f:["Everything in Basic","Video calls","Photo sharing","Voice messages"],cur:true},{n:"Family Premium",p:"£39.99",f:["Everything in Plus","GP portal access","Health reports","Priority support"],cur:false}].map((pl,i)=><div key={i} style={{background:T.card,borderRadius:16,padding:24,border:`2px solid ${pl.cur?T.teal:T.border}`,position:"relative"}}>{pl.cur&&<div style={{position:"absolute",top:-1,left:"50%",transform:"translateX(-50%)",background:T.teal,color:"#fff",fontSize:10,fontWeight:700,padding:"2px 12px",borderRadius:"0 0 8px 8px"}}>CURRENT</div>}<div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{pl.n}</div><div style={{fontSize:24,fontWeight:700,color:T.teal,marginBottom:16}}>{pl.p}<span style={{fontSize:12,fontWeight:400,color:T.textMuted}}>/month</span></div>{pl.f.map((f,j)=><div key={j} style={{fontSize:12,color:T.textMuted,padding:"4px 0",display:"flex",alignItems:"center",gap:6}}><span style={{color:T.green}}>✓</span>{f}</div>)}<button style={{width:"100%",marginTop:16,padding:10,borderRadius:10,border:pl.cur?"none":`1px solid ${T.border}`,background:pl.cur?T.teal:T.card,color:pl.cur?"#fff":T.text,fontSize:13,fontWeight:600,cursor:"pointer"}}>{pl.cur?"Current Plan":"Upgrade"}</button></div>)}</div><div style={{background:T.card,borderRadius:16,padding:24,border:`1px solid ${T.border}`}}><div style={{fontSize:15,fontWeight:700,marginBottom:16}}>Payment History</div>{["8 Feb 2026 — £29.99 — Paid ✓","8 Jan 2026 — £29.99 — Paid ✓","8 Dec 2025 — £29.99 — Paid ✓"].map((p,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${T.borderLight}`,fontSize:13}}><span>{p}</span><Btn small outline>Receipt</Btn></div>)}</div></div>;


// ═══════════════════════════════════════════════
// 🔐 LOGIN SCREEN
// ═══════════════════════════════════════════════
const LoginScreen = ({ onLogin }: any) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.post("/api/admin/auth/login", { email, password });
      if (data.success && (data.tokens || data.token)) {
        const tk = data.tokens?.accessToken || data.tokens?.idToken || data.token;
        localStorage.setItem("warda_token", tk);
        if (data.tokens?.refreshToken && remember) localStorage.setItem("warda_refresh", data.tokens.refreshToken);
        onLogin(data);
      } else {
        setError(data.error || data.message || "Invalid credentials. Please try again.");
      }
    } catch (err) {
      setError("Connection error. Please check your internet and try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg,${T.teal},${T.tealDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🌹</div>
          <div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>Warda</div>
            <div style={{ fontSize: 13, opacity: 0.5, fontWeight: 500 }}>by Eletiser Ltd</div>
          </div>
        </div>
        <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.15, letterSpacing: -1.5, marginBottom: 20, maxWidth: 500 }}>
          Intelligent companion for elderly care
        </div>
        <div style={{ fontSize: 16, opacity: 0.5, lineHeight: 1.7, maxWidth: 440 }}>
          Connecting residents, families, and care teams through personalised AI conversations, real-time monitoring, and meaningful engagement.
        </div>
        <div style={{ display: "flex", gap: 32, marginTop: 48, opacity: 0.4, fontSize: 13 }}>
          <div><strong style={{ fontSize: 22, display: "block", color: T.teal }}>90+</strong>Residents</div>
          <div><strong style={{ fontSize: 22, display: "block", color: T.teal }}>3</strong>Care Homes</div>
          <div><strong style={{ fontSize: 22, display: "block", color: T.teal }}>24/7</strong>AI Support</div>
        </div>
      </div>
      <div style={{ width: 480, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 24, padding: "48px 40px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: "0 0 6px" }}>Welcome back</h2>
            <p style={{ color: T.textMuted, fontSize: 14, margin: 0 }}>Sign in to the Warda portal</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>Email</label>
              <input type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required placeholder="you@example.com"
                style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: `1px solid ${T.border}`, fontSize: 14, outline: "none", boxSizing: "border-box", background: T.borderLight }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>Password</label>
              <input type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} required placeholder="Enter your password"
                style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: `1px solid ${T.border}`, fontSize: 14, outline: "none", boxSizing: "border-box", background: T.borderLight }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, fontSize: 13 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: T.textMuted }}>
                <input type="checkbox" checked={remember} onChange={(e: any) => setRemember(e.target.checked)} style={{ accentColor: T.teal }} /> Remember me
              </label>
              <a href="#" onClick={(e: any)=>e.preventDefault()} style={{ color: T.teal, textDecoration: "none", fontWeight: 600 }}>Forgot password?</a>
            </div>
            {error && (
              <div style={{ background: T.roseLight, color: T.rose, padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
                ⚠ {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: loading ? T.textMuted : `linear-gradient(135deg,${T.teal},${T.tealDark})`, color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer", letterSpacing: 0.3 }}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <div style={{ marginTop: 24, textAlign: "center", fontSize: 12, color: T.textLight }}>
            <div style={{ marginBottom: 12 }}>Family member? <a href="#" onClick={(e: any)=>e.preventDefault()} style={{ color: T.teal, fontWeight: 600, textDecoration: "none" }}>Sign up here</a></div>
            <div>Protected by Warda · Eletiser Ltd © 2026</div>
          </div>
        </div>
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════
// 🔀 ROLE → PORTAL MAPPING
// ═══════════════════════════════════════════════
const getPortalConfig = (user: any) => {
  const role = (user?.role || "").toUpperCase();
  if (role === "SUPER_ADMIN" || role === "ADMIN") return {
    label: "Super Admin", sub: "ELETISER LTD",
    nav: [{id:"dashboard",label:"Dashboard",icon:"dashboard"},{id:"carehomes",label:"Care Homes",icon:"careHome"},{id:"residents",label:"All Residents",icon:"residents"},{id:"orders",label:"B2C Orders",icon:"clipboard"},{id:"alerts",label:"Alerts",icon:"bell",badge:3},{id:"devices",label:"Device Codes",icon:"tablet"},{id:"billing",label:"Billing",icon:"billing"},{id:"analytics",label:"Analytics",icon:"chart"},{id:"settings",label:"Settings",icon:"settings"}],
    screens:{dashboard:SA_Dashboard,carehomes:SA_CareHomes,residents:SA_Residents,orders:SA_Orders,alerts:SA_Alerts,devices:SA_Devices,billing:SA_Billing,analytics:SA_Analytics,settings:SA_Settings}
  };
  if (role === "MANAGER" || role === "STAFF" || role === "CARER" || role === "NURSE") return {
    label: "Care Home", sub: (user?.careHome?.name || "CARE HOME").toUpperCase(),
    nav: [{id:"dashboard",label:"Dashboard",icon:"dashboard"},{id:"residents",label:"Residents",icon:"residents"},{id:"questionnaire",label:"Questionnaire",icon:"clipboard"},{id:"staff",label:"Staff",icon:"staff"},{id:"families",label:"Families",icon:"family"},{id:"alerts",label:"Alerts",icon:"bell",badge:2},{id:"billing",label:"Billing",icon:"billing"}],
    screens:{dashboard:CH_Dashboard,residents:CH_Residents,questionnaire:CH_Questionnaire,staff:CH_Staff,families:CH_Families,alerts:CH_Alerts,billing:CH_Billing}
  };
  if (role === "FAMILY" || role === "FAMILY_B2C") {
    const isB2C = role === "FAMILY_B2C" || user?.subscriptionType === "B2C" || !user?.careHomeId;
    const nav: any[] = [{id:"home",label:"Home",icon:"home"},{id:"messages",label:"Messages",icon:"chat",badge:2},{id:"photos",label:"Photos",icon:"camera"},{id:"alerts",label:"Alerts",icon:"bell"},{id:"profile",label:"Profile",icon:"user"}];
    if (isB2C) nav.push({id:"subscription",label:"Subscription",icon:"billing"});
    return {
      label: isB2C ? "Family (B2C)" : "Family (B2B)", sub: isB2C ? "DIRECT SUBSCRIBER" : "CARE HOME LINKED",
      nav,
      screens:{home:FM_Home,messages:FM_Messages,photos:FM_Photos,alerts:FM_Alerts,profile:FM_Profile,subscription:FM_Subscription}
    };
  }
  if (role === "GP") return {
    label: "GP Portal", sub: "NHS LINKED",
    nav: [{id:"dashboard",label:"Dashboard",icon:"dashboard"}],
    screens:{dashboard:()=><div><SH title="GP Dashboard"/><p style={{color:T.textMuted}}>GP portal screens coming in Phase 3.</p></div>}
  };
  // Default fallback — treat as Super Admin for demo
  return {
    label: "Portal", sub: "WARDA",
    nav: [{id:"dashboard",label:"Dashboard",icon:"dashboard"},{id:"carehomes",label:"Care Homes",icon:"careHome"},{id:"residents",label:"All Residents",icon:"residents"},{id:"alerts",label:"Alerts",icon:"bell",badge:3},{id:"settings",label:"Settings",icon:"settings"}],
    screens:{dashboard:SA_Dashboard,carehomes:SA_CareHomes,residents:SA_Residents,alerts:SA_Alerts,settings:SA_Settings}
  };
};


// ═══════════════════════════════════════════════
// 🏠 PORTAL SHELL (after login)
// ═══════════════════════════════════════════════
const PortalShell = ({ user, portal, onLogout }: any) => {
  const [activePage, setActivePage] = useState(portal.nav[0].id);
  const [collapsed, setCollapsed] = useState(false);
  const ActiveScreen = portal.screens[activePage] || (() => <div style={{padding:40,textAlign:"center",color:T.textMuted}}>Coming soon</div>);
  const logoutIco = "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1";

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'DM Sans','Segoe UI',sans-serif",background:T.bg,color:T.text,overflow:"hidden"}}>
      <div style={{width:collapsed?68:240,background:T.sidebar,display:"flex",flexDirection:"column",transition:"width 0.25s ease",flexShrink:0}}>
        <div style={{padding:collapsed?"20px 14px":"20px 22px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${T.teal},${T.tealDark})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🌹</div>
          {!collapsed&&<div><div style={{color:"#fff",fontWeight:700,fontSize:15,letterSpacing:-.3}}>Warda</div><div style={{color:"rgba(255,255,255,0.4)",fontSize:10,fontWeight:500}}>{portal.sub}</div></div>}
        </div>
        <nav style={{flex:1,padding:"12px 8px",display:"flex",flexDirection:"column",gap:2}}>
          {portal.nav.map((item: any)=>(
            <button key={item.id} onClick={()=>setActivePage(item.id)} style={{display:"flex",alignItems:"center",gap:12,padding:collapsed?"10px 14px":"10px 16px",borderRadius:10,border:"none",cursor:"pointer",background:activePage===item.id?T.sidebarActive:"transparent",color:activePage===item.id?"#fff":"rgba(255,255,255,0.55)",fontSize:13,fontWeight:activePage===item.id?600:400,textAlign:"left",transition:"all 0.15s",position:"relative",justifyContent:collapsed?"center":"flex-start"}}>
              <NavIco name={item.icon} s={18}/>
              {!collapsed&&<span>{item.label}</span>}
              {item.badge&&!collapsed&&<span style={{marginLeft:"auto",background:T.rose,color:"#fff",fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:10}}>{item.badge}</span>}
              {item.badge&&collapsed&&<span style={{position:"absolute",top:4,right:4,width:8,height:8,borderRadius:"50%",background:T.rose}}/>}
            </button>
          ))}
        </nav>
        <div style={{padding:"8px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <button onClick={onLogout} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,border:"none",cursor:"pointer",background:"transparent",color:"rgba(255,255,255,0.4)",fontSize:12,fontWeight:500,width:"100%",textAlign:"left"}}>
            <Ico d={logoutIco} s={16} c="currentColor"/>
            {!collapsed&&<span>Sign Out</span>}
          </button>
        </div>
        <div style={{padding:collapsed?"16px 14px":"16px 22px",borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:10}}>
          <Avatar name={user?.name||"User"} size={32} bg={T.gold} color="#fff"/>
          {!collapsed&&<div style={{flex:1,minWidth:0}}><div style={{color:"#fff",fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.name||"User"}</div><div style={{color:"rgba(255,255,255,0.35)",fontSize:10}}>{user?.role||"—"}</div></div>}
        </div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <header style={{height:60,background:T.card,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <button onClick={()=>setCollapsed(!collapsed)} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex"}}><svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth={2}><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
            <div style={{display:"flex",alignItems:"center",gap:8,background:T.borderLight,borderRadius:10,padding:"6px 14px",width:280}}><Ico d={ic.search} s={15} c={T.textLight}/><input placeholder="Search..." style={{border:"none",outline:"none",background:"transparent",fontSize:13,color:T.text,width:"100%"}}/></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <Badge color={T.teal} bg={T.tealLight}>{portal.label}</Badge>
            <span style={{fontSize:12,color:T.textMuted}}>{new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</span>
            <button style={{background:"none",border:"none",cursor:"pointer",position:"relative",padding:4}}><Ico d={ic.bell} s={20} c={T.textMuted}/><span style={{position:"absolute",top:2,right:2,width:8,height:8,borderRadius:"50%",background:T.rose}}/></button>
          </div>
        </header>
        <main style={{flex:1,overflow:"auto",padding:28}}><ActiveScreen/></main>
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════
// 🚀 ROOT APP — Auth Controller
// ═══════════════════════════════════════════════
export default function WardaUnifiedPortal() {
  const [authState, setAuthState] = useState("loading");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("warda_token");
    if (token) {
      api.get("/api/admin/auth/me").then((data: any) => {
        if (data.success && data.user) {
          setUser(data.user);
          setAuthState("authenticated");
        } else {
          localStorage.removeItem("warda_token");
          localStorage.removeItem("warda_refresh");
          setAuthState("login");
        }
      }).catch(() => { setAuthState("login"); });
    } else {
      setAuthState("login");
    }
  }, []);

  const handleLogin = (data: any) => {
    const u = data.user || data.admin || data;
    setUser(u);
    setAuthState("authenticated");
  };

  const handleLogout = async () => {
    try { await api.post("/api/admin/auth/logout", {}); } catch {}
    localStorage.removeItem("warda_token");
    localStorage.removeItem("warda_refresh");
    setUser(null);
    setAuthState("login");
  };

  if (authState === "loading") {
    return (
      <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg,fontFamily:"'DM Sans',sans-serif"}}>
        <div style={{textAlign:"center"}}>
          <div style={{width:64,height:64,borderRadius:16,background:`linear-gradient(135deg,${T.teal},${T.tealDark})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 16px",animation:"pulse 1.5s ease-in-out infinite"}}>🌹</div>
          <div style={{fontSize:15,fontWeight:600,color:T.text}}>Loading Warda...</div>
          <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }`}</style>
        </div>
      </div>
    );
  }

  if (authState === "login") {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const portal = getPortalConfig(user);
  return <PortalShell user={user} portal={portal} onLogout={handleLogout} />;
}
