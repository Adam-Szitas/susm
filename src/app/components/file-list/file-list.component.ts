import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { File } from "@models";
import { environment } from "../../environment";
import { TranslateModule } from "@ngx-translate/core";

@Component({
    selector: 'app-file-list',
    templateUrl: './file-list.component.html',
    styleUrl: './file-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [TranslateModule],
})
export class FileListComponent {
    public files = input<File[]>([]);

    public getImageUrl(path: string): string {
        let normalizedPath = path.replace(/^\.?\/*/, '').replace(/\\/g, '/');
        
        if (normalizedPath.startsWith('uploads/')) {
            normalizedPath = normalizedPath.substring('uploads/'.length);
        }

        const pathSegments = normalizedPath.split('/').map(segment => encodeURIComponent(segment));
        const encodedPath = pathSegments.join('/');
        return `${environment.be}${environment.folderBase}/${encodedPath}`;
    }

    public downloadFile(path: string): void {
        let normalizedPath = path.replace(/^\.?\/*/, '').replace(/\\/g, '/');
        
        if (normalizedPath.startsWith('uploads/')) {
            normalizedPath = normalizedPath.substring('uploads/'.length);
        }

        const pathSegments = normalizedPath.split('/').map(segment => encodeURIComponent(segment));
        const encodedPath = pathSegments.join('/');
        const url = `${environment.be}${environment.folderBase}/${encodedPath}`;
        console.log(url);

        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.download = normalizedPath.split('/').pop() || 'file';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}