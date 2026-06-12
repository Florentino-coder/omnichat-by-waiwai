import { render, screen } from "@testing-library/react";
import { Button } from "../components/button";

describe("Button", () => {
  it("renders children and disabled state", () => {
    render(<Button disabled>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
  });
});
