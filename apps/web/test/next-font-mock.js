module.exports = new Proxy(
  {},
  {
    get() {
      return () => ({ className: "mock-font", variable: "mock-font-variable" });
    }
  }
);
