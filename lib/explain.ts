import type { Explanation, NewsItem } from "./types";

/**
 * Heuristic, plain-English explanation of why a stock is likely moving:
 * classify recent headlines into catalyst categories and combine the best
 * match with the day's price action. No LLM required — transparent and free.
 */

interface Category {
  id: string;
  label: string;
  pattern: RegExp;
  phrase: string;
}

// Ordered by how decisively each catalyst tends to move a stock.
const CATEGORIES: Category[] = [
  {
    id: "earnings",
    label: "Earnings",
    pattern:
      /\b(earnings|eps|revenue|quarterly results|q[1-4] (results|earnings)|beat[s]?|miss(es|ed)?|guidance|outlook|forecast|profit)\b/i,
    phrase: "an earnings-related catalyst",
  },
  {
    id: "mna",
    label: "M&A / Deals",
    pattern:
      /\b(acquisition|acquire[sd]?|merger|takeover|buyout|bid for|stake in|deal to buy|go(es|ing) private)\b/i,
    phrase: "merger or acquisition news",
  },
  {
    id: "analyst",
    label: "Analyst Action",
    pattern:
      /\b(upgrade[sd]?|downgrade[sd]?|price target|analyst|overweight|underweight|initiat(es|ed) coverage|reiterat(es|ed)|(buy|sell|hold) rating)\b/i,
    phrase: "an analyst upgrade, downgrade, or price-target change",
  },
  {
    id: "regulatory",
    label: "Regulatory / Legal",
    pattern:
      /\b(fda|approval|regulator[sy]?|antitrust|lawsuit|settlement|probe|investigation|fine[sd]?|recall|tariff[s]?|sanction[s]?)\b/i,
    phrase: "regulatory or legal news",
  },
  {
    id: "leadership",
    label: "Leadership / Restructuring",
    pattern:
      /\b(ceo|cfo|chief executive|resign[s]?|steps? down|appoint(s|ed)?|layoff[s]?|job cuts|restructur(e|ing))\b/i,
    phrase: "leadership or restructuring news",
  },
  {
    id: "product",
    label: "Product / Contracts",
    pattern:
      /\b(launch(es|ed)?|unveil(s|ed)?|new product|partnership|contract (win|worth|award)|wins? (a )?(major )?(contract|order)|deal with)\b/i,
    phrase: "product or contract news",
  },
  {
    id: "capital",
    label: "Capital Returns",
    pattern:
      /\b(dividend|buyback|share repurchase|stock split|offering|convertible|debt raise)\b/i,
    phrase: "dividend, buyback, or share-structure news",
  },
];

function directionPhrase(changePercent: number): string {
  const abs = Math.abs(changePercent);
  const dir = changePercent >= 0 ? "up" : "down";
  if (abs >= 5) return `${dir} sharply`;
  if (abs >= 2) return `${dir} solidly`;
  return `${dir} modestly`;
}

export function explainMove(
  symbol: string,
  changePercent: number,
  news: NewsItem[],
): Explanation {
  const sign = changePercent >= 0 ? "+" : "";
  const move = `${symbol} is ${directionPhrase(changePercent)} today (${sign}${changePercent.toFixed(2)}%).`;

  for (const category of CATEGORIES) {
    const hit = news.find(
      (n) =>
        category.pattern.test(n.title) ||
        (n.summary ? category.pattern.test(n.summary) : false),
    );
    if (hit) {
      return {
        category: category.label,
        text: `${move} Recent headlines point to ${category.phrase}: “${hit.title}”`,
      };
    }
  }

  if (news.length > 0) {
    return {
      category: "General",
      text: `${move} No single catalyst stands out in recent headlines — the move may reflect broader market or sector conditions. Latest: “${news[0].title}”`,
    };
  }

  return {
    category: "General",
    text: `${move} No recent headlines found for this ticker — the move likely reflects broader market or sector conditions.`,
  };
}

function pastDirectionPhrase(changePercent: number): string {
  const abs = Math.abs(changePercent);
  const dir = changePercent >= 0 ? "rose" : "fell";
  if (abs >= 5) return `${dir} sharply`;
  if (abs >= 2) return `${dir} solidly`;
  return `${dir} modestly`;
}

/**
 * Retroactive version for "Explain the Jump": same headline classifier,
 * past tense, with an S&P 500 comparison so that when no headline explains
 * the move we can honestly attribute it to the broader market — or admit
 * we don't know — instead of inventing a cause.
 */
export function explainJump(
  symbol: string,
  dateLabel: string,
  changePercent: number,
  marketChangePercent: number | null,
  news: NewsItem[],
): Explanation {
  const sign = changePercent >= 0 ? "+" : "";
  const move = `On ${dateLabel}, ${symbol} ${pastDirectionPhrase(changePercent)} (${sign}${changePercent.toFixed(2)}%).`;

  for (const category of CATEGORIES) {
    const hit = news.find(
      (n) =>
        category.pattern.test(n.title) ||
        (n.summary ? category.pattern.test(n.summary) : false),
    );
    if (hit) {
      return {
        category: category.label,
        text: `${move} Headlines from around that day point to ${category.phrase}: “${hit.title}”`,
      };
    }
  }

  const marketDriven =
    marketChangePercent != null &&
    Math.sign(marketChangePercent) === Math.sign(changePercent) &&
    Math.abs(marketChangePercent) >= 1 &&
    Math.abs(marketChangePercent) >= Math.abs(changePercent) * 0.4;

  if (marketDriven) {
    const mSign = (marketChangePercent as number) >= 0 ? "+" : "";
    return {
      category: "Market-wide",
      text: `${move} The S&P 500 moved ${mSign}${(marketChangePercent as number).toFixed(2)}% the same day, so this looks like a broad market move rather than company-specific news.`,
    };
  }

  if (news.length > 0) {
    return {
      category: "General",
      text: `${move} None of the headlines from that period point to a clear catalyst — this may have been a broader market or sector move, or low-volume volatility. Closest headline: “${news[0].title}”`,
    };
  }

  return {
    category: "General",
    text: `${move} No major news found from that period — this may have been a broader market move or low-volume volatility.`,
  };
}
