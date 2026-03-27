# Show Company ID Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Company ID visible in the UI — as a copyable field in Company Settings and as a smart dropdown in plugin settings forms.

**Architecture:** Two independent UI changes: (1) add a read-only Company ID row with copy-to-clipboard in the General section of CompanySettings, (2) add a `fieldKey` prop to `FormField` in JsonSchemaForm and render a `CompanySelectField` dropdown when `fieldKey === "companyId"`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Lucide icons, Radix UI Select, `useCompany()` context

**Spec:** `docs/superpowers/specs/2026-03-27-show-company-id-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `ui/src/pages/CompanySettings.tsx` | Modify | Add Company ID read-only field with copy button |
| `ui/src/components/JsonSchemaForm.tsx` | Modify | Add `fieldKey` prop to `FormFieldProps`, add `CompanySelectField`, wire detection in `FormField` |

---

### Task 1: Company ID field in General Settings

**Files:**
- Modify: `ui/src/pages/CompanySettings.tsx:1-12` (imports), `ui/src/pages/CompanySettings.tsx:235-243` (General section)

- [ ] **Step 1: Add `Copy` icon import**

In `ui/src/pages/CompanySettings.tsx`, update the lucide import on line 11:

```tsx
import { Settings, Check, Download, Upload, Copy } from "lucide-react";
```

- [ ] **Step 2: Add copy state**

After the existing state declarations (line 40), add:

```tsx
const [idCopied, setIdCopied] = useState(false);
```

- [ ] **Step 3: Add Company ID field in General section**

In the General section's `<div className="space-y-3 rounded-md border ...">` block (after line 235, before the Company name Field), add:

```tsx
<Field label="Company ID" hint="Use this ID when configuring plugins or calling the API.">
  <div className="flex items-center gap-2">
    <input
      className="flex-1 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm font-mono outline-none select-all"
      type="text"
      value={selectedCompany.id}
      readOnly
    />
    <Button
      size="sm"
      variant="ghost"
      className="shrink-0 px-2"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(selectedCompany.id);
          setIdCopied(true);
          setTimeout(() => setIdCopied(false), 2000);
        } catch {
          /* clipboard may not be available */
        }
      }}
    >
      {idCopied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  </div>
</Field>
```

- [ ] **Step 4: Manual verification**

Run: `pnpm dev`

1. Navigate to Company Settings
2. Verify "Company ID" field appears above "Company name" in General section
3. Verify it displays the UUID and is read-only
4. Click copy button — verify clipboard contains the UUID
5. Verify icon switches to checkmark for 2 seconds

- [ ] **Step 5: Commit**

```bash
git add ui/src/pages/CompanySettings.tsx
git commit -m "feat: show Company ID with copy button in Company Settings"
```

---

### Task 2: Add `fieldKey` prop to FormField

**Files:**
- Modify: `ui/src/components/JsonSchemaForm.tsx:356-366` (FormFieldProps), `ui/src/components/JsonSchemaForm.tsx:1031-1043` (caller)

- [ ] **Step 1: Add `fieldKey` to `FormFieldProps`**

In `ui/src/components/JsonSchemaForm.tsx`, update the `FormFieldProps` interface (line 356):

```tsx
interface FormFieldProps {
  fieldKey?: string;
  propSchema: JsonSchemaNode;
  value: unknown;
  onChange: (val: unknown) => void;
  error?: string;
  disabled?: boolean;
  label: string;
  isRequired?: boolean;
  errors: Record<string, string>;
  path: string;
}
```

- [ ] **Step 2: Pass `fieldKey` from the main rendering loop**

In the `JsonSchemaForm` component's `Object.entries(properties).map(...)` block (line 1032), add `fieldKey={key}`:

```tsx
return (
  <FormField
    key={key}
    fieldKey={key}
    propSchema={propSchema}
    value={value}
    onChange={(val) => handleFieldChange(key, val)}
    error={error}
    disabled={disabled}
    label={label}
    isRequired={isRequired}
    errors={errors}
    path={path}
  />
);
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm -r typecheck`
Expected: No new errors (fieldKey is optional, so existing callers without it are fine)

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/JsonSchemaForm.tsx
git commit -m "feat: add fieldKey prop to FormField for key-based overrides"
```

---

### Task 3: CompanySelectField component

**Files:**
- Modify: `ui/src/components/JsonSchemaForm.tsx` (add new component, add import)

- [ ] **Step 1: Add imports**

At the top of `ui/src/components/JsonSchemaForm.tsx`, update the React import on line 1 to add `useEffect`:

```tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
```

Then add after the existing imports (after line 22):

```tsx
import { useCompany } from "@/context/CompanyContext";
```

- [ ] **Step 2: Add CompanySelectField component**

Add this component after `StringField` (after line 643, before `ArrayField`):

```tsx
/**
 * Specialized field for selecting a company by ID.
 * Rendered automatically when a plugin schema field key is "companyId".
 */
const CompanySelectField = React.memo(({
  value,
  onChange,
  disabled,
  label,
  isRequired,
  description,
  error,
}: {
  value: unknown;
  onChange: (val: unknown) => void;
  disabled: boolean;
  label: string;
  isRequired?: boolean;
  description?: string;
  error?: string;
}) => {
  const { companies, selectedCompanyId } = useCompany();
  const activeCompanies = useMemo(
    () => companies.filter((c) => c.status !== "archived"),
    [companies],
  );

  // Value priority chain:
  // 1. Saved value matching a valid (non-archived) company → keep it
  // 2. Empty/null or references archived/deleted company → default to current company
  // 3. Single company → auto-select
  const currentValue = useMemo(() => {
    const strVal = value ? String(value) : "";
    if (strVal && activeCompanies.some((c) => c.id === strVal)) {
      return strVal;
    }
    if (selectedCompanyId && activeCompanies.some((c) => c.id === selectedCompanyId)) {
      return selectedCompanyId;
    }
    if (activeCompanies.length === 1) {
      return activeCompanies[0]!.id;
    }
    return "";
  }, [value, activeCompanies, selectedCompanyId]);

  // Auto-set value when it differs from what's stored
  useEffect(() => {
    if (currentValue && currentValue !== String(value ?? "")) {
      onChange(currentValue);
    }
  }, [currentValue]); // eslint-disable-line react-hooks/exhaustive-deps

  if (activeCompanies.length === 0) {
    return (
      <FieldWrapper
        label={label}
        description={description}
        required={isRequired}
        error={error}
        disabled
      >
        <Select disabled>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="No companies available" />
          </SelectTrigger>
        </Select>
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper
      label={label}
      description={description}
      required={isRequired}
      error={error}
      disabled={disabled}
    >
      <Select
        value={currentValue}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a company" />
        </SelectTrigger>
        <SelectContent>
          {activeCompanies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.name}
              {company.issuePrefix ? ` (${company.issuePrefix})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
});

