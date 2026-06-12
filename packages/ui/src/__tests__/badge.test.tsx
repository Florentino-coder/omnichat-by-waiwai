import { render, screen } from "@testing-library/react";
import { Badge } from "../components/badge";

describe("Badge", () => {
  it("applies semantic variant classes", () => {
    render(<Badge variant="success">Active</Badge>);

    expect(screen.getByText("Active")).toHaveClass("text-success");
  });
});
