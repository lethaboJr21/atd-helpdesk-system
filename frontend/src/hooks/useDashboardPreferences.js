import { useCallback, useEffect, useMemo, useState } from "react";
import { applyAppearance, readAppearance } from "../services/appearance";
import { DEFAULT_EMPLOYEE_TEMPLATE_ID,dashboardTemplateById,employeeWidgetIds } from "../components/dashboard/dashboardTemplates";
const STORAGE_PREFIX="atd-helpdesk-dashboard-preferences";
const key=(userId)=>`${STORAGE_PREFIX}:${userId||"anonymous"}`;
const read=(userId)=>{try{return JSON.parse(localStorage.getItem(key(userId))||"null");}catch{return null;}};
const widgets=(value,fallback)=>{const known=new Set(employeeWidgetIds());const result=Array.isArray(value)?value.filter(id=>known.has(id)):[];return result.length?result:[...fallback];};
const cleanName=(value)=>String(value||"").trim().replace(/\s+/g," ").slice(0,60);
export default function useDashboardPreferences(userId){
 const defaults=dashboardTemplateById(DEFAULT_EMPLOYEE_TEMPLATE_ID);
 const initial=()=>{const saved=read(userId)||{};const template=dashboardTemplateById(saved.templateId||DEFAULT_EMPLOYEE_TEMPLATE_ID);return {templateId:template.id,visibleWidgets:widgets(saved.visibleWidgets,template.widgets.length?template.widgets:defaults.widgets),customLayouts:Array.isArray(saved.customLayouts)?saved.customLayouts:[],activeCustomLayoutId:saved.activeCustomLayoutId||null};};
 const [preferences,setPreferences]=useState(initial);
 useEffect(()=>setPreferences(initial()),[userId]);
 useEffect(()=>{try{localStorage.setItem(key(userId),JSON.stringify(preferences));}catch{}},[preferences,userId]);
 const visibleSet=useMemo(()=>new Set(preferences.visibleWidgets),[preferences.visibleWidgets]);
 const applyTemplate=useCallback((id)=>{const template=dashboardTemplateById(id);if(!template.widgets.length)return;setPreferences(p=>({...p,templateId:template.id,visibleWidgets:[...template.widgets],activeCustomLayoutId:null}));},[]);
 const applyCustomLayout=useCallback((id)=>setPreferences(p=>{const layout=p.customLayouts.find(x=>x.id===id);if(!layout)return p;if(layout.appearance)applyAppearance(layout.appearance);return {...p,templateId:layout.baseTemplateId||DEFAULT_EMPLOYEE_TEMPLATE_ID,visibleWidgets:[...layout.visibleWidgets],activeCustomLayoutId:id};}),[]);
 const toggleWidget=useCallback((id)=>setPreferences(p=>{const set=new Set(p.visibleWidgets);if(set.has(id)){if(set.size===1)return p;set.delete(id);}else set.add(id);return {...p,visibleWidgets:employeeWidgetIds().filter(x=>set.has(x)),activeCustomLayoutId:null};}),[]);
 const saveCustomLayout=useCallback((name)=>{const value=cleanName(name);if(!value)throw new Error("Enter a layout name.");setPreferences(p=>{if(p.customLayouts.some(x=>x.name.toLowerCase()===value.toLowerCase()))throw new Error("A custom layout with this name already exists.");const id=`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;return {...p,customLayouts:[...p.customLayouts,{id,name:value,baseTemplateId:p.templateId,visibleWidgets:[...p.visibleWidgets],appearance:readAppearance(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}],activeCustomLayoutId:id};});},[]);
 const updateCustomLayout=useCallback((id)=>setPreferences(p=>({...p,customLayouts:p.customLayouts.map(x=>x.id===id?{...x,baseTemplateId:p.templateId,visibleWidgets:[...p.visibleWidgets],appearance:readAppearance(),updatedAt:new Date().toISOString()}:x),activeCustomLayoutId:id})),[]);
 const renameCustomLayout=useCallback((id,name)=>{const value=cleanName(name);if(!value)throw new Error("Enter a layout name.");setPreferences(p=>{if(p.customLayouts.some(x=>x.id!==id&&x.name.toLowerCase()===value.toLowerCase()))throw new Error("A custom layout with this name already exists.");return {...p,customLayouts:p.customLayouts.map(x=>x.id===id?{...x,name:value,updatedAt:new Date().toISOString()}:x)};});},[]);
 const duplicateCustomLayout=useCallback((id)=>setPreferences(p=>{const source=p.customLayouts.find(x=>x.id===id);if(!source)return p;let name=`${source.name} copy`,n=2;while(p.customLayouts.some(x=>x.name.toLowerCase()===name.toLowerCase()))name=`${source.name} copy ${n++}`;const copy={...source,id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};return {...p,customLayouts:[...p.customLayouts,copy]};}),[]);
 const deleteCustomLayout=useCallback((id)=>setPreferences(p=>{const active=p.activeCustomLayoutId===id;return {...p,customLayouts:p.customLayouts.filter(x=>x.id!==id),activeCustomLayoutId:active?null:p.activeCustomLayoutId,...(active?{templateId:defaults.id,visibleWidgets:[...defaults.widgets]}:{})};}),[defaults.id,defaults.widgets]);
 const resetPreferences=useCallback(()=>setPreferences(p=>({...p,templateId:defaults.id,visibleWidgets:[...defaults.widgets],activeCustomLayoutId:null})),[defaults.id,defaults.widgets]);
 return {templateId:preferences.templateId,visibleWidgets:preferences.visibleWidgets,customLayouts:preferences.customLayouts,activeCustomLayoutId:preferences.activeCustomLayoutId,isWidgetVisible:id=>visibleSet.has(id),applyTemplate,applyCustomLayout,toggleWidget,saveCustomLayout,updateCustomLayout,renameCustomLayout,duplicateCustomLayout,deleteCustomLayout,resetPreferences};
}
