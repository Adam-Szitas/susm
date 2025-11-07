import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ProjectStore } from '@store/project.store';
import { ActivatedRoute, Router } from '@angular/router';
import { FileService } from '@services/file.service';

@Component({
  selector: 'app-object-tab',
  templateUrl: './object-tab.component.html',
  styleUrl: './object-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectTabComponent implements OnInit {
  #projectStore = inject(ProjectStore);
  #route = inject(ActivatedRoute);
  #router = inject(Router);
  #fileService = inject(FileService);

  ngOnInit(): void {
    const objectId = this.#route.snapshot.paramMap.get('id');

    if (objectId) {
      this.#projectStore.loadObject(objectId).subscribe({
        next: (object) => {
          console.log(object);
        },
      });
    } else {
      this.#router.navigate(['/']);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];

    // ---- OPTIONAL: restrict to images only ----
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    // // ---- Create a preview ----
    // const reader = new FileReader();
    // reader.onload = () => this.previewUrl = reader.result;
    // reader.readAsDataURL(file);   // base-64 string

    const form = new FormData();
    form.append('avatar', file, 'fileName');
    this.#fileService.uploadFile(form, 'object').subscribe({
      next: console.log,
    });
  }
}
