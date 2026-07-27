import { AppShell } from "@/app/layouts/AppShell";
import { QueueDisplayView, QueueView } from "@/features/queue/QueueView";

export function QueuePage() {
  return (
    <AppShell>
      <QueueView />
    </AppShell>
  );
}

export function QueueDisplayPage() {
  return <QueueDisplayView />;
}
