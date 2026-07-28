import { AppShell } from "@/app/layouts/AppShell";
import { SettingsView } from "@/features/settings/SettingsView";

export function SettingsPage() {
  return (
    <AppShell>
      <SettingsView />
    </AppShell>
  );
}
