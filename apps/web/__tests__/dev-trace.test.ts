import { devTrace, devTraceError } from "../app/lib/dev-trace";

describe("devTrace", () => {
  it("does not log in non-development environments", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    devTrace("[TRACE] test");
    devTraceError("[TRACE] error");

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
