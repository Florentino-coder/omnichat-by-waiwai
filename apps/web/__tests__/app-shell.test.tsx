import { render, screen } from "@testing-library/react";
import AppLayout from "../app/app/layout";
import SettingsPage from "../app/app/settings/page";

describe("App shell", () => {
  it("renders icon rail, enabled inbox nav, disabled future nav, and settings content", () => {
    render(
      <AppLayout>
        <SettingsPage />
      </AppLayout>
    );

    const nav = screen.getByLabelText("Primary");
    expect(nav).toHaveClass("w-14");

    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute(
      "href",
      "/app/inbox"
    );

    for (const label of ["Customers", "Reports", "Knowledge", "Settings"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    expect(screen.getByRole("button", { name: "Customers" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Settings" })).not.toBeDisabled();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });
});
