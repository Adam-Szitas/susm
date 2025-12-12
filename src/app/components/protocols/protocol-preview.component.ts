import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../environment';

interface ProtocolPreviewData {
  project_name: string;
  project_address: string;
  table_of_contents: Array<{ title: string; level: number }>;
  content_sections: Array<{
    object_address: string;
    headline: string;
    file_groups: Array<{
      description?: string;
      images: Array<{
        path: string;
        description?: string;
        object_address: string;
      }>;
    }>;
    ungrouped_images: Array<{
      path: string;
      description?: string;
      object_address: string;
    }>;
  }>;
}

@Component({
  selector: 'app-protocol-preview',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './protocol-preview.component.html',
  styleUrl: './protocol-preview.component.scss',
})
export class ProtocolPreviewComponent {
  previewData = input.required<ProtocolPreviewData>();

  getImageUrl(path: string): string {
    let normalizedPath = path.replace(/^\.?\/*/, '').replace(/\\/g, '/');

    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
      const encodedPath = encodeURIComponent(normalizedPath);
      return `${environment.be}${environment.folderBase}/${encodedPath}`;
    }

    if (normalizedPath.startsWith('uploads/')) {
      normalizedPath = normalizedPath.substring('uploads/'.length);
    }

    const pathSegments = normalizedPath.split('/').map((segment) => encodeURIComponent(segment));
    const encodedPath = pathSegments.join('/');
    return `${environment.be}${environment.folderBase}/${encodedPath}`;
  }
}

