// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Navbar from "@/components/Navbar";

const themeState = vi.hoisted(() => ({
  resolvedTheme: "light",
  setTheme: vi.fn(),
  theme: "system",
}));

vi.mock("next-themes", () => ({
  useTheme: () => themeState,
}));

afterEach(() => {
  cleanup();
  themeState.resolvedTheme = "light";
  themeState.setTheme.mockReset();
});

describe("Navbar accessibility", () => {
  it("offers dark mode with a moon icon when the resolved theme is light", async () => {
    themeState.resolvedTheme = "light";
    render(<Navbar />);

    const themeToggle = await screen.findByRole("button", {
      name: "Switch to dark theme",
    });

    expect(themeToggle.querySelector(".lucide-moon")).not.toBeNull();
    fireEvent.click(themeToggle);
    expect(themeState.setTheme).toHaveBeenCalledWith("dark");
  });

  it("offers light mode with a sun icon when the resolved theme is dark", async () => {
    themeState.resolvedTheme = "dark";
    render(<Navbar />);

    const themeToggle = await screen.findByRole("button", {
      name: "Switch to light theme",
    });

    expect(themeToggle.querySelector(".lucide-sun")).not.toBeNull();
    fireEvent.click(themeToggle);
    expect(themeState.setTheme).toHaveBeenCalledWith("light");
  });
});
