import { Translator } from "../types.js";

const glossary: Record<string, string> = {
  "Open-source AI agents": "开源 AI 智能体",
  "Developers are sharing new agent frameworks and benchmark results.": "开发者正在分享新的智能体框架和基准测试结果。",
  "GPU prices": "GPU 价格",
  "People are debating whether demand for AI hardware will keep rising.": "大家在讨论 AI 硬件需求是否会继续上升。",
  "Indie hacker launch": "独立开发者产品发布",
  "A solo founder product launch is spreading fast across X.": "一位独立创始人的产品发布正在 X 上迅速传播。"
};

export class MockTranslator implements Translator {
  readonly name = "mock-zh";

  async translate(text: string): Promise<string> {
    return glossary[text] ?? `[ZH] ${text}`;
  }
}
