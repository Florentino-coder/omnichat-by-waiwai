import { LLMClient } from "../../src/common/llm/llm.interface";

export function createMockLlmClient(
  generateReply: jest.Mock<Promise<string>, [Parameters<LLMClient["generateReply"]>[0]]> = jest
    .fn()
    .mockResolvedValue("สวัสดีค่ะ ยินดีให้บริการนะคะ")
): LLMClient {
  return { generateReply };
}
