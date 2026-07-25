import type { ReactNode } from "react";

import { PageHeader } from "@/shared/components/PageHeader";

type CrudPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function CrudPageShell({
  eyebrow,
  title,
  description,
  actions,
  children,
}: CrudPageShellProps) {
  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={actions}
      />
      <section className="space-y-4">{children}</section>
    </>
  );
}
