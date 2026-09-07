import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, LayoutDashboard, Monitor, Moon, ShieldCheck, Sparkles, Sun } from "lucide-react";
import { employeeExperienceApi } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { DASHBOARD_TEMPLATES, DASHBOARD_WIDGETS } from "../components/dashboard/dashboardTemplates";
import { ACCENT_THEMES, APPEARANCE_STYLES, applyAppearance, readAppearance } from "../services/appearance";
import OnboardingDashboardPreview from "../components/onboarding/OnboardingDashboardPreview";

const STEPS = ["Welcome", "Template", "Theme", "Widgets", "Action boxes", "Review"];
const THEME_OPTIONS = [
  { id: "light", label: "Light", description: "Bright surfaces and strong daylight readability.", icon: Sun },
  { id: "dark", label: "Dark", description: "Reduced-glare dark surfaces for the portal.", icon: Moon },
  { id: "system", label: "Use device setting", description: "Follow the current operating-system appearance.", icon: Monitor },
];
function selectableCard(selected) {
  return `relative rounded-2xl border p-4 text-left transition ${selected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-[var(--portal-border)] bg-[var(--portal-surface-raised)] hover:border-blue-300"}`;
}
export default function FirstLoginOnboardingPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => { const appearance=readAppearance(); return { selectedTemplate:"employee", theme:appearance.mode, appearanceStyle:appearance.style, appearanceAccent:appearance.accent, visibleWidgets:[], selectedActionIds:[] }; });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    employeeExperienceApi.getCurrent().then(({data}) => {
      if (!active) return;
      setState(data);
      const policy = data.policy || {};
      const preference = data.preference || {};
      setForm({
        selectedTemplate: preference.selectedTemplate || policy.defaultTemplate || "employee",
        theme: preference.theme || policy.defaultTheme || readAppearance().mode,
        appearanceStyle: preference.appearanceStyle || readAppearance().style,
        appearanceAccent: preference.appearanceAccent || readAppearance().accent,
        visibleWidgets: preference.visibleWidgets?.length ? preference.visibleWidgets : (DASHBOARD_TEMPLATES[preference.selectedTemplate || policy.defaultTemplate || "employee"]?.widgets || policy.allowedWidgets || []),
        selectedActionIds: preference.selectedActionIds?.length ? preference.selectedActionIds : (policy.defaultActions || []).slice(0, policy.maxActions || 8),
      });
    }).catch((requestError) => setError(requestError?.response?.data?.error || "Your dashboard setup could not be loaded."))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const policy = state?.policy || {};
  const templates = useMemo(() => (policy.allowedTemplates || []).map((id) => DASHBOARD_TEMPLATES[id]).filter(Boolean), [policy.allowedTemplates]);
  const widgets = useMemo(() => (policy.allowedWidgets || []).map((id) => DASHBOARD_WIDGETS[id]).filter(Boolean), [policy.allowedWidgets]);
  const requiredWidgets = new Set(policy.requiredWidgets || []);
  const requiredActions = new Set(policy.requiredActions || []);
  const maxActions = policy.maxActions || 8;

  useEffect(() => { if (!form) return; applyAppearance({mode:form.theme,style:form.appearanceStyle,accent:form.appearanceAccent}); }, [form?.theme, form?.appearanceStyle, form?.appearanceAccent]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;



  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#07111f] text-white">Loading your dashboard setup...</div>;

  const toggleWidget = (id) => setForm((current) => {
    if (requiredWidgets.has(id)) return current;
    const selected = new Set(current.visibleWidgets);
    selected.has(id) ? selected.delete(id) : selected.add(id);
    return selected.size ? { ...current, visibleWidgets:[...selected] } : current;
  });
  const toggleAction = (id) => setForm((current) => {
    if (requiredActions.has(id)) return current;
    const selected = new Set(current.selectedActionIds);
    if (selected.has(id)) selected.delete(id);
    else if (selected.size < maxActions) selected.add(id);
    return { ...current, selectedActionIds:[...selected] };
  });
const serverPayload = () => ({ selectedTemplate:form.selectedTemplate, theme:form.theme, appearanceStyle:form.appearanceStyle, appearanceAccent:form.appearanceAccent, visibleWidgets:form.visibleWidgets, selectedActionIds:form.selectedActionIds });
  const saveDraft = async () => {
    setSaving(true); setError("");
    try { await employeeExperienceApi.savePreferences(serverPayload()); }
    catch (requestError) { setError(requestError?.response?.data?.error || "Your setup could not be saved."); throw requestError; }
    finally { setSaving(false); }
  };
  const next = async () => { if (step >= 1) { try { await saveDraft(); } catch { return; } } setStep((value) => Math.min(value + 1, STEPS.length - 1)); };
  const finish = async () => {
    setSaving(true); setError("");
    try {
      const {data} = await employeeExperienceApi.complete(serverPayload());
      localStorage.setItem(`atd-helpdesk-dashboard-preferences:${user?.id || "anonymous"}`, JSON.stringify({templateId:form.selectedTemplate,visibleWidgets:form.visibleWidgets,appearance:{mode:form.theme,style:form.appearanceStyle,accent:form.appearanceAccent}}));
      localStorage.setItem(`atd-helpdesk-pinned-employee-actions:${user?.id || "anonymous"}`, JSON.stringify(form.selectedActionIds));
      applyAppearance({mode:form.theme,style:form.appearanceStyle,accent:form.appearanceAccent});
      setState(data);
      navigate("/", { replace:true });
    } catch (requestError) { setError(requestError?.response?.data?.error || "Dashboard setup could not be completed."); }
    finally { setSaving(false); }
  };

  return <div className="min-h-screen bg-[linear-gradient(160deg,#07111f_0%,#0d2447_50%,#07111f_100%)] px-4 py-8 text-slate-100">
    <main className="mx-auto max-w-6xl">
      <header className="rounded-3xl border border-blue-300/20 bg-[#10264a]/90 p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200">ATD Alliance first-login setup</p><h1 className="mt-2 text-3xl font-extrabold">Welcome, {String(user?.name || "there").split(" ")[0]}</h1><p className="mt-2 text-sm text-slate-300">Build an Employee Home that fits your work. Administration controls which choices are available.</p></div><div className="rounded-2xl bg-blue-400/10 p-4"><Sparkles className="h-8 w-8 text-sky-300" /></div></div>
        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">{STEPS.map((label,index)=><button key={label} type="button" disabled={index>step} onClick={()=>index<=step&&setStep(index)} className={`rounded-xl px-2 py-2 text-xs font-bold ${index===step?"bg-blue-500 text-white":index<step?"bg-emerald-400/15 text-emerald-200":"bg-white/5 text-slate-400"}`}>{index<step?<Check className="mx-auto mb-1 h-4 w-4"/>:null}{label}</button>)}</div>
      </header>
      {error ? <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-950/60 p-4 text-rose-100">{error}</div> : null}
      <section className="mt-5 min-h-[28rem] rounded-3xl border border-slate-700 bg-[#0f1d2e] p-6 shadow-2xl">
        {step===0 && <div className="mx-auto max-w-2xl py-12 text-center"><ShieldCheck className="mx-auto h-14 w-14 text-sky-300"/><h2 className="mt-5 text-3xl font-extrabold">Your legal acknowledgement is complete</h2><p className="mt-3 leading-7 text-slate-300">Next, choose a dashboard template, theme, useful widgets and up to {maxActions} full action boxes. Preferences are saved to the Helpdesk and can follow the account to another browser.</p></div>}
        {step===1 && <ChoiceSection title="Choose a dashboard template" description="A template sets the starting widget layout. You can adjust the widgets in the next step."><div className="grid gap-3 md:grid-cols-2">{templates.map((template)=><button key={template.id} type="button" onClick={()=>setForm((current)=>({...current,selectedTemplate:template.id}))} className={selectableCard(form.selectedTemplate===template.id)}><LayoutDashboard className="h-6 w-6 text-blue-500"/><h3 className="mt-3 font-bold text-[var(--portal-text)]">{template.label}</h3><p className="mt-1 text-sm leading-6 text-[var(--portal-text-muted)]">{template.description}</p>{form.selectedTemplate===template.id?<CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-blue-600"/>:null}</button>)}</div><OnboardingDashboardPreview template={DASHBOARD_TEMPLATES[form.selectedTemplate]} visibleWidgets={form.visibleWidgets} appearance={{mode:form.theme,style:form.appearanceStyle,accent:form.appearanceAccent}} actions={form.selectedActionIds}/></ChoiceSection>}
        {step===2 && <ChoiceSection title="Theme & Layout Studio" description="Choose the complete appearance used across the portal and preview the selected layout immediately."><div className="space-y-5"><div><h3 className="mb-2 text-sm font-bold">Colour mode</h3><div className="grid gap-3 md:grid-cols-3">{THEME_OPTIONS.filter((item)=>(policy.allowedThemes||[]).includes(item.id)).map((item)=>{const Icon=item.icon;return <button key={item.id} type="button" onClick={()=>setForm((current)=>({...current,theme:item.id}))} className={selectableCard(form.theme===item.id)}><Icon className="h-7 w-7 text-[var(--portal-primary)]"/><p className="mt-3 font-bold">{item.label}</p><p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>{form.theme===item.id?<CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-[var(--portal-primary)]"/>:null}</button>})}</div></div><div><h3 className="mb-2 text-sm font-bold">Appearance style</h3><div className="flex flex-wrap gap-2">{APPEARANCE_STYLES.map((style)=><button key={style} type="button" onClick={()=>setForm((current)=>({...current,appearanceStyle:style}))} className={`portal-control rounded-xl border px-4 py-2 text-sm font-bold capitalize ${form.appearanceStyle===style?"portal-selected":""}`}>{style.replace("-"," ")}</button>)}</div></div><div><h3 className="mb-2 text-sm font-bold">Accent palette</h3><div className="flex flex-wrap gap-3">{ACCENT_THEMES.map((accent)=><button key={accent.id} type="button" onClick={()=>setForm((current)=>({...current,appearanceAccent:accent.id}))} aria-label={accent.label} title={accent.label} className={`h-11 w-11 rounded-full border-2 shadow ${form.appearanceAccent===accent.id?"ring-4 ring-[var(--portal-focus)]":""}`} style={{background:form.appearanceStyle==="solid"?accent.primary:`linear-gradient(135deg, ${accent.primary}, ${accent.secondary})`}} />)}</div></div><OnboardingDashboardPreview template={DASHBOARD_TEMPLATES[form.selectedTemplate]} visibleWidgets={form.visibleWidgets} appearance={{mode:form.theme,style:form.appearanceStyle,accent:form.appearanceAccent}} actions={form.selectedActionIds}/></div></ChoiceSection>}
        {step===3 && <ChoiceSection title="Choose visible widgets" description="Required widgets remain selected by Administration."><div className="grid gap-3 md:grid-cols-2">{widgets.map((widget)=>{const selected=form.visibleWidgets.includes(widget.id);return <label key={widget.id} className={`${selectableCard(selected)} flex cursor-pointer gap-3`}><input type="checkbox" checked={selected} disabled={requiredWidgets.has(widget.id)} onChange={()=>toggleWidget(widget.id)} className="mt-1 h-4 w-4"/><span><span className="font-bold text-[var(--portal-text)]">{widget.label}</span>{requiredWidgets.has(widget.id)?<span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">Required</span>:null}<span className="mt-1 block text-sm text-[var(--portal-text-muted)]">{widget.description}</span></span></label>})}</div></ChoiceSection>}
        {step===4 && <ChoiceSection title="Choose full dashboard action boxes" description={`Select up to ${maxActions}. Selected: ${form.selectedActionIds.length}.`}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(state?.actions||[]).map((action)=>{const selected=form.selectedActionIds.includes(action.id);return <button key={action.id} type="button" onClick={()=>toggleAction(action.id)} className={selectableCard(selected)}><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 font-extrabold text-blue-700">{action.label.charAt(0)}</div><h3 className="mt-3 font-bold text-[var(--portal-text)]">{action.label}</h3><p className="mt-1 text-sm leading-5 text-[var(--portal-text-muted)]">{action.description}</p>{selected?<CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-blue-600"/>:null}</button>})}</div></ChoiceSection>}
        {step===5 && <ChoiceSection title="Review and finish" description="The preview below uses the same template, widgets, action boxes and appearance submitted by Finish setup."><div className="grid gap-4 md:grid-cols-2"><Review label="Template" value={DASHBOARD_TEMPLATES[form.selectedTemplate]?.label||form.selectedTemplate}/><Review label="Theme" value={`${THEME_OPTIONS.find((item)=>item.id===form.theme)?.label||form.theme} · ${form.appearanceStyle} · ${ACCENT_THEMES.find((item)=>item.id===form.appearanceAccent)?.label||form.appearanceAccent}`}/><Review label="Visible widgets" value={`${form.visibleWidgets.length} selected`}/><Review label="Action boxes" value={`${form.selectedActionIds.length} selected`}/></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{form.selectedActionIds.map((id)=><div key={id} className="rounded-xl border border-slate-700 bg-white/5 px-4 py-3 text-sm font-semibold">{state?.actions?.find((item)=>item.id===id)?.label||id}</div>)}</div><div className="mt-6"><p className="mb-3 text-sm font-black uppercase tracking-wider text-[var(--portal-primary)]">Final dashboard preview</p><OnboardingDashboardPreview template={DASHBOARD_TEMPLATES[form.selectedTemplate]} visibleWidgets={form.visibleWidgets} appearance={{mode:form.theme,style:form.appearanceStyle,accent:form.appearanceAccent}} actions={form.selectedActionIds}/></div></ChoiceSection>}
      </section>
      <footer className="mt-5 flex items-center justify-between gap-3"><button type="button" disabled={step===0||saving} onClick={()=>setStep((value)=>Math.max(0,value-1))} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 font-bold disabled:opacity-30"><ArrowLeft className="h-4 w-4"/>Back</button>{step<STEPS.length-1?<button type="button" disabled={saving} onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white disabled:opacity-50">{saving?"Saving...":"Continue"}<ArrowRight className="h-4 w-4"/></button>:<button type="button" disabled={saving||!form.selectedActionIds.length} onClick={finish} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white disabled:opacity-50"><Check className="h-4 w-4"/>{saving?"Completing...":"Finish setup"}</button>}</footer>
    </main>
  </div>;
}
function ChoiceSection({title,description,children}) { return <div><h2 className="text-2xl font-extrabold">{title}</h2><p className="mt-2 mb-5 text-sm text-slate-400">{description}</p>{children}</div>; }
function Review({label,value}) { return <div className="rounded-2xl border border-slate-700 bg-white/5 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>; }
