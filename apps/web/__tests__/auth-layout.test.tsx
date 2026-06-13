import { render, screen } from "@testing-library/react";
import AuthLayout from "../app/(auth)/layout";
import LoginPage from "../app/(auth)/login/page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn()
  })
}));

describe("AuthLayout", () => {
  it("renders centered card shell with login content", () => {
    render(
      <AuthLayout>
        <LoginPage />
      </AuthLayout>
    );

    expect(screen.getByText("OmniChat")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveClass("w-full");
  });
});
