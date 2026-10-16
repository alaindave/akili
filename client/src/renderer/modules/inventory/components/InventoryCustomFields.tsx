import { useEffect, useId, useState } from "react";
import {
  Alert,
  AlertIcon,
  Button,
  FormControl,
  FormLabel,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import type {
  InventoryCustomField,
  InventoryCustomFieldEntity,
} from "../../../../common/types/inventory/InventoryCustomField";

export function useInventoryCustomFields(companyId: string) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    companyId: string;
    revision: number;
    fields: InventoryCustomField[];
    error: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    window.electron.inventory.settings
      .getCustomFields(companyId)
      .then((fields) => {
        if (active) setResult({ companyId, revision, fields, error: "" });
      })
      .catch(() => {
        if (active)
          setResult({
            companyId,
            revision,
            fields: [],
            error: "Impossible de charger les champs personnalisés.",
          });
      });
    return () => {
      active = false;
    };
  }, [companyId, revision]);
  const current =
    result?.companyId === companyId && result.revision === revision
      ? result
      : null;
  return {
    fields: current?.fields ?? [],
    loading: !current,
    error: current?.error ?? "",
    reload: () => setRevision((value) => value + 1),
  };
}

export function CustomFieldsLoadStatus({
  state,
}: {
  state: ReturnType<typeof useInventoryCustomFields>;
}) {
  if (state.loading)
    return <Text fontSize="sm">Chargement des champs personnalisés…</Text>;
  if (state.error)
    return (
      <Alert status="error">
        <AlertIcon />
        {state.error}
        <Button ml={3} onClick={state.reload}>
          Réessayer
        </Button>
      </Alert>
    );
  return null;
}

export default function InventoryCustomFields({
  fields,
  entity,
  values,
  onChange,
  disabled,
  width,
}: {
  fields: InventoryCustomField[];
  entity: InventoryCustomFieldEntity;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  disabled?: boolean;
  width: string;
}) {
  const id = useId();
  const selected = fields.filter(
    (field) => field.entity === entity && field.isActive && !field.isDeleted
  );
  if (!selected.length) return null;
  return (
    <Stack spacing={3}>
      {selected.map((field) => (
        <FormControl key={field._id} isDisabled={disabled}>
          <FormLabel htmlFor={`${id}-${field.key}`}>{field.label}</FormLabel>
          <Input
            id={`${id}-${field.key}`}
            value={values[field.key] ?? ""}
            maxW={width}
            onChange={(event) =>
              onChange({ ...values, [field.key]: event.target.value })
            }
          />
        </FormControl>
      ))}
    </Stack>
  );
}
