import { CommonModule } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-category-management-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './category-management-modal.component.html',
  styleUrl: './category-management-modal.component.scss',
})
export class CategoryManagementModalComponent implements OnInit {
  #fb = inject(FormBuilder);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #projectStore = inject(ProjectStore);

  projectId = input.required<string>();
  categories = input<string[]>([]);

  form: FormGroup;
  saving = signal(false);

  constructor() {
    this.form = this.#fb.group({
      categories: this.#fb.array([]),
      newCategory: [''],
    });
  }

  get categoryArray(): FormArray {
    return this.form.get('categories') as FormArray;
  }

  ngOnInit(): void {
    const cats = this.categories();
    if (cats && cats.length > 0) {
      cats.forEach(cat => {
        this.categoryArray.push(this.#fb.control(cat, [Validators.required]));
      });
    }
  }

  addCategory(): void {
    const newCategory = this.form.get('newCategory')?.value?.trim();
    if (!newCategory) return;

    if (this.categoryArray.value.includes(newCategory)) {
      this.#notificationService.showError(
        this.#translationService.instant('projects.categoryExists')
      );
      return;
    }

    this.categoryArray.push(this.#fb.control(newCategory, [Validators.required]));
    this.form.patchValue({ newCategory: '' });
  }

  removeCategory(index: number): void {
    this.categoryArray.removeAt(index);
  }

  save(): void {
    this.saving.set(true);
    const categories = this.categoryArray.value.filter((cat: string) => cat?.trim());

    this.#projectStore.updateProjectCategories(this.projectId(), categories).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('projects.categoriesUpdated')
        );
        this.saving.set(false);
        this.#modalService.close();
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('projects.updateCategoriesFailed')
        );
        this.saving.set(false);
      },
    });
  }

  close(): void {
    this.#modalService.close();
  }
}

