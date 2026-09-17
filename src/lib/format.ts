export function formatPrice(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

export function wordFormProducts(n: number): string {
  return n === 1 ? "product" : "products";
}
