import { Resource } from "@/lib/resources";

let uploadedResources: Resource[] = [];
let resourceIdCounter = 1000;

export function addUploadedResource(resource: Resource): void {
  uploadedResources.push(resource);
}

export function getUploadedResources(): Resource[] {
  return uploadedResources;
}

export function getUploadedResourceById(id: string): Resource | undefined {
  return uploadedResources.find((r) => r.id === id);
}

export function updateUploadedResource(
  id: string,
  updates: Partial<Resource>
): Resource | undefined {
  const resource = uploadedResources.find((r) => r.id === id);
  if (!resource) return undefined;

  const updated = { ...resource, ...updates };
  const index = uploadedResources.indexOf(resource);
  uploadedResources[index] = updated;
  return updated;
}

export function deleteUploadedResource(id: string): boolean {
  const index = uploadedResources.findIndex((r) => r.id === id);
  if (index === -1) return false;

  uploadedResources.splice(index, 1);
  return true;
}

export function generateResourceId(): string {
  return `uploaded-res-${++resourceIdCounter}`;
}
