import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaginationControls } from "./PaginationControls";

afterEach(() => {
  cleanup();
});

describe("PaginationControls", () => {
  it("disables Previous at offset zero and renders no numbered pagination", async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();

    render(
      <PaginationControls
        offset={0}
        limit={10}
        hasNext
        onPrevious={onPrevious}
        onNext={onNext}
      />,
    );

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "2" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(onPrevious).not.toHaveBeenCalled();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("keeps Previous and Next disabled while a page is fetching", () => {
    render(
      <PaginationControls
        offset={10}
        limit={10}
        hasNext
        isFetching
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(screen.getByText(/Actualizando/)).toBeInTheDocument();
  });
});
