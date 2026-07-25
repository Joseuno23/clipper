import { AppShell } from "@/app/layouts/AppShell";
import { ProductsCrudPage } from "@/features/adminCrud/products/ProductsPage";

export function ProductsPage() {
  return (
    <AppShell>
      <ProductsCrudPage />
    </AppShell>
  );
}
