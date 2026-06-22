"use client";

import { Children, Suspense, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@omnichat/ui";
import Link from "next/link";
import { MessageSquareQuote, Sparkles, Users, MessageSquareCode, User as UserIcon, BookOpen, GitBranch, Workflow } from "lucide-react";
import { LineChannelForm } from "./line-channel-form";
import { QuickReplyManager } from "./quick-reply-manager";
import { KnowledgeSettingsPanel } from "./knowledge-settings-panel";
import { ScenarioManager } from "./scenario-manager";
import { AutomationManager } from "./automation-manager";
import { ProfileEditor } from "./profile-editor";
import { AiSettings } from "./ai-settings";
import { AiCurationManager } from "./ai-curation-manager";
import { useLanguage } from "../../lib/language-context";
import { getMessages } from "../../lib/i18n";

type SettingsTab = "channels" | "replies" | "knowledge" | "scenarios" | "automation" | "team" | "profile" | "ai" | "ai-curation";

function tabButtonClass(active: boolean): string {
  return `flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
    active
      ? "bg-[#4636D7] text-white shadow-md shadow-[#4636D7]/20"
      : "text-[#767A8C] hover:bg-[#F6F5FA] hover:text-[#16182B]"
  }`;
}

function SettingsTabGroup({
  label,
  accent,
  children
}: {
  label: string;
  accent?: boolean;
  children: ReactNode;
}) {
  const items = Children.toArray(children);
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p
        className={`px-1 text-[11px] font-bold uppercase tracking-wider ${
          accent ? "text-[#4636D7]" : "text-[#767A8C]"
        }`}
      >
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{items}</div>
    </div>
  );
}

