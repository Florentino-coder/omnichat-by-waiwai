import { render, screen } from "@testing-library/react";
import AppLayout from "../app/app/layout";

jest.mock("../app/lib/language-context", () => ({
  useLanguage: () => ({ locale: "th", setLocale: () => {} }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

jest.mock("../app/lib/use-auth-session", () => ({
  useAuthSession: () => ({ user: { role: "AGENT" } })
}));

jest.mock("../app/lib/use-proactive-session-refresh", () => ({
  useProactiveSessionRefresh: () => {}
}));

jest.mock("../app/app/user-menu", () => ({
  UserMenu: () => <div>User menu</div>
}));

describe("AppLayout", () => {
  it("locks the shell to the dynamic viewport height", () => {
    render(
      <AppLayout>
        <div data-testid="page-content">Inbox page</div>
      </AppLayout>
    );

    const shell = screen.getByRole("main");
    expect(shell).toHaveClass("h-dvh");
    expect(shell).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });
});
