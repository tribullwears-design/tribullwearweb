import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import { validateAdminAccountSettings } from "../lib/adminAccountSettings";

type Props = {
  name: string;
  email: string;
  onProfileUpdated: (name: string) => void;
};

export default function AdminAccountSettings({ name, email, onProfileUpdated }: Props) {
  const [formName, setFormName] = useState(name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => setFormName(name), [name]);

  const reset = () => {
    setFormName(name);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError("");
    setSuccess("");
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    const validation = validateAdminAccountSettings({ name: formName, currentPassword, newPassword, confirmNewPassword });
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });
      const payload = await response.json().catch(() => undefined) as { user?: { name?: string }; error?: string } | undefined;
      if (!response.ok || !payload?.user?.name) {
        throw new Error(payload?.error || "Unable to save account settings.");
      }
      setFormName(payload.user.name);
      onProfileUpdated(payload.user.name);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      const message = "Account settings saved.";
      setSuccess(message);
      toast.success(message);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to save account settings.";
      setError(message);
      toast.error("Account settings were not saved.", { description: message });
    } finally {
      setSaving(false);
    }
  };

  return <div className="admin-account-settings">
    <div className="admin-account-identity">
      <span>Signed in as</span>
      <strong>{name}</strong>
      <span>{email}</span>
    </div>
    <form className="admin-form admin-account-form" onSubmit={save} noValidate>
      <label><span>Admin name</span><input autoComplete="name" maxLength={80} required value={formName} disabled={saving} onChange={(event) => setFormName(event.target.value)} /></label>
      <label><span>Email address</span><input type="email" value={email} readOnly aria-readonly="true" /></label>
      <div className="admin-account-password-heading"><h3>Change password</h3><p>Leave password fields blank to keep your current password.</p></div>
      <label><span>Current password</span><div className="admin-password-wrap"><input type={showCurrentPassword ? "text" : "password"} autoComplete="current-password" value={currentPassword} disabled={saving} onChange={(event) => setCurrentPassword(event.target.value)} /><button type="button" disabled={saving} aria-label={showCurrentPassword ? "Hide current password" : "Show current password"} onClick={() => setShowCurrentPassword((visible) => !visible)}>{showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
      <label><span>New password</span><div className="admin-password-wrap"><input type={showNewPassword ? "text" : "password"} autoComplete="new-password" value={newPassword} disabled={saving} onChange={(event) => setNewPassword(event.target.value)} /><button type="button" disabled={saving} aria-label={showNewPassword ? "Hide new password" : "Show new password"} onClick={() => setShowNewPassword((visible) => !visible)}>{showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
      <label><span>Confirm new password</span><div className="admin-password-wrap"><input type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={confirmNewPassword} disabled={saving} onChange={(event) => setConfirmNewPassword(event.target.value)} /><button type="button" disabled={saving} aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"} onClick={() => setShowConfirmPassword((visible) => !visible)}>{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
      {error && <p className="admin-image-error" role="alert">{error}</p>}
      {success && <p className="admin-form-success" role="status">{success}</p>}
      <div className="admin-form-actions"><button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button><button className="admin-secondary-button" type="button" disabled={saving} onClick={reset}>Cancel</button></div>
    </form>
  </div>;
}
