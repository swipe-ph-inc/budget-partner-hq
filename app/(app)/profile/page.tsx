"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Bot, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { isProSubscriber } from "@/lib/subscription-access";
import { ANTHROPIC_MODEL_PRESETS, OPENROUTER_MODEL_PRESETS } from "@/lib/ai/llm-presets";
import type { Database } from "@/types/database";
import { useRouter } from "next/navigation";
import { SUPPORTED_CURRENCY_CODES } from "@/lib/currencies";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
const TIMEZONES = ["Asia/Manila", "America/New_York", "Europe/London", "Asia/Singapore", "Australia/Sydney", "Asia/Tokyo"];

function ProfileSection({
  profile,
  email,
  onSave,
}: {
  profile: Profile;
  /** From auth — shown read-only; changing email is not supported in-app. */
  email: string | null;
  onSave: (updated: Partial<Profile>) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [baseCurrency, setBaseCurrency] = useState(profile.base_currency);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [theme, setTheme] = useState(profile.theme);
  const [dateFormat, setDateFormat] = useState(profile.date_format);
  const [firstDayOfWeek, setFirstDayOfWeek] = useState(profile.first_day_of_week);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSave({ display_name: displayName, base_currency: baseCurrency, timezone, theme, date_format: dateFormat, first_day_of_week: firstDayOfWeek });
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input
          id="profile-email"
          type="email"
          autoComplete="email"
          value={email ?? ""}
          readOnly
          aria-readonly="true"
          className="cursor-default border-input/80 bg-muted/40 text-foreground selection:bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          This is your sign-in address. It can&apos;t be edited here.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="display-name">Display name</Label>
        <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Base currency</Label>
          <Select value={baseCurrency} onValueChange={setBaseCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCY_CODES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">All amounts will be displayed in this currency when converting.</p>
        </div>

        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Date format</Label>
          <Select value={dateFormat} onValueChange={setDateFormat}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (EU)</SelectItem>
              <SelectItem value="MMM D, YYYY">MMM D, YYYY</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>First day of week</Label>
          <Select value={String(firstDayOfWeek)} onValueChange={(v) => setFirstDayOfWeek(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Sunday</SelectItem>
              <SelectItem value="1">Monday</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Theme</Label>
        <div className="flex gap-3">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium capitalize transition-all ${theme === t ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-secondary"}`}
            >
              {t === "light" ? "☀️" : t === "dark" ? "🌙" : "💻"} {t}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : saved ? <><CheckCircle2 className="h-4 w-4" /> Saved!</> : "Save profile"}
      </Button>
    </form>
  );
}

function PromptSettingsSection({
  settings,
  onSave,
}: {
  settings: Profile;
  onSave: (updated: Partial<Profile>) => Promise<void>;
}) {
  const [prefix, setPrefix] = useState(settings.system_prompt_prefix ?? "");
  const [personality, setPersonality] = useState(settings.ai_personality);
  const [language, setLanguage] = useState(settings.response_language);
  const [currencyDisplay, setCurrencyDisplay] = useState(settings.preferred_currency_display);
  const [proactiveAlerts, setProactiveAlerts] = useState(settings.enable_proactive_alerts);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [llmProvider, setLlmProvider] = useState<"env" | "openrouter" | "anthropic">("env");
  const [llmModelMode, setLlmModelMode] = useState<"env" | "preset" | "custom">("env");
  const [llmPreset, setLlmPreset] = useState(OPENROUTER_MODEL_PRESETS[0].id);
  const [llmCustom, setLlmCustom] = useState("");

  React.useEffect(() => {
    const prov = settings.ai_provider;
    setLlmProvider(prov === "openrouter" || prov === "anthropic" ? prov : "env");
    const m = settings.ai_model?.trim();
    if (!m) {
      setLlmModelMode("env");
      return;
    }
    const allPresets = [...OPENROUTER_MODEL_PRESETS, ...ANTHROPIC_MODEL_PRESETS];
    if (allPresets.some((p) => p.id === m)) {
      setLlmModelMode("preset");
      setLlmPreset(m);
    } else {
      setLlmModelMode("custom");
      setLlmCustom(m);
    }
  }, [settings.ai_provider, settings.ai_model, settings.updated_at]);

  const activePresets =
    llmProvider === "anthropic" ? ANTHROPIC_MODEL_PRESETS : OPENROUTER_MODEL_PRESETS;

  React.useEffect(() => {
    if (llmModelMode !== "preset") return;
    const presets = llmProvider === "anthropic" ? ANTHROPIC_MODEL_PRESETS : OPENROUTER_MODEL_PRESETS;
    setLlmPreset((prev) => (presets.some((p) => p.id === prev) ? prev : presets[0].id));
  }, [llmProvider, llmModelMode]);

  const tokenCount = prefix.length;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const ai_provider =
      llmProvider === "env" ? null : (llmProvider as "openrouter" | "anthropic");
    let ai_model: string | null = null;
    if (llmModelMode === "preset") {
      ai_model = llmPreset;
    } else if (llmModelMode === "custom") {
      const t = llmCustom.trim();
      ai_model = t || null;
    }
    await onSave({
      system_prompt_prefix: prefix || null,
      ai_personality: personality,
      response_language: language,
      preferred_currency_display: currencyDisplay,
      enable_proactive_alerts: proactiveAlerts,
      ai_provider,
      ai_model,
    });
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground">Default LLM</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Choose how Budget Partner AI runs for your account. Leave both on workspace defaults to
            follow server configuration (env). OpenRouter hosts many models; Anthropic uses your
            workspace&apos;s direct Claude API key.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={llmProvider}
              onValueChange={(v) => setLlmProvider(v as "env" | "openrouter" | "anthropic")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="env">Workspace default</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="anthropic">Anthropic (direct)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Select
              value={llmModelMode}
              onValueChange={(v) => setLlmModelMode(v as "env" | "preset" | "custom")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="env">Workspace default</SelectItem>
                <SelectItem value="preset">Preset</SelectItem>
                <SelectItem value="custom">Custom model ID</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {llmModelMode === "preset" && (
          <div className="space-y-2">
            <Label>Preset</Label>
            <Select value={llmPreset} onValueChange={setLlmPreset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activePresets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {llmProvider === "anthropic"
                ? "Direct Claude model ids (no slash)."
                : "OpenRouter model ids (provider/model)."}
            </p>
          </div>
        )}
        {llmModelMode === "custom" && (
          <div className="space-y-2">
            <Label htmlFor="llm-custom">Model ID</Label>
            <Input
              id="llm-custom"
              value={llmCustom}
              onChange={(e) => setLlmCustom(e.target.value)}
              placeholder={
                llmProvider === "anthropic"
                  ? "e.g. claude-haiku-4-5"
                  : "e.g. openai/gpt-4o-mini"
              }
              className="font-mono text-sm"
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>AI personality</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { value: "professional", label: "Professional", desc: "Precise & analytical" },
            { value: "friendly", label: "Friendly", desc: "Warm & encouraging" },
            { value: "concise", label: "Concise", desc: "Brief & direct" },
          ].map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPersonality(p.value)}
              className={`p-3 rounded-lg border text-left transition-all ${personality === p.value ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"}`}
            >
              <p className="text-sm font-medium">{p.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="prefix">Personal instructions</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your User Prompt — injected at the start of every conversation, below the app&apos;s system configuration.
            </p>
          </div>
          <span className={`text-xs shrink-0 ml-4 ${tokenCount > 500 ? "text-destructive" : "text-muted-foreground"}`}>{tokenCount} chars</span>
        </div>
        <Textarea
          id="prefix"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="E.g. 'Always respond in Tagalog' · 'My risk tolerance is conservative' · 'Focus on my BDO accounts'"
          rows={4}
        />
        {prefix && (
          <div className="rounded-md bg-muted/40 border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground mb-1 font-medium">Preview — how the AI will see your instructions:</p>
            <p className="text-xs text-foreground italic">
              &ldquo;Before we start, here are my personal preferences: {prefix}&rdquo;
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Response language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="tl">Filipino (Tagalog)</SelectItem>
              <SelectItem value="ceb">Cebuano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Currency display</Label>
          <Select value={currencyDisplay} onValueChange={setCurrencyDisplay}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="symbol">Symbol (₱, $)</SelectItem>
              <SelectItem value="code">Code (PHP, USD)</SelectItem>
              <SelectItem value="both">Both (₱ PHP)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Proactive alerts</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI proactively flags overdue payments, high utilisation, and budget drift.
          </p>
        </div>
        <Switch checked={proactiveAlerts} onCheckedChange={setProactiveAlerts} />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : saved ? <><CheckCircle2 className="h-4 w-4" /> Saved!</> : "Save AI settings"}
      </Button>
    </form>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setAccountEmail(user.email ?? null);
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(p);
      setLoading(false);
    }
    load();
  }, []);

  async function saveProfile(updated: Partial<Profile>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update(updated).eq("id", user.id);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) return null;

  const pro = isProSubscriber(profile);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {pro ? (
                  <>
                    <Sparkles className="h-4 w-4 text-primary" />
                    {profile.plan_interval === "annual"
                      ? "Pro Annual"
                      : profile.plan_interval === "monthly"
                        ? "Pro (monthly)"
                        : "Pro plan"}
                  </>
                ) : (
                  "Free plan"
                )}
              </CardTitle>
              <CardDescription>
                {pro
                  ? "You have access to all premium areas, full history, and Budget Partner AI."
                  : "Upgrade to Pro for calendar, savings goals, debts, invoices, full transaction history, and AI chat."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link href="/pricing">{pro ? "Change plan" : "View plans & pricing"}</Link>
              </Button>
              {!pro && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard">Explore the app</Link>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-1.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Bot className="h-4 w-4 mr-1.5" />
            AI Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile & Preferences</CardTitle>
              <CardDescription>Manage your display name, base currency, and regional settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileSection profile={profile} email={accountEmail} onSave={saveProfile} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>AI Assistant Settings</CardTitle>
              <CardDescription>Customise how your Budget Partner AI behaves and communicates.</CardDescription>
            </CardHeader>
            <CardContent>
              {profile && (
                <PromptSettingsSection
                  settings={profile}
                  onSave={saveProfile}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
