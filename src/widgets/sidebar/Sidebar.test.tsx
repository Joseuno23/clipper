import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "./Sidebar";

const { appointmentsListByDate, queueLive } = vi.hoisted(() => ({
  appointmentsListByDate: vi.fn(),
  queueLive: vi.fn(),
}));

vi.mock("@/shared/api/auth", () => ({
  authKeys: { me: ["auth", "me"] },
  me: vi.fn().mockResolvedValue({
    user: {
      id: "user_1",
      email: "admin@clipper.test",
      displayName: "Admin User",
      status: "ACTIVE",
    },
    tenant: {
      barberShopId: "shop_1",
      name: "Clipper Test",
      slug: "niche-72",
      timezone: "America/Argentina/Buenos_Aires",
      currency: "ARS",
    },
    membership: { id: "member_1", role: "OWNER", status: "ACTIVE" },
    tokenClaims: {},
  }),
  clearAuthSession: vi.fn(),
}));

vi.mock("@/shared/api/appointments", () => ({
  appointmentKeys: {
    listByDate: (date: string) => ["appointments", "date", date],
  },
  appointmentsApi: { listByDate: appointmentsListByDate },
}));

vi.mock("@/shared/api/queue", () => ({
  queueKeys: { live: ["queue", "live"] },
  queueApi: { live: queueLive },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderSidebar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Sidebar", () => {
  it("shows real agenda and queue counts instead of hardcoded badges", async () => {
    appointmentsListByDate.mockResolvedValue([
      { id: "appt_1" },
      { id: "appt_2" },
    ]);
    queueLive.mockResolvedValue({
      queues: [
        { totalActiveCount: 1, tickets: [] },
        { totalActiveCount: 2, tickets: [] },
      ],
    });

    renderSidebar();

    expect(await screen.findByText("Clipper Test")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Agenda\s*2/ })).toHaveAttribute(
      "href",
      "/appointments",
    );
    expect(screen.getByRole("link", { name: /Cola\s*3/ })).toHaveAttribute(
      "href",
      "/queue",
    );
  });

  it("hides agenda and queue badges when there is nothing to count", async () => {
    appointmentsListByDate.mockResolvedValue([]);
    queueLive.mockResolvedValue({ queues: [] });

    renderSidebar();

    expect(
      await screen.findByRole("link", { name: "Agenda" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cola" })).toBeInTheDocument();
  });
});
