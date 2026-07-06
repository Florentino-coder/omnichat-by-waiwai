import { Test, TestingModule } from "@nestjs/testing";
import { SlipOkClient } from "./slipok.client";
import { ConfigService } from "@nestjs/config";

describe("SlipOkClient", () => {
  let client: SlipOkClient;
  let configService: any;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === "SLIPOK_API_KEY") return "test-api-key";
        if (key === "SLIPOK_BRANCH_ID") return "test-branch-id";
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlipOkClient,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    client = module.get<SlipOkClient>(SlipOkClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return valid status on successful validation", async () => {
    const mockResponse = {
      success: true,
      data: { amount: 150.0, sender: "Mr. Test" },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as any);

    const result = await client.verifyQr("dummy-qr");
    expect(result).toEqual({
      status: "valid",
      data: mockResponse.data,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.slipok.com/api/line/apikey/test-branch-id",
      expect.objectContaining({
        method: "POST",
        headers: {
          "x-authorization": "test-api-key",
          "Content-Type": "application/json",
        },
      })
    );
  });

  it("should return duplicate status when API response indicates duplicate", async () => {
    const mockResponse = {
      success: false,
      message: "This transaction has already been verified",
      code: "DUPLICATE_VERIFICATION",
      data: { amount: 150.0 },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve(mockResponse),
    } as any);

    const result = await client.verifyQr("dummy-qr");
    expect(result).toEqual({
      status: "duplicate",
      message: "This transaction has already been verified",
      data: mockResponse.data,
    });
  });

  it("should return invalid status on general API failure", async () => {
    const mockResponse = {
      success: false,
      message: "Invalid QR code",
      data: null,
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve(mockResponse),
    } as any);

    const result = await client.verifyQr("dummy-qr");
    expect(result).toEqual({
      status: "invalid",
      message: "Invalid QR code",
      data: null,
    });
  });

  it("should return error status on abort timeout", async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      const err = new Error("The user aborted a request.");
      err.name = "AbortError";
      throw err;
    });

    const result = await client.verifyQr("dummy-qr");
    expect(result).toEqual({
      status: "error",
      message: "Request timeout",
    });
  });

  it("should return error status if config credentials are missing", async () => {
    configService.get.mockReturnValue(null);
    const missingClient = new SlipOkClient(configService);

    const result = await missingClient.verifyQr("dummy-qr");
    expect(result).toEqual({
      status: "error",
      message: "SlipOK credentials missing",
    });
  });
});
