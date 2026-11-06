import {
  FileSubGroup,
  ProjectFile,
  ProjectPhotoSubGroup,
  parseMongoDateToMs,
  sortFileGroupItemsByStoredOrder,
} from '../models';

/** Resolve project sub-group cards independently of root-gallery pagination. */
export function projectPhotoSubGroups(
  files: ProjectFile[],
  metadata: ProjectPhotoSubGroup[],
): FileSubGroup[] {
  const groups = new Map<string, FileSubGroup>();
  const removed = new Set(
    metadata.filter((g) => parseMongoDateToMs(g.deleted_at) != null).map((g) => g.id),
  );
  for (const group of metadata) {
    if (removed.has(group.id)) continue;
    groups.set(group.id, {
      _id: { $oid: group.id },
      name: group.name,
      categories: group.categories ?? [],
      note: group.note,
      files: [],
    });
  }
  for (const file of files) {
    const id = file.group_id;
    if (!id || removed.has(id) || parseMongoDateToMs(file.deleted_at) != null) continue;
    let group = groups.get(id);
    if (!group) {
      // Older project batches did not store a separate sub-group record.
      group = {
        _id: { $oid: id },
        name: file.description || file.filename,
        categories: [],
        note: file.note,
        files: [],
      };
      groups.set(id, group);
    }
    group.files.push(file);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    files: sortFileGroupItemsByStoredOrder(
      group.files.map((file, index) => ({ ...file, sort_order: file.sort_order ?? index })),
    ),
  }));
}
