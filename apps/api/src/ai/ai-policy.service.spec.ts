import { Test, TestingModule } from "@nestjs/testing";
import { AiPolicyService } from "./ai-policy.service";

describe("AiPolicyService", () => {
  let service: AiPolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiPolicyService]
    }).compile();

    service = module.get(AiPolicyService);
  });

  it("allows reply when no blocked topics configured", () => {
    expect(service.checkReply("สวัสดีครับ", [])).toEqual({
      allowed: true,
      matchedTopics: []
    });
  });

  it("blocks reply when topic substring matches case-insensitively", () => {
    const result = service.checkReply("ราคาสินค้า 500 บาท", ["ราคา", "discount"]);
    expect(result.allowed).toBe(false);
    expect(result.matchedTopics).toEqual(["ราคา"]);
  });

  it("allows reply when no topic matches", () => {
    const result = service.checkReply("ขอบคุณครับ", ["ราคา", "discount"]);
    expect(result.allowed).toBe(true);
    expect(result.matchedTopics).toEqual([]);
  });

  it("trims whitespace in topics before matching", () => {
    const result = service.checkReply("hello world", ["  HELLO ", "discount"]);
    expect(result.allowed).toBe(false);
    expect(result.matchedTopics).toEqual(["HELLO"]);
  });
});
