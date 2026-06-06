import { Component, input } from '@angular/core';
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
}

export interface ProtocolPreviewTodoSubSection {
  title: string;
  color?: string;
}

export interface ProtocolPreviewTodoSection {
  title: string;
  note?: string;
  sub_items?: ProtocolPreviewTodoSubSection[];
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
}

export interface ProtocolPreviewData {
  template_name?: string;
  subtitle?: string;
  header_template?: string;
  description?: string;
  field_values?: ProtocolPreviewFieldValue[];
  project_name?: string;
  project_address: string;
  table_of_contents: { title: string; level: number }[];
  content_sections: ProtocolPreviewContentSection[];
  todo_sections?: ProtocolPreviewTodoSection[];
  linked_previews?: (ProtocolPreviewData & { protocol_id?: string })[];
  generated_at?: string;
}

@Component({
  selector: 'app-protocol-preview',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './protocol-preview.component.html',
  styleUrl: './protocol-preview.component.scss',
})
/** Renders the preview payload from `POST protocols/preview` (aligned with PDF layout in `protocols/mod.rs`). */
export class ProtocolPreviewComponent {
  previewData = input.required<ProtocolPreviewData>();

  objectHeadline(section: ProtocolPreviewContentSection): string {
    return (section.object_headline || section.headline || '').trim();
  }

  imageCaption(image: ProtocolPreviewImage): string {
    if (image.caption?.trim()) {
      return image.caption.trim();
    }
    const parts: string[] = [];
    if (image.filename?.trim()) {
      parts.push(image.filename.trim());
    }
    const desc = image.description?.trim();
    if (desc && desc !== image.filename?.trim()) {
      parts.push(desc);
    }
    if (image.picture_date?.trim()) {
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
