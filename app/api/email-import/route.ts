import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { requireValidCompanyId } from "@/lib/security";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Transaction } from "@/lib/types";

export const runtime = "nodejs";

type GmailMessageRef = {
  id: string;
};

type GmailHeader = {
  name: string;
  value: string;
};

type GmailPart = {
  mimeType?: string;
  body?: {
    data?: string;
  };
  parts?: GmailPart[];
};

type GmailMessage = {
  id: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart & {
    headers?: GmailHeader[];
  };
};

type GmailListResponse = {
  messages?: GmailMessageRef[];
  nextPageToken?: string;
};

const GMAIL_PAGE_SIZE = 500;
const MAX_GMAIL_UNIQUE_MESSAGES = 5000;
const MAX_GMAIL_MESSAGES_PER_QUERY = 2500;
const gmailQueries = [
  'newer_than:2y ("Amount Credited" OR "Amount Debited" OR "Transaction Info" OR "Date & Time")',
  'newer_than:2y ("has been credited" OR "has been debited" OR "amount credited" OR "amount debited")',
  "newer_than:2y (credited OR debited) (UPI OR INR OR Rs)",
  "newer_than:2y (paid OR spent OR withdrawn OR transferred) (UPI OR INR OR Rs)",
  "newer_than:2y (P2A OR P2M OR IMPS OR NEFT OR RTGS)",
];

const categoryRules = [
  {
    title: "🍔 Food",
    pattern:
      /\b(food|swiggy|zomato|restaurant|cafe|hotel|bakery|pizza|burger|dominos|mcdonald|kfc|tea|coffee|meal|dining)\b/i,
  },
  {
    title: "⛽ Petrol",
    pattern:
      /\b(petrol|diesel|fuel|hpcl|bpcl|iocl|indian oil|bharat petroleum|hindustan petroleum|petrol pump)\b/i,
  },
  {
    title: "🏫 School",
    pattern:
      /\b(school|college|tuition|university|education|fee|fees|academy|institute)\b/i,
  },
  {
    title: "⚡ Electricity",
    pattern:
      /\b(electricity|electric|power bill|kseb|bescom|tangedco|mseb|torrent power|adani electricity|bills? desk)\b/i,
  },
  {
    title: "🔥 LPG",
    pattern:
      /\b(lpg|gas cylinder|indane|bharat gas|hp gas|cooking gas)\b/i,
  },
  {
    title: "💧 Water Bill",
    pattern: /\b(water bill|water board|jal board|kwa|bwssb|metro water)\b/i,
  },
  {
    title: "🏠 Rent",
    pattern: /\b(rent|landlord|lease|house rent|room rent)\b/i,
  },
];

const decodeBody = (value = "") =>
  Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8"
  );

const stripHtml = (value: string) =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const collectTextParts = (part?: GmailPart): string[] => {
  if (!part) {
    return [];
  }

  const bodyText = part.body?.data ? decodeBody(part.body.data) : "";
  const current =
    part.mimeType === "text/html" ? stripHtml(bodyText) : bodyText.trim();

  return [
    ...(current ? [current] : []),
    ...(part.parts || []).flatMap((child) => collectTextParts(child)),
  ];
};

const getHeader = (message: GmailMessage, name: string) =>
  message.payload?.headers?.find(
    (header) => header.name.toLowerCase() === name.toLowerCase()
  )?.value || "";

const parseSummaryAmountAndType = (text: string) => {
  const match = text.match(
    /\bamount\s+(credited|debited)\s*:\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i
  );

  if (!match) {
    return null;
  }

  const amount = Number(match[2].replace(/,/g, ""));

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return {
    amount,
    type: (match[1].toLowerCase() === "credited"
      ? "Income"
      : "Expense") as Transaction["type"],
  };
};