CompanySelectField.displayName = "CompanySelectField";
```

- [ ] **Step 3: Wire CompanySelectField in FormField's switch**

In the `FormField` component (line 834), add a check before the switch statement:

```tsx
const FormField = React.memo(({
  fieldKey,
  propSchema,
  value,
  onChange,
  error,
  disabled,
  label,
  isRequired,
  errors,
  path,
}: FormFieldProps) => {
  const type = resolveType(propSchema);
  const isReadOnly = disabled || propSchema.readOnly === true;

  // Key-based override: render company selector for companyId fields
  if (fieldKey === "companyId" && (type === "string" || type === "enum")) {
    return (
      <CompanySelectField
        value={value}
        onChange={onChange}
        disabled={isReadOnly}
        label={label}
        isRequired={isRequired}
        description={propSchema.description}
        error={error}
      />
    );
  }

  switch (type) {
    // ... rest unchanged
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm -r typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ui/src/components/JsonSchemaForm.tsx
git commit -m "feat: add CompanySelectField dropdown for companyId plugin fields"
```

---

### Task 4: Unit tests for CompanySelectField detection

**Files:**
- Create: `ui/src/components/__tests__/JsonSchemaForm.test.tsx`

- [ ] **Step 1: Write tests**

Create `ui/src/components/__tests__/JsonSchemaForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JsonSchemaForm, type JsonSchemaNode } from "../JsonSchemaForm";
import * as CompanyContext from "@/context/CompanyContext";

// Mock useCompany to provide test data
vi.mock("@/context/CompanyContext", () => ({
  useCompany: vi.fn(),
}));

const mockCompanies = [
  { id: "company-1", name: "Test Co", issuePrefix: "TST", status: "active" },
  { id: "company-2", name: "Other Co", issuePrefix: "OTH", status: "active" },
];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("JsonSchemaForm - companyId field detection", () => {
  beforeEach(() => {
    vi.mocked(CompanyContext.useCompany).mockReturnValue({
      companies: mockCompanies,
      selectedCompanyId: "company-1",
      selectedCompany: mockCompanies[0] as any,
      selectionSource: "manual",
      loading: false,
      error: null,
      setSelectedCompanyId: vi.fn(),
      reloadCompanies: vi.fn(),
      createCompany: vi.fn(),
    });
  });

  it("renders a dropdown for companyId field", () => {
    const schema: JsonSchemaNode = {
      type: "object",
      properties: {
        companyId: { type: "string", title: "Company ID" },
      },
    };

    renderWithProviders(
      <JsonSchemaForm
        schema={schema}
        values={{ companyId: "" }}
        onChange={vi.fn()}
      />,
    );

    // Should render a select trigger (dropdown), not a text input
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders a text input for other string fields", () => {
    const schema: JsonSchemaNode = {
      type: "object",
      properties: {
        apiKey: { type: "string", title: "API Key" },
      },
    };

    renderWithProviders(
      <JsonSchemaForm
        schema={schema}
        values={{ apiKey: "" }}
        onChange={vi.fn()}
      />,
    );

    // Should render a text input, not a dropdown
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run --project ui ui/src/components/__tests__/JsonSchemaForm.test.tsx`
Expected: Both tests PASS

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/__tests__/JsonSchemaForm.test.tsx
git commit -m "test: add unit tests for companyId field detection in JsonSchemaForm"
```

---

### Task 5: Manual E2E verification

- [ ] **Step 1: Verify plugin settings dropdown**

Run: `pnpm dev`

1. Install a plugin that has a `companyId` field (e.g., X Post Scanner or Polymarket Scanner)
2. Navigate to plugin settings (Settings → Plugins → plugin name → Configuration tab)
3. Verify the "Company Id" field renders as a **dropdown**, not a text input
4. Verify the dropdown lists active companies with name + issue prefix
5. Verify the current company is pre-selected
6. Save the config — verify the UUID string is saved correctly

- [ ] **Step 2: Verify Company Settings copy**

1. Navigate to Company Settings
2. Copy the Company ID
3. Compare with the value auto-selected in the plugin dropdown — they should match

- [ ] **Step 3: Run full typecheck and tests**

Run: `pnpm -r typecheck && pnpm test:run`
Expected: All pass

- [ ] **Step 4: Final commit if any adjustments**

```bash
git add -u
git commit -m "fix: address review feedback for company ID display"
```
