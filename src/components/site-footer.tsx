import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-gray-200 px-6 py-8 text-sm text-gray-600">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>© {siteConfig.serviceName}</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/terms" className="hover:text-gray-900">
            利用規約
          </Link>
          <Link href="/privacy" className="hover:text-gray-900">
            プライバシーポリシー
          </Link>
          <Link href="/commerce" className="hover:text-gray-900">
            特商法表記
          </Link>
        </div>
      </div>
    </footer>
  );
}