const parseAmount = (text: string) => {
  const summary = parseSummaryAmountAndType(text);

  if (summary) {
    return summary.amount;
  }

  const patterns = [
    /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
    /([0-9][0-9,]*(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      const amount = Number(match[1].replace(/,/g, ""));

      if (Number.isFinite(amount) && amount > 0) {
        return amount;
      }
    }
  }

  return null;
};

const cleanLabel = (value = "") =>
  value
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b(ref|reference|txn|transaction|upi|vpa|id|no|number)\b.*$/i, "")
    .replace(/[^a-zA-Z0-9 .&'_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

const cleanCounterparty = (value = "") => {
  const label = cleanLabel(
    value.replace(
      /\b(?:t\s*&?\s*c|terms|conditions|apply|date\s*&\s*time|account|transaction|info|dear|regards|available|balance)\b.*$/i,
      ""
    )
  );

  if (
    !label ||
    /\b(your|account|acct|a\/c|card|bank|has been|available|balance)\b/i.test(
      label
    )
  ) {
    return "";
  }

  return label;
};

const extractUpiTransactionInfo = (text: string) => {
  const normalized = text.replace(/\s+/g, " ");
  const match = normalized.match(
    /\bUPI\/([A-Z0-9]+)\/[0-9][0-9\s]{5,}\/(.{2,120})/i
  );

  if (!match) {
    return null;
  }

  const mode = match[1].toUpperCase();
  const counterparty = cleanCounterparty(match[2].split("/")[0]);
  const type: Transaction["type"] | null =
    mode === "P2A" ? "Income" : mode === "P2M" ? "Expense" : null;

  return {
    mode,
    counterparty,
    type,
  };
};

const extractUpiTransactionInfoCounterparty = (text: string) => {
  const info = extractUpiTransactionInfo(text);

  return info?.counterparty || "";
};

const pad2 = (value: string | number) => String(value).padStart(2, "0");

const localDateValue = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;

const localTimeValue = (date = new Date()) =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const normalizeYear = (value: string) => {
  if (value.length === 2) {
    return `20${value}`;
  }

  return value;
};

const parseSummaryDateTime = (
  text: string,
  fallback: { date: string; time: string }
) => {
  const match = text.match(
    /\bdate\s*&\s*time\s*:\s*(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\s*,?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/i
  );

  if (!match) {
    return fallback;
  }

  const [, day, month, year, hour, minute, second] = match;

  return {
    date: `${normalizeYear(year)}-${pad2(month)}-${pad2(day)}`,
    time: second
      ? `${pad2(hour)}:${minute}:${second}`
      : `${pad2(hour)}:${minute}`,
  };
};

const classifyTransaction = (text: string): Transaction["type"] | null => {
  const summary = parseSummaryAmountAndType(text);

  if (summary) {
    return summary.type;
  }

  const upiInfo = extractUpiTransactionInfo(text);

  if (upiInfo?.type) {
    return upiInfo.type;
  }

  const lower = text.toLowerCase();
  const isDebit = /\b(debited|debit|spent|paid|purchase|withdrawn)\b/.test(lower);
  const isCredit = /\b(credited|credit|received|deposited|refund)\b/.test(lower);

  // Some bank templates show "credit"/"debit" keywords in the subject/body
  // but the amount can appear without an explicit sign. We rely on the template
  // direction keywords to classify, and keep amounts positive.
  if (isDebit) return "Expense";
  if (isCredit) return "Income";
  return null;
};

const shouldIgnoreMessage = (text: string) => {
  const hasRealTransaction = isActualMoneyMovement(text) || hasBankSummaryFields(text);
  const failedTransactionPatterns = [
    /\b(mandate|e-mandate|autopay|collect request|request money)\b/i,
    /\b(failed|declined|unsuccessful|pending|processing|cancelled|reversal|chargeback)\b/i,
  ];

  if (failedTransactionPatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  if (hasRealTransaction) {
    return false;
  }

  const junkPatterns = [
    /\b(otp|one time password|verification code)\b/i,
    /\b(dispute|complaint|query|support|help|contact)\b/i,
    /\b(blocked|frozen|locked|temporary|unauthorized|fraud|security)\b/i,
    /\b(login alert|security alert|profile update|settings update|change password|verify your|authentication)\b/i,
    /\b(error|issue|problem|trouble|difficulty|unable|cannot|not able|failed to|error in|issue with|problem with|trouble with)\b/i,
    /\b(redeem|redemption|coupon|voucher|reward|rewards|cashback|promo code|offer|gift card)\b/i,
    /\b(statement|bill generated|payment reminder|due date|available limit)\b/i,
    /\b(login|sign in|profile|settings|preferences)\b/i,
    /\b(subscription|plan|billing|invoice|receipt|summary|report|analysis|dashboard|overview)\b/i,
    /\b(balance|available|current|minimum|maximum|threshold|limit|exceeded|insufficient)\b/i,
  ];

  return junkPatterns.some((pattern) => pattern.test(text));
};

const isOfferOrPromotional = (text: string) => {
  const offerPatterns = [
    /\b(offer|offers|promotion|promotional|campaign|deal|deals|discount|discounted|benefits)\b/i,
    /\b(free|bonus|bonus points|points earned|earned points|lucky draw|winner|congratulations|won|prize|gift|surprise|special|exclusive|win|chance to|avail)\b/i,
    /\b(limited time|time limited|expires|expiry|valid till|valid until|claim|claimed|redeemable)\b/i,
    /\b(scratch card|spin|wheel|game|play|earn|earning|reward points|loyalty points)\b/i,
    /\b(cashback offer|reward offer|promo offer|special offer|seasonal offer|festive offer)\b/i,
    /\b(new user|welcome bonus|referral bonus|signup bonus|registration bonus)\b/i,
  ];

  return offerPatterns.some(pattern => pattern.test(text));
};

const isActualMoneyMovement = (text: string) => {
  const hasAmount = /(?:₹|rs\.?|inr)\s*[0-9]|[0-9][0-9,.]*\s*(?:₹|rs\.?|inr)/i.test(
    text
  );
  const hasMovement =
    /\b(has been debited|has been credited|amount debited|amount credited|debited from|credited to|debited|credited|received from|paid to|sent to|transferred to|spent at|purchase at|withdrawn from|transaction successful|payment successful|transfer successful|withdrawal successful|purchase successful)\b/i.test(
      text
    );
  const hasAccountContext = /\b(account|card|upi|vpa|a\/c|acct|bank|wallet)\b/i.test(
    text
  );

  return hasAmount && hasMovement && hasAccountContext;
};

const hasBankSummaryFields = (text: string) =>
  /\b(amount credited|amount debited)\b/i.test(text) &&
  /\b(date\s*&\s*time|transaction info)\b/i.test(text);

const detectCategory = (text: string, type: Transaction["type"]) => {
  if (type === "Income") {
    return "👤 Person";
  }

  const matchedRule = categoryRules.find((rule) => rule.pattern.test(text));

  if (matchedRule) {
    return matchedRule.title;
  }

  if (
    /\b(person|friend|family|paid to|sent to|transferred to|payment to|to vpa|to upi)\b/i.test(
      text
    )
  ) {
    return "👤 Person";
  }

  return "❔ Other";
};

const extractCounterparty = (text: string, type: Transaction["type"]) => {
  const upiCounterparty = extractUpiTransactionInfoCounterparty(text);

  if (upiCounterparty) {
    return upiCounterparty;
  }

  const patterns =
    type === "Income"
      ? [
          /\b(?:received from|credited from|from payer|from remitter|from)\s+([a-zA-Z0-9 .&'_-]{3,80})/i,
        ]
      : [
          /\b(?:to vpa|to upi|to)\s+([a-zA-Z0-9._-]{2,}@[a-zA-Z0-9._-]{2,})/i,
          /\b(?:paid to|sent to|transferred to|payment to|to merchant)\s+([a-zA-Z0-9 .&'_-]{3,80})/i,
          /\b(?:purchase at|spent at|paid at|at)\s+([a-zA-Z0-9 .&'_-]{3,80})/i,
          /\b(?:paid for|spent on|debited for|debited towards)\s+([a-zA-Z0-9 .&'_-]{3,80})/i,
        ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const label = cleanCounterparty(match?.[1]);

    if (label) {
      return label;
    }
  }

  return "";
};

const detectMethod = (text: string) => {
  const lower = text.toLowerCase();

  if (lower.includes("upi")) {
    return "UPI";
  }

  return "Card";
};

const detectCardSource = (text: string) => {
  const bankMatch = text.match(
    /\b(SBI|HDFC|ICICI|Axis|Kotak|Canara|Federal|IDFC|IndusInd|PNB|Punjab National|Bank of Baroda|Indian Bank|Union Bank)\b/i
  );
  const maskMatch = text.match(
    /\b(?:card|credit card|debit card|a\/c|account|acct|ending|x{2,})\D*([xX*0-9]{4,20})\b/i
  );
  const bank = bankMatch?.[1]?.toUpperCase();
  const mask = maskMatch?.[1]?.replace(/\*/g, "x");

  if (bank && mask) {
    return `${bank} ${mask}`;
  }

  if (mask) {
    return `Card ${mask}`;
  }

  return bank || "Card";
};

const resolveMovement = (
  type: Transaction["type"],
  account: string,
  counterparty: string
) => {
  const safeAccount = cleanLabel(account) || "Account";
  const safeCounterparty =
    cleanCounterparty(counterparty) || (type === "Income" ? "Sender" : "Merchant");

  return type === "Income"
    ? { fromAccount: safeCounterparty, toAccount: safeAccount }
    : { fromAccount: safeAccount, toAccount: safeCounterparty };
};

const titleFromMessage = (
  message: GmailMessage,
  text: string,
  type: Transaction["type"],
  method: Transaction["method"]
) => {
  const category = detectCategory(text, type);
  const counterparty = extractCounterparty(text, type);
  const subject = getHeader(message, "subject")
    .replace(/^(alert|notification|transaction alert)\s*[:-]\s*/i, "")
    .trim();
  const fallback = cleanLabel(subject) || "Email transaction";

  if (method === "UPI") {
    const label = type === "Income" ? "UPI Payment In" : "UPI Payment Out";

    return counterparty ? `${label} - ${counterparty}` : label;
  }

  if (category === "👤 Person") {
    return counterparty ? `Person - ${counterparty}` : "Person";
  }

  if (category === "❔ Other") {
    return fallback;
  }

  return counterparty ? `${category} - ${counterparty}` : category;
};

const toTransaction = (message: GmailMessage): Transaction | null => {
  const subject = getHeader(message, "subject");
  const body = collectTextParts(message.payload).join(" ");
  const text = [subject, message.snippet, body].filter(Boolean).join(" ");
  const summary = parseSummaryAmountAndType(text);
  const amount = summary?.amount || parseAmount(text);
  const type = summary?.type || classifyTransaction(text);
  const actualMoneyMovement = isActualMoneyMovement(text) || hasBankSummaryFields(text);

  if (
    !amount ||
    !type ||
    !actualMoneyMovement ||
    shouldIgnoreMessage(text) ||
    (isOfferOrPromotional(text) && !hasBankSummaryFields(text))
  ) {
    return null;
  }

  const dateObject = message.internalDate
    ? new Date(Number(message.internalDate))
    : new Date();
  const fallbackDateTime = {
    date: localDateValue(dateObject),
    time: localTimeValue(dateObject),
  };
  const { date, time } = parseSummaryDateTime(text, fallbackDateTime);
  const method = detectMethod(text);
  const category = detectCategory(text, type);
  const counterparty = extractCounterparty(text, type);
  const selectedCard =
    method === "Card" ? detectCardSource(text) : "";
  const movement = resolveMovement(
    type,
    method === "UPI" ? "You" : selectedCard,
    counterparty
  );
  const person = category === "👤 Person" ? counterparty : "";

  return {
    id: `email-${message.id}`,
    sourceId: `gmail:${message.id}`,
    title: titleFromMessage(message, text, type, method),
    amount,
    type,
    method,
    section: "Account",
    selectedCard,
    category,
    person,
    ...movement,
    date,
    time,
  };
};

const gmailFetch = async (url: string, accessToken: string) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    return { response, error };
  }

  return { response, data: await response.json() };
};

const listGmailMessages = async (accessToken: string) => {
  const messagesById = new Map<string, GmailMessageRef>();

  for (const query of gmailQueries) {
    let pageToken = "";
    let queryCount = 0;

    while (
      queryCount < MAX_GMAIL_MESSAGES_PER_QUERY &&
      messagesById.size < MAX_GMAIL_UNIQUE_MESSAGES
    ) {
      const searchParams = new URLSearchParams({
        maxResults: String(
          Math.min(
            GMAIL_PAGE_SIZE,
            MAX_GMAIL_MESSAGES_PER_QUERY - queryCount,
            MAX_GMAIL_UNIQUE_MESSAGES - messagesById.size
          )
        ),
        q: query,
      });

      if (pageToken) {
        searchParams.set("pageToken", pageToken);
      }

      const listResult = await gmailFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${searchParams}`,
        accessToken
      );

      if (!listResult.response.ok) {
        return listResult;
      }

      const payload = listResult.data as GmailListResponse;
      const pageMessages = payload.messages || [];

      pageMessages.forEach((message) => {
        messagesById.set(message.id, message);
      });

      queryCount += pageMessages.length;

      if (!payload.nextPageToken || pageMessages.length === 0) {
        break;
      }

      pageToken = payload.nextPageToken;
    }

    if (messagesById.size >= MAX_GMAIL_UNIQUE_MESSAGES) {
      break;
    }
  }

  return {
    response: new Response(null, { status: 200 }),
    data: { messages: Array.from(messagesById.values()) },
  };
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!session.accessToken || session.accessTokenError) {
    return NextResponse.json(
      {
        error:
          "Gmail access is not connected yet. Open Settings, tap Connect Gmail Access, then try import again.",
      },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const companyIdParam = searchParams.get("companyId");
  const companyId = companyIdParam ? requireValidCompanyId(companyIdParam) : "";

  if (companyId === "demo-company") {
    return NextResponse.json({ error: "Email import is disabled for demo company" }, { status: 403 });
  }

  if (companyId) {
    await requirePermission({ companyId, action: "transactions:write" });
  }

  const accessToken = session.accessToken;
  const listResult = await listGmailMessages(accessToken);

  if (!listResult.response.ok) {
    const googleMessage =
      listResult.error?.error?.message || listResult.error?.error_description;
    const blockedByGoogle = listResult.response.status === 403;

    return NextResponse.json(
      {
        error:
          blockedByGoogle
            ? "Google blocked Gmail import permission. Add this email as an OAuth test user in Google Cloud, then connect Gmail again."
            : googleMessage ||
          "Gmail could not be read. Reconnect Google and try again.",
      },
      { status: listResult.response.status }
    );
  }

  const messages = (listResult.data.messages || []) as GmailMessageRef[];

  const imported: Transaction[] = [];

  for (let index = 0; index < messages.length; index += 25) {
    const batch = messages.slice(index, index + 25);
    const transactions = await Promise.all(
      batch.map(async (message) => {
        const detailParams = new URLSearchParams({
          format: "full",
        });
        const detailResult = await gmailFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?${detailParams}`,
          accessToken
        );

        if (!detailResult.response.ok) {
          return null;
        }

        return toTransaction(detailResult.data as GmailMessage);
      })
    );

    imported.push(
      ...(transactions.filter(Boolean) as Transaction[])
    );
  }

  return NextResponse.json({
    scanned: messages.length,
    matched: imported.length,
    searches: gmailQueries.length,
    companyId: companyId || null,
    transactions: companyId ? imported.map((tx) => ({ ...tx, companyId })) : imported,
  });
}
