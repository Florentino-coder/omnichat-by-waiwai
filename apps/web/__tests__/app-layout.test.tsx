import { render, screen } from "@testing-library/react";
import AppLayout from "../app/app/layout";
import { useAuthSession } from "../app/lib/use-auth-session";

jest.mock("../app/lib/language-context", () => ({
  useLanguage: () => ({ locale: "th", setLocale: () => {} }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

jest.mock("../app/lib/use-auth-session", () => ({
  useAuthSession: jest.fn()
}));

jest.mock("../app/lib/use-proactive-session-refresh", () => ({
  useProactiveSessionRefresh: () => {}
}));

jest.mock("../app/app/user-menu", () => ({
  UserMenu: () => <div>User menu</div>
}));

const mockedUseAuthSession = useAuthSession as jest.MockedFunction<typeof useAuthSession>;

describe("AppLayout", () => {
  beforeEach(() => {
    mockedUseAuthSession.mockReturnValue({
      user: { id: "user-1", email: "agent@test.com", displayName: "Agent", role: "AGENT" },
      isLoading: false,
      error: null
    });
  });

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

  it("shows nav skeleton while auth session is loading", () => {
    mockedUseAuthSession.mockReturnValue({
      user: null,
      isLoading: true,
      error: null
    });

    render(
      <AppLayout>
        <div data-testid="page-content">Inbox page</div>
      </AppLayout>
    );

    const nav = screen.getByLabelText("Primary");
    expect(nav.querySelectorAll(".animate-pulse")).toHaveLength(5);
    expect(screen.queryByRole("link", { name: "กล่องข้อความ" })).not.toBeInTheDocument();
  });
});
