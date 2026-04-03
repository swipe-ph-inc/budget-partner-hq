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
import type { Database } from "@/types/database";
import { useRouter } from "next/navigation";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type PromptSettings = Database["public"]["Tables"]["prompt_settings"]["Row"];

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "SGD", "AUD", "JPY", "HKD"];
const TIMEZONES = ["Asia/Manila", "America/New_York", "Europe/London", "Asia/Singapore", "Australia/Sydney", "Asia/Tokyo"];

function ProfileSection({ profile, onSave }: { profile: Profile; onSave: (updated: Partial<Profile>) => Promise<void> }) {
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
              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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

function PromptSettingsSection({ settings, onSave }: { settings: PromptSettings; onSave: (updated: Partial<PromptSettings>) => Promise<void> }) {
  const [prefix, setPrefix] = useState(settings.system_prompt_prefix ?? "");
  const [personality, setPersonality] = useState(settings.ai_personality);
  const [language, setLanguage] = useState(settings.response_language);
  const [currencyDisplay, setCurrencyDisplay] = useState(settings.preferred_currency_display);
  const [proactiveAlerts, setProactiveAlerts] = useState(settings.enable_proactive_alerts);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const tokenCount = prefix.length;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await onSave({ system_prompt_prefix: prefix || null, ai_personality: personality, response_language: language, preferred_currency_display: currencyDisplay, enable_proactive_alerts: proactiveAlerts });
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
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
          <Label htmlFor="prefix">Custom system prompt prefix</Label>
          <span className={`text-xs ${tokenCount > 500 ? "text-warning-700" : "text-muted-foreground"}`}>{tokenCount} chars</span>
        </div>
        <Textarea
          id="prefix"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="Add custom instructions that will be prepended to every AI interaction. E.g., 'Always respond in Tagalog' or 'My risk tolerance is conservative'"
          rows={4}
        />
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

      <div className="bg-secondary rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Preview</p>
        <p className="italic">&quot;You are the Budget Partner HQ AI assistant. {prefix && `${prefix} `}Be {personality} in your responses.&quot;</p>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : saved ? <><CheckCircle2 className="h-4 w-4" /> Saved!</> : "Save AI settings"}
      </Button>
    </form>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [promptSettings, setPromptSettings] = useState<PromptSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: p }, { data: ps }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("prompt_settings").select("*").eq("user_id", user.id).single(),
      ]);

      setProfile(p);
      setPromptSettings(ps);
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

  async function savePromptSettings(updated: Partial<PromptSettings>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("prompt_settings").upsert({ ...updated, user_id: user.id }, { onConflict: "user_id" });
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
              <ProfileSection profile={profile} onSave={saveProfile} />
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
              {promptSettings && (
                <PromptSettingsSection settings={promptSettings} onSave={savePromptSettings} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
