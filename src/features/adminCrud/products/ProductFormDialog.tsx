import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProductCreateInput, ProductDto } from "@/shared/api/adminCrud";

import { productStock } from "./columns";

type ProductFormValues = {
  name: string;
  sku: string;
  barcode: string;
  description: string;
  catalogPrice: string;
  cost: string;
  stock: string;
  lowStockAt: string;
  isActive: boolean;
};

type ProductFormDialogProps = {
  open: boolean;
  product?: ProductDto | null;
  error?: string | null;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProductCreateInput) => void;
};

const emptyValues: ProductFormValues = {
  name: "",
  sku: "",
  barcode: "",
  description: "",
  catalogPrice: "",
  cost: "",
  stock: "0",
  lowStockAt: "",
  isActive: true,
};

export function ProductFormDialog({
  open,
  product,
  error,
  isSubmitting = false,
  onOpenChange,
  onSubmit,
}: ProductFormDialogProps) {
  const [values, setValues] = useState<ProductFormValues>(emptyValues);
  const [localError, setLocalError] = useState<string | null>(null);
  const title = product ? "Editar producto" : "Nuevo producto";

  useEffect(() => {
    if (!open) return;

    setValues(
      product
        ? {
            name: product.name,
            sku: product.sku ?? "",
            barcode: product.barcode ?? "",
            description: product.description ?? "",
            catalogPrice: product.catalogPrice,
            cost: product.cost ?? "",
            stock: String(productStock(product)),
            lowStockAt:
              product.lowStockAt === null ? "" : String(product.lowStockAt),
            isActive: product.isActive,
          }
        : emptyValues,
    );
    setLocalError(null);
  }, [open, product]);

  const displayError = useMemo(() => localError ?? error, [error, localError]);

  function updateValue<K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = values.name.trim();
    const catalogPrice = Number(values.catalogPrice);
    const cost = values.cost.trim() === "" ? null : Number(values.cost);
    const stock = Number(values.stock);
    const lowStockAt =
      values.lowStockAt.trim() === "" ? null : Number(values.lowStockAt);

    if (!name) {
      setLocalError("El nombre del producto es obligatorio.");
      return;
    }

    if (!Number.isFinite(catalogPrice) || catalogPrice < 0) {
      setLocalError("El precio debe ser un número mayor o igual a cero.");
      return;
    }

    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      setLocalError("El costo debe ser un número mayor o igual a cero.");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setLocalError("El stock debe ser un número entero mayor o igual a cero.");
      return;
    }

    if (
      lowStockAt !== null &&
      (!Number.isInteger(lowStockAt) || lowStockAt < 0)
    ) {
      setLocalError("El stock mínimo debe ser un entero mayor o igual a cero.");
      return;
    }

    setLocalError(null);
    onSubmit({
      name,
      sku: nullable(values.sku),
      barcode: nullable(values.barcode),
      description: nullable(values.description),
      catalogPrice: values.catalogPrice.trim(),
      cost: values.cost.trim() === "" ? null : values.cost.trim(),
      stock,
      lowStockAt,
      isActive: values.isActive,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Editá datos de catálogo y stock. Categoría queda fuera de
              persistencia porque el API actual no la guarda como dato real.
            </DialogDescription>
          </DialogHeader>

          {displayError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {displayError}
            </p>
          )}

          <Field label="Nombre" htmlFor="productName">
            <Input
              id="productName"
              value={values.name}
              onChange={(event) => updateValue("name", event.target.value)}
              disabled={isSubmitting}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="SKU" htmlFor="productSku">
              <Input
                id="productSku"
                value={values.sku}
                onChange={(event) => updateValue("sku", event.target.value)}
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Código de barras" htmlFor="productBarcode">
              <Input
                id="productBarcode"
                value={values.barcode}
                onChange={(event) => updateValue("barcode", event.target.value)}
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <Field label="Descripción" htmlFor="productDescription">
            <Textarea
              id="productDescription"
              value={values.description}
              onChange={(event) =>
                updateValue("description", event.target.value)
              }
              disabled={isSubmitting}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Precio de catálogo" htmlFor="catalogPrice">
              <Input
                id="catalogPrice"
                inputMode="decimal"
                value={values.catalogPrice}
                onChange={(event) =>
                  updateValue("catalogPrice", event.target.value)
                }
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Costo" htmlFor="productCost">
              <Input
                id="productCost"
                inputMode="decimal"
                value={values.cost}
                onChange={(event) => updateValue("cost", event.target.value)}
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Stock" htmlFor="productStock">
              <Input
                id="productStock"
                inputMode="numeric"
                value={values.stock}
                onChange={(event) => updateValue("stock", event.target.value)}
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Stock mínimo" htmlFor="lowStockAt">
              <Input
                id="lowStockAt"
                inputMode="numeric"
                value={values.lowStockAt}
                onChange={(event) =>
                  updateValue("lowStockAt", event.target.value)
                }
                disabled={isSubmitting}
              />
            </Field>
          </div>

          {product?.category && (
            <p className="text-xs text-muted-foreground">
              Categoría actual: {product.category}. Se muestra solo como dato de
              lectura y no se envía en altas o ediciones.
            </p>
          )}

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={values.isActive}
              onCheckedChange={(checked) =>
                updateValue("isActive", checked === true)
              }
              disabled={isSubmitting}
            />
            Producto activo
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
