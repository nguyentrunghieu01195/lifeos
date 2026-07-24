import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders an accessible button with its label", () => {
    render(<Button>Save changes</Button>);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("renders as the child element with asChild (used for link buttons)", () => {
    render(
      <Button asChild>
        <a href="/dashboard">Open dashboard</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Open dashboard" });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("supports the destructive variant via data-variant classes", () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.className).toContain("destructive");
  });

  it("is disabled when the disabled prop is set", () => {
    render(<Button disabled>Submit</Button>);
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });
});
