const legalDefaults = {
  operatorName: "4U staff",
  address: "神奈川県藤沢市辻堂元町",
  phone: "2137135957",
  email: "kenmariei@icloud.com",
} as const;

export const siteConfig = {
  serviceName: process.env.NEXT_PUBLIC_SERVICE_NAME || "POSH JAPAN",
  legal: {
    operatorName:
      process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME || legalDefaults.operatorName,
    address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || legalDefaults.address,
    phone: process.env.NEXT_PUBLIC_LEGAL_PHONE || legalDefaults.phone,
    email: process.env.NEXT_PUBLIC_LEGAL_EMAIL || legalDefaults.email,
  },
} as const;

export function hasPlaceholderLegalInfo() {
  const values = Object.values(siteConfig.legal);
  return values.some(
    (value) =>
      value.includes("入力してください") ||
      value.includes("your-domain.jp"),
  );
}
