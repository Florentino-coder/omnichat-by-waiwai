import {
  formatKnowledgeContext,
  rankKnowledgeArticles,
  scoreKnowledgeArticle,
  tokenizeSearchQuery
} from "./knowledge-search.util";

describe("knowledge-search.util", () => {
  it("tokenizes Thai and English query text", () => {
    expect(tokenizeSearchQuery("ส่งของกี่วัน delivery")).toEqual([
      "ส่งของกี่วัน",
      "delivery"
    ]);
  });

  it("scores article higher when keyword and title match", () => {
    const score = scoreKnowledgeArticle(
      {
        title: "นโยบายจัดส่ง",
        content: "จัดส่งภายใน 3-5 วันทำการ",
        keywords: ["delivery", "shipping"]
      },
      tokenizeSearchQuery("delivery กี่วัน")
    );

    expect(score).toBeGreaterThan(0);
  });

  it("ranks relevant articles and formats context block", () => {
    const articles = [
      {
        title: "ราคาสินค้า",
        content: "ราคาเริ่มต้น 990 บาท",
        keywords: ["price"],
        category: "Pricing"
      },
      {
        title: "การจัดส่ง",
        content: "จัดส่งฟรีเมื่อซื้อครบ 1,000 บาท",
        keywords: ["delivery", "shipping"],
        category: "Shipping"
      }
    ];

    const ranked = rankKnowledgeArticles(articles, "ส่งของฟรีไหม delivery");
    expect(ranked[0]?.title).toBe("การจัดส่ง");

    const context = formatKnowledgeContext(ranked);
    expect(context).toContain("[Shipping] การจัดส่ง");
    expect(context).toContain("จัดส่งฟรีเมื่อซื้อครบ 1,000 บาท");
  });
});