function SettingsContent() {
  const { locale } = useLanguage();
  const t = getMessages(locale);
  const [role, setRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("replies");
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("omnichat.user");
      let userRole = "OWNER";
      if (stored) {
        const parsed = JSON.parse(stored);
        userRole = parsed.role ?? "AGENT";
      }
      setRole(userRole);

      const tabParam = searchParams.get("tab") as SettingsTab | null;
      if (tabParam && ["channels", "replies", "knowledge", "scenarios", "automation", "team", "profile", "ai", "ai-curation"].includes(tabParam)) {
        if (tabParam === "knowledge" && userRole === "VIEWER") {
          setActiveTab("profile");
        } else {
          setActiveTab(tabParam);
        }
      } else {
        if (userRole === "OWNER" || userRole === "ADMIN") {
          setActiveTab("channels");
        } else if (userRole === "QC" || userRole === "VIEWER") {
          setActiveTab("profile");
        } else {
          setActiveTab("replies");
        }
      }
    } catch {
      setRole("OWNER");
      setActiveTab("channels");
    }
  }, [searchParams]);

  return (
    <div className="h-full overflow-y-auto bg-[#F7F7FA] p-4 sm:p-6 md:p-8">
      <section aria-labelledby="settings-heading" className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1.5 border-b border-[#DEDDE6]/60 pb-5">
          <div className="flex items-center gap-3">
            <h1 id="settings-heading" className="font-heading text-3xl font-semibold tracking-tight text-[#16182B]">
              {t.settingsTitle}
            </h1>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#ECEBFF] px-3 py-1 text-xs font-semibold text-[#4636D7]">
              <Sparkles size={12} />
              Premium SaaS
            </div>
          </div>
          <p className="text-sm text-[#767A8C]">
            {t.settingsSubtitle}
          </p>
        </div>

        {/* Tab Switcher — grouped by purpose */}
        <div className="space-y-4 rounded-xl border border-[#DEDDE6] bg-white p-3 shadow-sm sm:p-4">
          <SettingsTabGroup label={t.settingsGroupChannel}>
            {(role === "OWNER" || role === "ADMIN") && (
              <button
                type="button"
                onClick={() => setActiveTab("channels")}
                className={tabButtonClass(activeTab === "channels")}
              >
                <MessageSquareCode size={16} />
                {t.lineOaTab}
              </button>
            )}
            {(role === "OWNER" || role === "ADMIN" || role === "AGENT") && (
              <button
                type="button"
                onClick={() => setActiveTab("replies")}
                className={tabButtonClass(activeTab === "replies")}
              >
                <MessageSquareQuote size={16} />
                {t.quickReplyTab}
              </button>
            )}
            {(role === "OWNER" || role === "ADMIN") && (
              <button
                type="button"
                onClick={() => setActiveTab("team")}
                className={tabButtonClass(activeTab === "team")}
              >
                <Users size={16} />
                {t.teamTab}
              </button>
            )}
          </SettingsTabGroup>

          <div className="border-t border-[#DEDDE6]/80" />

          <SettingsTabGroup label={t.settingsGroupAi} accent>
            {(role === "OWNER" || role === "ADMIN" || role === "AGENT" || role === "QC") && (
              <button
                type="button"
                onClick={() => setActiveTab("knowledge")}
                className={tabButtonClass(activeTab === "knowledge")}
              >
                <BookOpen size={16} />
                {t.knowledgeTab}
              </button>
            )}
            {(role === "OWNER" || role === "ADMIN" || role === "AGENT" || role === "QC" || role === "VIEWER") && (
              <button
                type="button"
                onClick={() => setActiveTab("scenarios")}
                className={tabButtonClass(activeTab === "scenarios")}
              >
                <GitBranch size={16} />
                {t.scenariosTab}
              </button>
            )}
            {(role === "OWNER" || role === "ADMIN") && (
              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className={tabButtonClass(activeTab === "ai")}
              >
                <Sparkles size={16} />
                {t.aiAssistantTab}
              </button>
            )}
            {(role === "OWNER" || role === "ADMIN" || role === "QC") && (
              <button
                type="button"
                onClick={() => setActiveTab("ai-curation")}
                className={tabButtonClass(activeTab === "ai-curation")}
              >
                <Sparkles size={16} />
                {t.aiCurationTab}
              </button>
            )}
          </SettingsTabGroup>

          <div className="border-t border-[#DEDDE6]/80" />

          <SettingsTabGroup label={t.settingsGroupWorkflow}>
            {(role === "OWNER" || role === "ADMIN" || role === "AGENT" || role === "QC" || role === "VIEWER") && (
              <button
                type="button"
                onClick={() => setActiveTab("automation")}
                className={tabButtonClass(activeTab === "automation")}
              >
                <Workflow size={16} />
                {t.automationTab}
              </button>
            )}
          </SettingsTabGroup>

          <div className="border-t border-[#DEDDE6]/80" />

          <SettingsTabGroup label={t.settingsGroupAccount}>
            {role && (
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={tabButtonClass(activeTab === "profile")}
              >
                <UserIcon size={16} />
                {t.profileTab}
              </button>
            )}
          </SettingsTabGroup>
        </div>

        {/* Tab Content Panels (Mounted for mock fetch sequence, hidden via CSS) */}
        <div className="transition-all duration-300">
          {(role === "OWNER" || role === "ADMIN") && (
            <div className={`${activeTab === "channels" ? "block animate-in fade-in-50 slide-in-from-bottom-2 duration-300" : "hidden"}`}>
              <Card className="border border-[#DEDDE6]/80 p-4 sm:p-6 shadow-sm bg-white hover:shadow-md transition-shadow duration-300 rounded-2xl">
                <div className="flex flex-col gap-1 border-b border-[#DEDDE6]/60 pb-4 mb-6">
                  <h2 className="font-heading text-lg font-semibold text-[#16182B]">LINE OA Integration</h2>
                  <p className="text-sm text-[#767A8C]">
                    Connect and configure LINE Official Accounts to sync conversations and verify webhooks.
                  </p>
                </div>
                <LineChannelForm />
              </Card>
            </div>
          )}

          {(role === "OWNER" || role === "ADMIN" || role === "AGENT") && (
            <div className={`${activeTab === "replies" ? "block animate-in fade-in-50 slide-in-from-bottom-2 duration-300" : "hidden"}`}>
              <Card className="border border-[#DEDDE6]/80 p-4 sm:p-6 shadow-sm bg-white hover:shadow-md transition-shadow duration-300 rounded-2xl">
                <div className="flex flex-col gap-1 border-b border-[#DEDDE6]/60 pb-4 mb-6">
                  <h2 className="font-heading text-lg font-semibold text-[#16182B]">Quick Reply Templates</h2>
                  <p className="text-sm text-[#767A8C]">
                    Manage reusable replies scoped to specific LINE OAs. Agents can quickly insert these into composers.
                  </p>
                </div>
                <QuickReplyManager />
              </Card>
            </div>
          )}

          {(role === "OWNER" || role === "ADMIN" || role === "AGENT" || role === "QC") && (
            <div className={`${activeTab === "knowledge" ? "block animate-in fade-in-50 slide-in-from-bottom-2 duration-300" : "hidden"}`}>
              <Card className="border border-[#DEDDE6]/80 p-4 sm:p-6 shadow-sm bg-white hover:shadow-md transition-shadow duration-300 rounded-2xl">
                <div className="flex flex-col gap-1 border-b border-[#DEDDE6]/60 pb-4 mb-6">
                  <h2 className="font-heading text-lg font-semibold text-[#16182B]">{t.knowledgeTitle}</h2>
                  <p className="text-sm text-[#767A8C]">{t.knowledgeSubtitle}</p>
                </div>
                <KnowledgeSettingsPanel />
              </Card>
            </div>
          )}

          {(role === "OWNER" || role === "ADMIN" || role === "AGENT" || role === "QC" || role === "VIEWER") && (
            <div className={`${activeTab === "scenarios" ? "block animate-in fade-in-50 slide-in-from-bottom-2 duration-300" : "hidden"}`}>
              <Card className="border border-[#DEDDE6]/80 p-4 sm:p-6 shadow-sm bg-white hover:shadow-md transition-shadow duration-300 rounded-2xl">
                <div className="flex flex-col gap-1 border-b border-[#DEDDE6]/60 pb-4 mb-6">
                  <h2 className="font-heading text-lg font-semibold text-[#16182B]">{t.scenariosTitle}</h2>
                  <p className="text-sm text-[#767A8C]">{t.scenariosSubtitle}</p>
                </div>
                <ScenarioManager />
              </Card>
            </div>
          )}

          {(role === "OWNER" || role === "ADMIN" || role === "AGENT" || role === "QC" || role === "VIEWER") && (
            <div className={`${activeTab === "automation" ? "block animate-in fade-in-50 slide-in-from-bottom-2 duration-300" : "hidden"}`}>
              <Card className="border border-[#DEDDE6]/80 p-4 sm:p-6 shadow-sm bg-white hover:shadow-md transition-shadow duration-300 rounded-2xl">
                <div className="flex flex-col gap-1 border-b border-[#DEDDE6]/60 pb-4 mb-6">
                  <h2 className="font-heading text-lg font-semibold text-[#16182B]">{t.automationTitle}</h2>
                  <p className="text-sm text-[#767A8C]">{t.automationSubtitle}</p>
                </div>
                <AutomationManager />
              </Card>
            </div>
          )}

          {(role === "OWNER" || role === "ADMIN") && (
            <div className={`${activeTab === "team" ? "block animate-in fade-in-50 slide-in-from-bottom-2 duration-300" : "hidden"}`}>
              <Card className="border border-[#DEDDE6]/80 p-4 sm:p-6 shadow-sm bg-white hover:shadow-md transition-shadow duration-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <h2 className="font-heading text-lg font-semibold text-[#16182B]">Team & Collaborators</h2>
                  <p className="text-sm text-[#767A8C] mt-1">
                    Invite new agents, change member roles, and review access privileges for this workspace.
                  </p>
                </div>
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[#4636D7] px-6 text-sm font-semibold text-white shadow-md shadow-[#4636D7]/15 hover:bg-[#382BB5] transition-all duration-200 cursor-pointer"
                  href="/app/settings/team"
                >
                  Open Team Settings
                </Link>
              </Card>
            </div>
          )}

          {role && (
            <div className={`${activeTab === "profile" ? "block animate-in fade-in-50 slide-in-from-bottom-2 duration-300" : "hidden"}`}>
              <ProfileEditor active={activeTab === "profile"} />
            </div>
          )}

          {(role === "OWNER" || role === "ADMIN") && (
            <div className={`${activeTab === "ai" ? "block animate-in fade-in-50 slide-in-from-bottom-2 duration-300" : "hidden"}`}>
              <Card className="border border-[#DEDDE6]/80 p-4 sm:p-6 shadow-sm bg-white hover:shadow-md transition-shadow duration-300 rounded-2xl">
                <div className="flex flex-col gap-1 border-b border-[#DEDDE6]/60 pb-4 mb-6">
                  <h2 className="font-heading text-lg font-semibold text-[#16182B]">{t.aiAssistantTitle}</h2>
                  <p className="text-sm text-[#767A8C]">{t.aiAssistantSubtitle}</p>
                </div>
                <AiSettings />
              </Card>
            </div>
          )}
          {(role === "OWNER" || role === "ADMIN" || role === "QC") && (
            <div className={`${activeTab === "ai-curation" ? "block animate-in fade-in-50 slide-in-from-bottom-2 duration-300" : "hidden"}`}>
              <AiCurationManager />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center bg-[#F7F7FA]">
        <div className="text-sm text-[#767A8C]">Loading settings...</div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
