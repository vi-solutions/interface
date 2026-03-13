"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function useRequireAuth() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  return { user, token, loading, authenticated: !loading && !!token };
}
