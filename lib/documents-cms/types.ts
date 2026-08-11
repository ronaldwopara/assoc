export type DocumentsCmsItem = {
  id: string;
  label: string;
  url: string;
  filename: string;
  contentType: string;
};

export type DocumentsCmsGroup = {
  id: string;
  title: string;
  items: DocumentsCmsItem[];
};

export type DocumentsCmsData = {
  version: 1;
  updatedAt: string;
  groups: DocumentsCmsGroup[];
};
