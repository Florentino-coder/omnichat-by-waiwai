import { render, screen } from "@testing-library/react";
import { Input } from "../components/input";

describe("Input", () => {
  it("forwards props and placeholder", () => {
    render(<Input placeholder="Email" aria-label="Email" />);

    expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "Email");
  });
});
