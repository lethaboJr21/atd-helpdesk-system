import { useCallback, useEffect, useState } from "react";
import { APPEARANCE_EVENT, applyAppearance, initializeAppearance, readAppearance, updateAppearance } from "../services/appearance";

export default function useAppearance() {
  const [appearance, setAppearance] = useState(readAppearance);
  useEffect(() => {
    const dispose = initializeAppearance();
    const sync = (event) => setAppearance(event.detail || readAppearance());
    window.addEventListener(APPEARANCE_EVENT, sync);
    return () => { window.removeEventListener(APPEARANCE_EVENT, sync); dispose?.(); };
  }, []);
  const setMode = useCallback((mode) => setAppearance(updateAppearance({ mode })), []);
  const setStyle = useCallback((style) => setAppearance(updateAppearance({ style })), []);
  const setAccent = useCallback((accent) => setAppearance(updateAppearance({ accent })), []);
  const reset = useCallback(() => setAppearance(applyAppearance({ mode: "system", style: "solid", accent: "atd-blue" })), []);
  const toggleMode = useCallback(() => setAppearance((current) => updateAppearance({ mode: current.mode === "dark" ? "light" : "dark" })), []);
  return { appearance, setMode, setStyle, setAccent, toggleMode, reset };
}
