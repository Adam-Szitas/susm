import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../environment';

export interface ProtocolPreviewFieldValue {
  label: string;
  value: string;
  field_type: string;
}

export interface ProtocolPreviewImage {
  path: string;
  description?: string;
  note?: string;
  filename?: string;
  picture_date?: string;
  /** Multi-line caption matching PDF (`build_protocol_file_caption`). */
  caption?: string;
}

export interface ProtocolPreviewFileGroup {
  description?: string;
  note?: string;
  categories?: string[];
  images: ProtocolPreviewImage[];
  sub_groups?: ProtocolPreviewSubGroup[];
  /** When true, this group starts on a new PDF page (preview styling). */
  page_break_before?: boolean;
}

export interface ProtocolPreviewSubGroup {
  name?: string;
  note?: string;
  images: ProtocolPreviewImage[];
}

export interface ProtocolPreviewTodoLine {
  label: string;
  object_names?: string[];
  color?: string;
}

export interface ProtocolPreviewTodoSection {
  todo_item_id?: string;
  title: string;
  note?: string;
  lines?: ProtocolPreviewTodoLine[];
}

export interface ProtocolPreviewContentSection {
  object_id?: string;
  /** Bold object title (house + level/door), same as PDF/TOC. */
  object_headline?: string;
  /** Legacy alias; prefer `object_headline`. */
  headline?: string;
  object_note?: string;
  object_address?: string;
  file_groups: ProtocolPreviewFileGroup[];
  ungrouped_images?: ProtocolPreviewImage[];
  /** When true, this object section starts on a new PDF page (preview styling). */
  page_break_before?: boolean;
}

export interface ProtocolPreviewData {
  template_name?: string;
  subtitle?: string;
  header_template?: string;
  description?: string;
  field_values?: ProtocolPreviewFieldValue[];
  project_name?: string;
  project_address: string;
  table_of_contents: { title: string; level: number; page?: number }[];
  content_sections: ProtocolPreviewContentSection[];
  todo_sections?: ProtocolPreviewTodoSection[];
  linked_previews?: (ProtocolPreviewData & { protocol_id?: string })[];
  generated_at?: string;
  file_group_on_new_page?: boolean;
  /** Cover + TOC pages before object content (matches PDF). */
  front_matter_pages?: number;
  /** First object/content page number in the PDF. */
  content_start_page?: number;
}

import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';

@Component({
  selector: 'app-protocol-preview',
  standalone: true,
  imports: [CommonModule, TranslateModule, LocaleDatePipe, IconComponent],
  templateUrl: './protocol-preview.component.html',
  styleUrl: './protocol-preview.component.scss',
})
/** Renders the preview payload from `POST protocols/preview` (aligned with PDF layout in `protocols/mod.rs`). */
export class ProtocolPreviewComponent {
  protected readonly icons = icons;

  previewData = input.required<ProtocolPreviewData>();
  /** Full checklist rows for visibility toggles (unfiltered). */
  checklistSourceSections = input<ProtocolPreviewTodoSection[]>([]);
  excludedChecklistIds = input<string[]>([]);
  checklistVisibilityEditable = input(false);

  checklistVisibilityToggle = output<string>();

  isChecklistExcluded(todoItemId: string | undefined): boolean {
    if (!todoItemId) return false;
    return this.excludedChecklistIds().includes(todoItemId);
  }

  onChecklistVisibilityToggle(todoItemId: string | undefined): void {
    if (todoItemId) {
      this.checklistVisibilityToggle.emit(todoItemId);
    }
  }

  checklistSectionsForDisplay(): ProtocolPreviewTodoSection[] {
    const source = this.checklistSourceSections();
    if (source.length > 0) {
      return source;
    }
    return this.previewData().todo_sections ?? [];
  }

  objectHeadline(section: ProtocolPreviewContentSection): string {
    return (section.object_headline || section.headline || '').trim();
  }

    imageCaption(image: ProtocolPreviewImage): string {
    if (image.caption?.trim()) {
      return image.caption.trim();
    }
    const parts: string[] = [];
    const filename = image.filename?.trim() ?? '';
    const desc = image.description?.trim() ?? '';
    const note = image.note?.trim() ?? '';
    const hasUserText = !!desc || !!note;
    const looksStored =
      !!filename &&
      /\.(jpe?g|png|webp|gif|heic|bmp|tiff?)$/i.test(filename);
    if (filename && filename !== '—' && (!hasUserText || !looksStored)) {
      parts.push(filename);
    }
    if (desc && !parts.includes(desc)) {
      parts.push(desc);
    }
    if (note && !parts.includes(note)) {
      parts.push(note);
    }
    if (image.picture_date?.trim() && image.picture_date.trim() !== '—') {
      parts.push(image.picture_date.trim());
    }
    return parts.join('\n');
  }

  getImageUrl(path: string): string {
    let normalizedPath = path.replace(/^[.\\/]+/, '').replace(/\\/g, '/');
    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
      const encodedPath = encodeURIComponent(normalizedPath);
      return `${environment.be}${environment.folderBase}/${encodedPath}`;
    }
    if (normalizedPath.startsWith('uploads/')) {
      normalizedPath = normalizedPath.substring('uploads/'.length);
    }
    const pathSegments = normalizedPath
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment));
    const encodedPath = pathSegments.join('/');
    return `${environment.be}${environment.folderBase}/${encodedPath}`;
  }
}
