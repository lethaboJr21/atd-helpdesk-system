import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import "./Overlay.css";

export default function Modal({ open, title, description, children, footer, onClose, closeOnEscape=true, size="medium", dirty=false }) {
  const titleId=useId();
  const descriptionId=useId();
  const panelRef=useRef(null);
  const previousFocus=useRef(null);
  const requestClose=()=>{if(dirty&&!window.confirm("Discard unsaved changes?"))return;onClose?.();};
  useEffect(()=>{
    if(!open)return undefined;
    previousFocus.current=document.activeElement;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const panel=panelRef.current;
    const focusables=()=>[...panel.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((item)=>!item.disabled);
    (focusables()[0]||panel).focus();
    const onKey=(event)=>{
      if(event.key==="Escape"&&closeOnEscape){event.preventDefault();requestClose();}
      if(event.key!=="Tab")return;
      const list=focusables();if(!list.length){event.preventDefault();return;}
      const first=list[0],last=list[list.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",onKey);
    return()=>{document.removeEventListener("keydown",onKey);document.body.style.overflow=oldOverflow;previousFocus.current?.focus?.();};
  },[open,closeOnEscape,dirty]);
  if(!open)return null;
  return createPortal(
    <div className="overlay-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)requestClose();}}>
      <section ref={panelRef} className={`overlay-panel overlay-panel--${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description?descriptionId:undefined} tabIndex="-1">
        <header className="overlay-panel__header"><div><h2 id={titleId}>{title}</h2>{description&&<p id={descriptionId}>{description}</p>}</div><button type="button" onClick={requestClose} aria-label="Close dialog"><X className="h-5 w-5" /></button></header>
        <div className="overlay-panel__body">{children}</div>
        {footer&&<footer className="overlay-panel__footer">{footer}</footer>}
      </section>
    </div>,document.body
  );
}