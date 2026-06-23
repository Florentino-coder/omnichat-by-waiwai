"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, FileText } from "lucide-react";
import { useLanguage } from "../../lib/language-context";
import { getMessages } from "../../lib/i18n";
import { KnowledgeManager } from "./knowledge-manager";
import { KnowledgeDocumentManager } from "./knowledge-document-manager";

type KnowledgeTab = "articles" | "documents";

function KnowledgeSettingsPanelContent() {
  const { locale } = useLanguage();
  const t = getMessages(locale);
  const searchParams = useSearchParams();
  const subParam = searchParams?.get("sub") ?? searchParams?.get("section");
  const [activeTab, setActiveTab] = useState<KnowledgeTab>("articles");

  useEffect(() => {
    if (subParam === "documents") {
      setActiveTab("documents");
    } else if (subParam === "articles") {
      setActiveTab("articles");
    }
  }, [subParam]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-[#DEDDE6]/60 pb-4">
        <button
          type="button"
          onClick={() => setActiveTab("articles")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "articles"
              ? "bg-[#4636D7] text-white"
              : "bg-[#F3F3F6] text-[#4B4F63] hover:bg-[#ECEBFF]"
          }`}
        >
          <BookOpen size={16} />
          {t.faqArticlesTab}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("documents")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "documents"
              ? "bg-[#4636D7] text-white"
              : "bg-[#F3F3F6] text-[#4B4F63] hover:bg-[#ECEBFF]"
          }`}
        >
          <FileText size={16} />
          {t.ragDocumentsTab}
        </button>
      </div>

      {activeTab === "articles" ? <KnowledgeManager /> : <KnowledgeDocumentManager />}
    </div>
  );
}

export function KnowledgeSettingsPanel() {
  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-[#767A8C]">Loading knowledge settings...</div>
      }
    >
      <KnowledgeSettingsPanelContent />
    </Suspense>
  );
}
