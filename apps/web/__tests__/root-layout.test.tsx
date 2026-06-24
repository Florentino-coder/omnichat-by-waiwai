import RootLayout from "../app/layout";

describe("RootLayout", () => {
  it("renders children and font variables", () => {
    const layout = RootLayout({
      children: (
        <div>Root content</div>
      )
    });

    expect(layout.type).toBe("html");
    expect(layout.props.className).toContain("mock-font-variable");
    expect(layout.props.className).toContain("h-dvh");
    expect(layout.props.className).toContain("overflow-hidden");
    expect(layout.props.children.type).toBe("body");
    expect(layout.props.children.props.className).toContain("h-dvh");
    expect(layout.props.children.props.className).toContain("overflow-hidden");
    expect(layout.props.children.props.children.props.children).toBe("Root content");
  });
});
