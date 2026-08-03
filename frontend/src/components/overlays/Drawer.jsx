import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import "./Overlay.css";
export default function Drawer({open,title,children,onClose}){
 const id=useId(),ref=useRef(null),prior=useRef(null);
 useEffect(()=>{if(!open)return undefined;prior.current=document.activeElement;const old=document.body.style.overflow;document.body.style.overflow="hidden";ref.current?.focus();const key=(event)=>{if(event.key==="Escape")onClose?.();};document.addEventListener("keydown",key);return()=>{document.removeEventListener("keydown",key);document.body.style.overflow=old;prior.current?.focus?.();};},[open,onClose]);
 if(!open)return null;
 return createPortal(<div className="overlay-backdrop"><aside ref={ref} className="overlay-drawer" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex="-1"><header className="overlay-panel__header"><h2 id={id}>{title}</h2><button type="button" onClick={onClose} aria-label="Close drawer"><X className="h-5 w-5"/></button></header><div className="overlay-panel__body">{children}</div></aside></div>,document.body);
}