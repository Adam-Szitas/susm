import { projectPhotoSubGroups } from './project-photo-sub-groups';
import { ProjectFile } from '../models';

const photo = (id: string, group_id?: string): ProjectFile => ({
  _id: { $oid: id },
  project_id: { $oid: 'project' },
  group_id,
  path: 'photo.jpg',
  filename: id + '.jpg',
  created_at: '2026-01-01T00:00:00Z',
});

describe('Project photo sub-groups', () => {
  it('keeps individual photos outside named sub-groups', () => {
    const result = projectPhotoSubGroups(
      [photo('root'), photo('inside', 'sg')],
      [{ id: 'sg', name: 'Site visit' }],
    );
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Site visit');
    expect(result[0].files.map((file) => file._id.$oid)).toEqual(['inside']);
  });
  it('keeps empty sub-groups after their last photo is removed', () => {
    expect(projectPhotoSubGroups([], [{ id: 'sg', name: 'Empty' }])[0].files).toEqual([]);
  });
  it('opens all photos in a large sub-group, in saved order', () => {
    const files = Array.from({ length: 70 }, (_, index) => ({
      ...photo(String(index), 'sg'),
      sort_order: 69 - index,
    }));
    const group = projectPhotoSubGroups(files, [{ id: 'sg', name: 'Large' }])[0];
    expect(group.files.length).toBe(70);
    expect(group.files[0]._id.$oid).toBe('69');
  });
  it('shows earlier grouped uploads as sub-groups without a migration', () => {
    const file = {
      ...photo('legacy', 'old-batch'),
      description: 'Earlier visit',
      note: 'Entrance',
    };
    const group = projectPhotoSubGroups([file], [])[0];
    expect(group.name).toBe('Earlier visit');
    expect(group.note).toBe('Entrance');
    expect(group.files[0]).toEqual(jasmine.objectContaining(file));
  });
  it('keeps earlier unsorted photos ahead of later additions', () => {
    const files = [photo('first', 'sg'), photo('second', 'sg'), { ...photo('new', 'sg'), sort_order: 2 }];
    expect(projectPhotoSubGroups(files, [])[0].files.map(file => file._id.$oid)).toEqual(['first', 'second', 'new']);
  });
  it('does not include deleted photos or deleted sub-groups', () => {
    const deleted_at = '2026-01-02T00:00:00Z';
    expect(
      projectPhotoSubGroups(
        [{ ...photo('deleted', 'sg'), deleted_at }],
        [{ id: 'sg', name: 'Empty' }],
      )[0].files,
    ).toEqual([]);
    expect(
      projectPhotoSubGroups([photo('hidden', 'sg')], [{ id: 'sg', name: 'Removed', deleted_at }]),
    ).toEqual([]);
  });
});
