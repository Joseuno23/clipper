import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type RowActionsProps = {
  onEdit: () => void;
  onDelete: () => void;
};

export function RowActions({ onEdit, onDelete }: RowActionsProps) {
  return (
    <div
      className="flex justify-end gap-2"
      onClick={(event) => event.stopPropagation()}
    >
      <Button type="button" variant="outline" size="sm" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
        Editar
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
        Eliminar
      </Button>
    </div>
  );
}
