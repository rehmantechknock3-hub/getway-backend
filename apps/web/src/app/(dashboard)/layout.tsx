import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

const NAV = [
  { href: "/bookings",  label: "Bookings"  },
  { href: "/users",     label: "Users"     },
  { href: "/providers", label: "Providers" },
  { href: "/services",  label: "Services"  },
  { href: "/payments",  label: "Payments"  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200">
          <span className="text-lg font-bold text-primary-600">Marketplace</span>
          <span className="ml-2 text-xs text-gray-400 font-medium uppercase tracking-wide">Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-gray-200">
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
