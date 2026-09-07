import { useCallback, useEffect, useMemo, useState } from "react";
const PREFIX="atd-helpdesk-pinned-employee-actions";
const DEFAULTS=["incident","service","laptop_issue","syspro_catalog"];
const key=(id)=>`${PREFIX}:${id||"anonymous"}`;
function read(id){try{const value=JSON.parse(localStorage.getItem(key(id)));return Array.isArray(value)?value:DEFAULTS;}catch{return DEFAULTS;}}
export default function useEmployeePinnedActions(userId){
 const [pinned,setPinned]=useState(()=>read(userId));
 useEffect(()=>setPinned(read(userId)),[userId]);
 useEffect(()=>{try{localStorage.setItem(key(userId),JSON.stringify(pinned));}catch{}},[pinned,userId]);
 const set=useMemo(()=>new Set(pinned),[pinned]);
 const toggle=useCallback((id)=>setPinned(cur=>cur.includes(id)?cur.filter(x=>x!==id):[...cur,id]),[]);
 const reset=useCallback(()=>setPinned(DEFAULTS),[]);
 return {pinnedActionIds:pinned,isPinned:(id)=>set.has(id),togglePinnedAction:toggle,resetPinnedActions:reset};
}
