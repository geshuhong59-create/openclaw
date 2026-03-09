import { RawTrendItem, TrendsProvider } from "../types.js";

const mockItems: RawTrendItem[] = [
  {
    id: "1",
    title: "Open-source AI agents",
    description: "Developers are sharing new agent frameworks and benchmark results.",
    score: 98,
    tags: ["AI", "Open Source"],
    source: "mock-x-global",
    url: "https://example.com/trend/open-source-ai-agents",
    posts: [
      {
        author: "dev_alex",
        text: "Open-source AI agents are getting way better at tool use this week.",
        url: "https://example.com/post/1"
      },
      {
        author: "infra_lee",
        text: "The new benchmark for autonomous coding agents is surprisingly competitive.",
        url: "https://example.com/post/2"
      }
    ]
  },
  {
    id: "2",
    title: "GPU prices",
    description: "People are debating whether demand for AI hardware will keep rising.",
    score: 92,
    tags: ["Hardware", "Market"],
    source: "mock-x-global",
    url: "https://example.com/trend/gpu-prices",
    posts: [
      {
        author: "marketwatcher",
        text: "GPU prices are back in the spotlight as new AI training demand ramps up.",
        url: "https://example.com/post/3"
      }
    ]
  },
  {
    id: "3",
    title: "Indie hacker launch",
    description: "A solo founder product launch is spreading fast across X.",
    score: 87,
    tags: ["Startup", "Launch"],
    source: "mock-x-global",
    url: "https://example.com/trend/indie-hacker-launch",
    posts: [
      {
        author: "solo_builder",
        text: "I launched my product 12 hours ago and just crossed 10k users.",
        url: "https://example.com/post/4"
      }
    ]
  }
];

export class MockProvider implements TrendsProvider {
  readonly name = "mock";

  async fetchTrends(limit: number): Promise<RawTrendItem[]> {
    return mockItems.slice(0, limit);
  }
}
