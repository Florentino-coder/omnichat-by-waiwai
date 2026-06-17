"use client";

import { useEffect, useState } from "react";
import { Card } from "@omnichat/ui";
import Link from "next/link";
import { MessageSquareQuote, Sparkles, Users, MessageSquareCode, User as UserIcon } from "lucide-react";
import { LineChannelForm } from "./line-channel-form";
import { QuickReplyManager } from "./quick-reply-manager";
import { ProfileEditor } from "./profile-editor";
import { useLanguage } from "../../lib/language-context";
import { getMessages } from "../../lib/i18n";

type SettingsTab = "channels" | "replies" | "team" | "profile";

export default function SettingsPage() {
  const { locale } = useLanguage();
  const t = getMessages(locale);
  const [role, setRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("replies");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("omnichat.user");
      let userRole = "OWNER";
      if (stored) {
        const parsed = JSON.parse(stored);
        userRole = parsed.role ?? "AGENT";
      }
      setRole(userRole);
      if (userRole === "OWNER" || userRole === "ADMIN") {
        setActiveTab("channels");
      } else if (userRole === "QC" || userRole === "VIEWER") {
        setActiveTab("profile");
      } else {
        setActiveTab("replies");
      }
    } catch {
      setRole("OWNER");
      setActiveTab("channels");
    }
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-[#F7F7FA] p-6 md:p-8">
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
            Configure LINE OA channels, team collaboration, and quick replies for your organization.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#DEDDE6] bg-white p-1.5 shadow-sm max-w-lg">
          {(role === "OWNER" || role === "ADMIN") && (
            <button
              type="button"
              onClick={() => setActiveTab("channels")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeTab === "channels"
                  ? "bg-[#4636D7] text-white shadow-md shadow-[#4636D7]/20"
                  : "text-[#767A8C] hover:bg-[#F6F5FA] hover:text-[#16182B]"
              }`}
            >
              <MessageSquareCode size={16} />
              {t.lineOaTab}
            </button>
          )}
          {(role === "OWNER" || role === "ADMIN" || role === "AGENT") && (
            <button
              type="button"
              onClick={() => setActiveTab("replies")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeTab === "replies"
                  ? "bg-[#4636D7] text-white shadow-md shadow-[#4636D7]/20"
                  : "text-[#767A8C] hover:bg-[#F6F5FA] hover:text-[#16182B]"
              }`}
            >
              <MessageSquareQuote size={16} />
              {t.quickReplyTab}
            </button>
          )}
          {(role === "OWNER" || role === "ADMIN") && (
            <button
              type="button"
              onClick={() => setActiveTab("team")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeTab === "team"
                  ? "bg-[#4636D7] text-white shadow-md shadow-[#4636D7]/20"
                  : "text-[#767A8C] hover:bg-[#F6F5FA] hover:text-[#16182B]"
              }`}
            >
              <Users size={16} />
              {t.teamTab}
            </button>
          )}
          {role && (
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeTab === "profile"
                  ? "bg-[#4636D7] text-white shadow-md shadow-[#4636D7]/20"
                  : "text-[#767A8C] hover:bg-[#F6F5FA] hover:text-[#16182B]"
              }`}
            >
              <UserIcon size={16} />
              {t.profileTab}
            </button>
          )}
        </div>

        {/* Tab Content Panels (Mounted for mock fetch sequence, hidden via CSS) */}
        <div className="transition-all duration-300">
          {(role === "OWNER" || role === "ADMIN") && (
            <div className={`${activeTab === "channels" ? "block animate-in fade-in-50 slide-in-from-bottom-2 duration-300" : "hidden"}`}>
              <Card className="border border-[#DEDDE6]/80 p-6 shadow-sm bg-white hover:shadow-md transition-shadow duration-300 rounded-2xl">
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
              <Card className="border border-[#DEDDE6]/80 p-6 shadow-sm bg-white hover:shadow-md transition-shadow duration-300 rounded-2xl">
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

          {(role === "OWNER" || role === "ADMIN") && (
            <div className={`${activeTab === "team" ? "block animate-in fade-in-50 slide-in-from-bottom-2 duration-300" : "hidden"}`}>
              <Card className="border border-[#DEDDE6]/80 p-6 shadow-sm bg-white hover:shadow-md transition-shadow duration-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
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
        </div>
      </section>
    </div>
  );
}
