"use client";

import { useEffect, useState } from "react";

import { useNotice } from "@/components/providers/notice-provider";
import { useSession } from "@/components/providers/session-provider";
import { AdminPageHeader, AdminSection, FieldLabel } from "@/components/admin/shared";
import { requestJson } from "@/lib/admin/client";
import type { AdminProfilePayload } from "@/lib/admin/types";

export function ProfilePage() {
  const { notify } = useNotice();
  const { logout, setUser } = useSession();
  const [profile, setProfile] = useState<AdminProfilePayload | null>(null);
  const [passwords, setPasswords] = useState({ currentPassword: "", nextPassword: "" });

  useEffect(() => {
    void requestJson<AdminProfilePayload>("/api/admin/profile").then((response) => {
      setProfile(response);
    });
  }, []);

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) {
      return;
    }

    const nextProfile = await requestJson<AdminProfilePayload>("/api/admin/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: profile.name,
        email: profile.email,
        department: profile.department,
        phone: profile.phone,
        bio: profile.bio,
      }),
    });
    setProfile(nextProfile);
    setUser({
      id: nextProfile.id,
      name: nextProfile.name,
      email: nextProfile.email,
      role: nextProfile.role,
      avatar: nextProfile.avatar,
    });
    notify("Profile updated.", "success");
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await requestJson("/api/admin/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(passwords),
    });
    setPasswords({ currentPassword: "", nextPassword: "" });
    notify("Password changed successfully.", "success");
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Administration"
        title="Admin Profile"
        description="Update administrator details, rotate the password, and close the current BookHive session securely."
        actions={
          <button type="button" className="admin-secondary-btn rounded-2xl px-4 py-3 text-sm" onClick={() => void logout()}>
            Logout
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <AdminSection title="Profile Details" description="Edit the visible administrator information used across the dashboard.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleProfileSubmit}>
            <FieldLabel label="Name">
              <input value={profile.name} onChange={(event) => setProfile((current) => current ? { ...current, name: event.target.value } : current)} className="glass-input w-full px-4 py-3" />
            </FieldLabel>
            <FieldLabel label="Email">
              <input type="email" value={profile.email} onChange={(event) => setProfile((current) => current ? { ...current, email: event.target.value } : current)} className="glass-input w-full px-4 py-3" />
            </FieldLabel>
            <FieldLabel label="Department">
              <select value={profile.department} onChange={(event) => setProfile((current) => current ? { ...current, department: event.target.value as typeof profile.department } : current)} className="glass-input w-full px-4 py-3">
                <option value="Computer Science">Computer Science</option>
                <option value="Engineering">Engineering</option>
                <option value="Education">Education</option>
                <option value="Business & Accountancy">Business &amp; Accountancy</option>
                <option value="Arts & Sciences">Arts &amp; Sciences</option>
              </select>
            </FieldLabel>
            <FieldLabel label="Phone">
              <input value={profile.phone} onChange={(event) => setProfile((current) => current ? { ...current, phone: event.target.value } : current)} className="glass-input w-full px-4 py-3" />
            </FieldLabel>
            <div className="md:col-span-2">
              <FieldLabel label="Bio">
                <textarea value={profile.bio} onChange={(event) => setProfile((current) => current ? { ...current, bio: event.target.value } : current)} className="glass-input w-full px-4 py-3" />
              </FieldLabel>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="admin-primary-btn rounded-2xl px-4 py-3 font-semibold">
                Save Profile
              </button>
            </div>
          </form>
        </AdminSection>

        <AdminSection title="Change Password" description="Use a strong new password to secure the administrator account.">
          <form className="space-y-4" onSubmit={handlePasswordSubmit}>
            <FieldLabel label="Current Password">
              <input type="password" value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} className="glass-input w-full px-4 py-3" />
            </FieldLabel>
            <FieldLabel label="New Password">
              <input type="password" value={passwords.nextPassword} onChange={(event) => setPasswords((current) => ({ ...current, nextPassword: event.target.value }))} className="glass-input w-full px-4 py-3" />
            </FieldLabel>
            <button type="submit" className="admin-primary-btn rounded-2xl px-4 py-3 font-semibold">
              Update Password
            </button>
          </form>
        </AdminSection>
      </div>
    </div>
  );
}
