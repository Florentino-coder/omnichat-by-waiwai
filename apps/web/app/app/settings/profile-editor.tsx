"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Save, KeyRound, Bell } from "lucide-react";
import { Button, Input, Label, Card } from "@omnichat/ui";
import { apiFetch } from "../../lib/api-client";
import { clearAuthSessionCookies } from "../../lib/session-cookies";
import { useLanguage } from "../../lib/language-context";
import { getMessages } from "../../lib/i18n";
import { showTestDesktopNotification } from "../../lib/browser-notifications";
import { useBrowserNotifications } from "../../lib/use-browser-notifications";

type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
};

export function ProfileEditor({ active }: { active: boolean }) {
  const { locale } = useLanguage();
  const t = getMessages(locale);
  const {
    enabled: desktopNotificationsEnabled,
    permission: notificationPermission,
    supported: notificationsSupported,
    setPrefEnabled: setDesktopNotificationsEnabled,
    requestPermission: requestDesktopNotificationPermission
  } = useBrowserNotifications();

  // Profile Form State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [notificationTestMessage, setNotificationTestMessage] = useState<string | null>(null);
  const [notificationTestIsError, setNotificationTestIsError] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }
    async function loadProfile() {
      try {
        const data = await apiFetch<UserProfile>("/api/v1/users/me");
        setProfile(data);
        setDisplayName(data.displayName);
      } catch (err) {
        setProfileError(
          err instanceof Error
            ? err.message
            : locale === "th"
            ? "ไม่สามารถโหลดข้อมูลโปรไฟล์ได้"
            : "Could not load profile."
        );
      }
    }
    void loadProfile();
  }, [active, locale]);

  async function handleUpdateProfile(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || isSavingProfile) {
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const updated = await apiFetch<UserProfile>("/api/v1/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() })
      });

      setProfile(updated);
      setDisplayName(updated.displayName);
      setProfileSuccess(
        locale === "th"
          ? "อัปเดตโปรไฟล์สำเร็จแล้ว"
          : "Profile updated successfully."
      );

      // Update local storage so header user menu updates immediately
      const stored = window.localStorage.getItem("omnichat.user");
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.displayName = updated.displayName;
        window.localStorage.setItem("omnichat.user", JSON.stringify(parsed));
      }

      // Dispatch storage event to notify header/other components of layout
      window.dispatchEvent(new Event("storage"));
      
      // Short delay and reload to ensure clean client sync
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleUpdatePassword(e: FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword || isSavingPassword) {
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        locale === "th"
          ? "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน"
          : "New password and confirmation do not match."
      );
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(
        locale === "th"
          ? "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร"
          : "New password must be at least 8 characters long."
      );
      return;
    }

    setIsSavingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      await apiFetch<void>("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      setPasswordSuccess(
        locale === "th"
          ? "เปลี่ยนรหัสผ่านสำเร็จแล้ว ระบบกำลังนำคุณไปหน้าเข้าสู่ระบบ..."
          : "Password changed successfully. Redirecting to login..."
      );

      // Clear tokens and force logout
      setTimeout(() => {
        window.localStorage.removeItem("omnichat.accessToken");
        window.localStorage.removeItem("omnichat.refreshToken");
        window.localStorage.removeItem("omnichat.user");
        clearAuthSessionCookies();

        window.location.href = "/login";
      }, 2000);
    } catch (err) {
      setPasswordError(
        err instanceof Error
          ? err.message
          : locale === "th"
          ? "ไม่สามารถเปลี่ยนรหัสผ่านได้ รหัสผ่านปัจจุบันอาจไม่ถูกต้อง"
          : "Failed to change password. Current password may be incorrect."
      );
    } finally {
      setIsSavingPassword(false);
    }
  }

  if (!profile && !profileError) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          {locale === "th" ? "กำลังโหลดข้อมูลโปรไฟล์..." : "Loading profile..."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Profile Info Card */}
      <Card className="border border-[#DEDDE6]/80 p-6 shadow-sm bg-white rounded-2xl">
        <div className="flex flex-col gap-1 border-b border-[#DEDDE6]/60 pb-4 mb-6">
          <h2 className="font-heading text-lg font-semibold text-[#16182B]">{t.profileTitle}</h2>
          <p className="text-sm text-[#767A8C]">
            {locale === "th"
              ? "ดูข้อมูลบัญชีผู้ใช้ของคุณและแก้ไขชื่อที่แสดงในการทำงาน"
              : "View your user account information and modify your display name."}
          </p>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
          {profileError && (
            <div className="rounded-lg bg-danger/10 p-3 text-xs text-danger">{profileError}</div>
          )}
          {profileSuccess && (
            <div className="rounded-lg bg-success/10 p-3 text-xs text-success">{profileSuccess}</div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="profile-username">{locale === "th" ? "ชื่อผู้ใช้งาน" : "Username"}</Label>
            <Input
              id="profile-username"
              type="text"
              disabled
              value={profile?.username ?? "-"}
              className="bg-[#F6F5FA]"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-email">อีเมล</Label>
            <Input
              id="profile-email"
              type="email"
              disabled
              value={profile?.email ?? ""}
              className="bg-[#F6F5FA]"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-display-name">{t.displayNameLabel}</Label>
            <Input
              id="profile-display-name"
              type="text"
              maxLength={120}
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <Button type="submit" className="gap-2" disabled={isSavingProfile || displayName.trim() === profile?.displayName}>
            <Save size={14} />
            {isSavingProfile ? (locale === "th" ? "กำลังบันทึก..." : "Saving...") : t.save}
          </Button>
        </form>
      </Card>

      {notificationsSupported ? (
        <Card className="border border-[#DEDDE6]/80 p-6 shadow-sm bg-white rounded-2xl">
          <div className="flex flex-col gap-1 border-b border-[#DEDDE6]/60 pb-4 mb-6">
            <h2 className="font-heading text-lg font-semibold text-[#16182B] flex items-center gap-2">
              <Bell size={18} aria-hidden="true" />
              {t.desktopNotifications}
            </h2>
            <p className="text-sm text-[#767A8C]">{t.desktopNotificationsHint}</p>
            <p className="text-sm text-amber-700">{t.desktopNotificationsWindowsHint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-3 text-sm">
              <input
                checked={desktopNotificationsEnabled}
                onChange={(event) => {
                  setNotificationTestMessage(null);
                  setNotificationTestIsError(false);
                  const next = event.target.checked;
                  setDesktopNotificationsEnabled(next);
                  if (next && notificationPermission === "default") {
                    void requestDesktopNotificationPermission();
                  }
                }}
                type="checkbox"
              />
              {t.enableDesktopNotifications}
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!desktopNotificationsEnabled || notificationPermission !== "granted"}
              onClick={() => {
                const result = showTestDesktopNotification();
                if (result.ok) {
                  setNotificationTestIsError(false);
                  setNotificationTestMessage(t.testDesktopNotificationSent);
                  return;
                }
                setNotificationTestIsError(true);
                if (result.reason === "denied") {
                  setNotificationTestMessage(t.testDesktopNotificationDenied);
                  window.alert(`${t.testDesktopNotificationDenied}\n\n${t.desktopNotificationsWindowsHint}`);
                  return;
                }
                if (result.reason === "disabled") {
                  setNotificationTestMessage(t.testDesktopNotificationDisabled);
                  return;
                }
                if (result.reason === "unsupported") {
                  setNotificationTestMessage(t.testDesktopNotificationFailed);
                  window.alert(t.testDesktopNotificationFailed);
                  return;
                }
                const detail = result.message ? `\n\n${result.message}` : "";
                setNotificationTestMessage(t.testDesktopNotificationFailed);
                window.alert(`${t.testDesktopNotificationFailed}${detail}\n\n${t.desktopNotificationsWindowsHint}`);
              }}
            >
              {t.testDesktopNotification}
            </Button>
          </div>
          {notificationTestMessage ? (
            <p
              className={`mt-2 text-xs ${notificationTestIsError ? "text-amber-700" : "text-emerald-700"}`}
            >
              {notificationTestMessage}
            </p>
          ) : null}
          {notificationPermission === "denied" ? (
            <p className="mt-2 text-xs text-amber-700">
              {locale === "th"
                ? "เบราว์เซอร์บล็อกการแจ้งเตือน โปรดอนุญาตในการตั้งค่าเบราว์เซอร์"
                : "Notifications are blocked in your browser settings."}
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* Password Reset Card */}
      <Card className="border border-[#DEDDE6]/80 p-6 shadow-sm bg-white rounded-2xl">
        <div className="flex flex-col gap-1 border-b border-[#DEDDE6]/60 pb-4 mb-6">
          <h2 className="font-heading text-lg font-semibold text-[#16182B]">{t.changePassword}</h2>
          <p className="text-sm text-[#767A8C]">
            {locale === "th"
              ? "เปลี่ยนรหัสผ่านเพื่อความปลอดภัยของบัญชีผู้ใช้"
              : "Change your password for account security."}
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
          {passwordError && (
            <div className="rounded-lg bg-danger/10 p-3 text-xs text-danger">{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className="rounded-lg bg-success/10 p-3 text-xs text-success">{passwordSuccess}</div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="current-password">{t.currentPassword}</Label>
            <Input
              id="current-password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-password">{t.newPassword}</Label>
            <Input
              id="new-password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-password">{t.confirmNewPassword}</Label>
            <Input
              id="confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <Button type="submit" className="gap-2" disabled={isSavingPassword || !currentPassword || !newPassword || !confirmPassword}>
            <KeyRound size={14} />
            {isSavingPassword ? (locale === "th" ? "กำลังเปลี่ยน..." : "Changing...") : t.changePassword}
          </Button>
        </form>
      </Card>
    </div>
  );
}
