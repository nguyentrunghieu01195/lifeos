import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/theme-toggle";

function renderToggle() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeToggle", () => {
  it("offers light, dark and system options", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole("button", { name: "Change theme" }));

    expect(await screen.findByRole("menuitem", { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /system/i })).toBeInTheDocument();
  });
});
