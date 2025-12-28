import { ReactNode } from "react";
import { Navigate } from "react-router-dom";

type Props = {
  role: "admin" | "viewer" | null;
  requireAdmin?: boolean;
  children: ReactNode;
};

export default function ProtectedRoute({ role, requireAdmin = false, children }: Props) {
  if (!role) {
    return <Navigate to="/login" replace />;
  }
  if (requireAdmin && role !== "admin") {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}
