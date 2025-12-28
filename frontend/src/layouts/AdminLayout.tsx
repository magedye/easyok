import { ReactNode } from "react";

type Props = {
  role: "admin" | "viewer";
  children: ReactNode;
};

export default function AdminLayout({ role, children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" dir="rtl">
      <header className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="text-lg font-semibold">Governance Console</div>
        <div className="flex items-center space-x-3 space-x-reverse">
          <span className="text-sm text-gray-600">All actions are audited</span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              role === "admin" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"
            }`}
          >
            {role === "admin" ? "Admin" : "Viewer"}
          </span>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
