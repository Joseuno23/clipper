import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "./ThemeProvider";
import { useTheme } from "./themeContext";

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark", "light");
  window.localStorage.clear();
});

describe("ThemeProvider", () => {
  it("loads and applies the stored theme", () => {
    window.localStorage.setItem("clipper.theme", "light");

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Cambiar tema light" }),
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("light");
  });

  it("persists theme changes", async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Cambiar tema dark" }),
    );

    expect(window.localStorage.getItem("clipper.theme")).toBe("light");
    expect(document.documentElement).toHaveClass("light");
  });
});

function ThemeProbe() {
  const { theme, toggle } = useTheme();

  return <button onClick={toggle}>Cambiar tema {theme}</button>;
}
