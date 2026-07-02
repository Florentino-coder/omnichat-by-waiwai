import { useState } from "react";

export function useAiSuggest() {
  const [enableAiSuggest, setEnableAiSuggest] = useState(true);
  const [enableHybridAutoDraft, setEnableHybridAutoDraft] = useState(true);
  
  const [composerInsertText, setComposerInsertText] = useState("");
  const [composerInsertNonce, setComposerInsertNonce] = useState(0);
  
  const [refreshSuggestionNonce, setRefreshSuggestionNonce] = useState(0);
  const [hybridDraftFailedNonce, setHybridDraftFailedNonce] = useState(0);
  
  const [isQuickReplyAutoEnter, setIsQuickReplyAutoEnter] = useState(false);
  const [isSendingQuickReply, setIsSendingQuickReply] = useState(false);

  function insertComposerText(body: string): void {
    setComposerInsertText(body);
    setComposerInsertNonce((current) => current + 1);
  }

  function toggleQuickReplyAutoEnter(): void {
    setIsQuickReplyAutoEnter((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("omni_quick_reply_auto_enter", String(next));
      } catch {
        // localStorage may be unavailable in restricted browsers.
      }
      return next;
    });
  }

  return {
    enableAiSuggest,
    setEnableAiSuggest,
    enableHybridAutoDraft,
    setEnableHybridAutoDraft,
    composerInsertText,
    composerInsertNonce,
    insertComposerText,
    refreshSuggestionNonce,
    setRefreshSuggestionNonce,
    hybridDraftFailedNonce,
    setHybridDraftFailedNonce,
    isQuickReplyAutoEnter,
    setIsQuickReplyAutoEnter,
    isSendingQuickReply,
    setIsSendingQuickReply,
    toggleQuickReplyAutoEnter,
  };
}
