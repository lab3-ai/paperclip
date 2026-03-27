# Show Company ID in UI

## Problem

Plugin settings (e.g., X Post Scanner, Polymarket Scanner) require a `companyId` field that users must fill manually. Currently, the Company ID (UUID) is not shown anywhere in the UI, forcing users to look it up through the API or database.

## Solution

Two complementary changes:

1. **Company ID in General Settings** — read-only field with copy button
2. **Smart Company Dropdown in Plugin Settings** — auto-detect `companyId` fields and render a company selector instead of a text input

## Part 1: Company ID in General Settings

**File:** `ui/src/pages/CompanySettings.tsx`

Add a read-only "Company ID" field at the top of the General section, above the "Company Name" field.

- Read-only text input displaying the company UUID
- Copy-to-clipboard button using `Copy` icon from `lucide-react` (switch to `Check` icon on success)
- Helper text: "Use this ID when configuring plugins or calling the API"

## Part 2: Smart Company Dropdown in Plugin Settings

**File:** `ui/src/components/JsonSchemaForm.tsx`

When a plugin manifest declares a settings field with key `companyId` and `type: "string"`, the form renders a `CompanySelectField` dropdown instead of a plain text input.

### Detection logic

Add a `fieldKey?: string` prop to `FormFieldProps`. The caller in the main `JsonSchemaForm` rendering loop must pass `fieldKey={key}` when rendering each property. In `FormField`, check if `fieldKey === "companyId"` (case-sensitive) before falling through to `StringField`. No changes to `resolveType()` needed — this is a key-based override, not a type-based one.

### CompanySelectField behavior

- Renders a `<select>` dropdown listing all non-archived companies
- Data source: `companies` from `useCompany()` context, filtered by `status !== "archived"`
- Each option shows: company name + issue prefix (e.g., "My Company (PAP)"). If `issuePrefix` is empty, show name only.
- Selected value = company UUID string (unchanged from current string behavior)
- **Value priority chain:**
  1. If field already has a saved value matching a valid (non-archived) company → keep it
  2. If value is empty/null → default to `selectedCompanyId` from `useCompany()` context
  3. If only one company exists → auto-select it
  4. If saved value references an archived/deleted company → clear it and fall through to rule 2
- User can still change selection if they manage multiple companies
- Empty state: dropdown disabled with "No companies available" message

### Why key-based detection over a new format/type

- Zero changes to plugin SDK or manifest schema
- Existing plugins (x-scanner, polymarket-scanner) already use `companyId` as the key
- The convention is clear and unlikely to collide with unrelated fields

## Files changed

| File | Change |
|------|--------|
| `ui/src/pages/CompanySettings.tsx` | Add read-only Company ID field with copy button in General section |
| `ui/src/components/JsonSchemaForm.tsx` | Add `CompanySelectField` component; modify `FormField` to detect `companyId` key |

## Files NOT changed

- Plugin SDK / shared types — no new types or formats needed
- Server / API — no new endpoints
- Existing plugin manifests — they continue to declare `companyId` as `type: "string"`

## Edge cases

- **No companies:** Dropdown disabled, shows "No companies available"
- **Archived companies:** Excluded from dropdown (consistent with CompanySwitcher)
- **Field named `companyId` used for other purposes:** Unlikely given the convention; value remains a valid string regardless

## Testing

**Manual verification:**
- Verify Company ID field appears in General Settings and copy works
- Verify `companyId` plugin field renders as dropdown (not text input)
- Verify auto-select of current company
- Verify saving plugin config still sends UUID string as before
- Verify dropdown excludes archived companies
- Verify saved value for archived/deleted company is cleared gracefully

**Unit tests (vitest):**
- Test `FormField` renders `CompanySelectField` when `fieldKey === "companyId"`
- Test `FormField` renders `StringField` for other string fields
