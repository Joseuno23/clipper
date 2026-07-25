import { AppShell } from "@/app/layouts/AppShell";
import { QueueView } from "@/features/queue/QueueView";

export function QueuePage() {
  return (
    <AppShell>
      <QueueView />
    </AppShell>
  );
}
