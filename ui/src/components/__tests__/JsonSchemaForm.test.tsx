// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JsonSchemaForm, type JsonSchemaNode } from "../JsonSchemaForm";

// Mock useCompany to provide test data
vi.mock("@/context/CompanyContext", () => ({
  useCompany: vi.fn(),
}));

import * as CompanyContext from "@/context/CompanyContext";

const mockCompanies = [
  { id: "company-1", name: "Test Co", issuePrefix: "TST", status: "active" },
  { id: "company-2", name: "Other Co", issuePrefix: "OTH", status: "active" },
];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("JsonSchemaForm - companyId field detection", () => {
  beforeEach(() => {
    vi.mocked(CompanyContext.useCompany).mockReturnValue({
      companies: mockCompanies as any,
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

    const html = renderWithProviders(
      <JsonSchemaForm
        schema={schema}
        values={{ companyId: "" }}
        onChange={vi.fn()}
      />,
    );

    // Should render a select trigger (dropdown), not a text input
    expect(html).toContain('data-slot="select-trigger"');
    expect(html).not.toContain('type="text"');
  });

  it("renders a text input for other string fields", () => {
    const schema: JsonSchemaNode = {
      type: "object",
      properties: {
        apiKey: { type: "string", title: "API Key" },
      },
    };

    const html = renderWithProviders(
      <JsonSchemaForm
        schema={schema}
        values={{ apiKey: "" }}
        onChange={vi.fn()}
      />,
    );

    // Should render a text input, not a dropdown
    expect(html).toContain('type="text"');
    expect(html).not.toContain('data-slot="select-trigger"');
  });
});
