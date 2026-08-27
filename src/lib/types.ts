export type Resource = {
  id: string;
  name: string;
  ownerId: string;
  filePath: string;
  downloadCount: number;
  createdAt: string;
};

export type DownloadRecord = {
  resourceId: string;
  userId: string;
  timestamp: string;
};

export type User = {
  id: string;
};

export type StoreData = {
  resources: Resource[];
};
