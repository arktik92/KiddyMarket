// Central API client + react-query hooks for KiddyMarket.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export type Child = {
  id: string;
  name: string;
  avatar_icon: string;
  color: string;
  nfc_uid: string | null;
  balance_cents: number;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  price_cents: number;
  icon: string;
  color: string;
  category: string;
  created_at: string;
};

export type PurchaseItem = {
  product_id: string;
  name: string;
  price_cents: number;
  icon: string;
  color: string;
  qty: number;
};

export type Transaction = {
  id: string;
  child_id: string;
  type: "credit" | "debit_manuel" | "achat";
  amount_cents: number;
  reason: string | null;
  items: PurchaseItem[];
  balance_after_cents: number;
  created_at: string;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = "Une erreur est survenue";
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {}
    const err = new Error(detail) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

// ------- Children -------
export function useChildren() {
  return useQuery({
    queryKey: ["children"],
    queryFn: () => request<Child[]>("/children"),
  });
}

export function useCreateChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; avatar_icon: string; color: string }) =>
      request<Child>("/children", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["children"] }),
  });
}

export function useUpdateChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; avatar_icon?: string; color?: string }) =>
      request<Child>(`/children/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["children"] }),
  });
}

export function useDeleteChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<{ ok: boolean }>(`/children/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["children"] }),
  });
}

export function useAssociateNfc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nfc_uid }: { id: string; nfc_uid: string }) =>
      request<Child>(`/children/${id}/nfc`, { method: "POST", body: JSON.stringify({ nfc_uid }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["children"] }),
  });
}

export function childByNfc(uid: string) {
  return request<Child>(`/children/by-nfc/${encodeURIComponent(uid)}`);
}

// ------- Products -------
export function useProducts(category?: string) {
  return useQuery({
    queryKey: ["products", category ?? "Tout"],
    queryFn: () => request<Product[]>(`/products${category && category !== "Tout" ? `?category=${encodeURIComponent(category)}` : ""}`),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<Product, "id" | "created_at">) =>
      request<Product>("/products", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Product> & { id: string }) =>
      request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<{ ok: boolean }>(`/products/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

// ------- Transactions / money -------
export function useChildTransactions(childId: string | undefined) {
  return useQuery({
    queryKey: ["transactions", childId],
    queryFn: () => request<Transaction[]>(`/children/${childId}/transactions`),
    enabled: !!childId,
  });
}

export function useAllTransactions(childId?: string) {
  return useQuery({
    queryKey: ["transactions", "all", childId ?? "global"],
    queryFn: () => request<Transaction[]>(`/transactions${childId ? `?child_id=${childId}` : ""}`),
  });
}

type MoneyResult = { transaction: Transaction; balance_cents: number };

export function useCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { child_id: string; amount_cents: number; reason?: string }) =>
      request<MoneyResult>("/transactions/credit", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["children"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useDebit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { child_id: string; amount_cents: number; reason?: string }) =>
      request<MoneyResult>("/transactions/debit", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["children"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function usePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { child_id: string; items: PurchaseItem[] }) =>
      request<MoneyResult & { total_cents: number }>("/transactions/purchase", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["children"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

// ------- Parent PIN -------
export function verifyPin(pin: string) {
  return request<{ ok: boolean }>("/parent/verify-pin", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}

export function changePin(current_pin: string, new_pin: string) {
  return request<{ ok: boolean }>("/parent/pin", {
    method: "PUT",
    body: JSON.stringify({ current_pin, new_pin }),
  });
}
