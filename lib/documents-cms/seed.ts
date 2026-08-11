import type { DocumentsCmsData } from "@/lib/documents-cms/types";

export function buildSeedDocumentsCms(): DocumentsCmsData {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    groups: [
      {
        id: "financial-reports",
        title: "Financial Reports",
        items: [
          {
            id: "financial-2025",
            label: "2025 Financial Statement",
            url: "/docs/2025/Financial-Statement-2025.pdf",
            filename: "Financial-Statement-2025.pdf",
            contentType: "application/pdf",
          },
          {
            id: "financial-2024",
            label: "2024 Financial Statement",
            url: "/docs/2024/ASOSC-Financial-Statement-2024.pdf",
            filename: "ASOSC-Financial-Statement-2024.pdf",
            contentType: "application/pdf",
          },
          {
            id: "financial-2023",
            label: "2023 Financial Statement",
            url: "/docs/2023/ASOSC-Financial-Statement-2023.pdf",
            filename: "ASOSC-Financial-Statement-2023.pdf",
            contentType: "application/pdf",
          },
        ],
      },
      {
        id: "governance-planning",
        title: "Governance & Planning",
        items: [
          {
            id: "bylaws-2025",
            label: "Bylaws (2025)",
            url: "/docs/governance/Bylaws-2025.docx",
            filename: "Bylaws-2025.docx",
            contentType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
          {
            id: "strategic-plan",
            label: "Strategic Plan",
            url: "/docs/governance/ASOSC-Strategic-Plan.pptx",
            filename: "ASOSC-Strategic-Plan.pptx",
            contentType:
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          },
        ],
      },
    ],
  };
}
