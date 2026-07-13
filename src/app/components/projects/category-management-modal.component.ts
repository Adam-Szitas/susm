import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { TrashIconComponent } from '../shared/trash-icon.component';
import { switchMap } from 'rxjs';
@Component({
  selector: 'app-category-management-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    IconComponent,
    TrashIconComponent,
  ],
  templateUrl: './category-management-modal.component.html',
  styleUrl: './category-management-modal.component.scss',
})
export class CategoryManagementModalComponent implements OnInit {
  #fb = inject(FormBuilder);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #projectStore = inject(ProjectStore);

  protected readonly icons = icons;

  projectId = input.required<string>();
  categories = input<string[]>([]);
  currentCategory = input<string | null>(null);
  isAdmin = input(false);

  form: FormGroup;
  saving = signal(false);
  selectedCategory = signal<string | null>(null);
  editingIndex = signal<number | null>(null);

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
    this.selectedCategory.set(this.currentCategory() ?? null);
    if (this.isAdmin()) {
      for (const category of this.categories()) {
        this.categoryArray.push(this.#fb.control(category, [Validators.required]));
      }
    }
  }

  categoryNames(): string[] {
    if (this.isAdmin()) {
      return this.categoryArray.controls
        .map((control) => String(control.value ?? '').trim())
        .filter(Boolean);
    }
    return (this.categories() ?? []).map((c) => c.trim()).filter(Boolean);
  }

  isSelected(category: string): boolean {
    return this.selectedCategory() === category;
  }

  selectCategory(category: string | null): void {
    this.selectedCategory.set(category);
  }

  hasCategories(): boolean {
    return this.categoryNames().length > 0;
  }

  addCategory(): void {
    const newCategory = this.form.get('newCategory')?.value?.trim();
    if (!newCategory) return;

    const existing = this.categoryNames();
    if (existing.some((cat) => cat.toLowerCase() === newCategory.toLowerCase())) {
      this.#notificationService.showError(
        this.#translationService.instant('projects.categoryExists'),
      );
      return;
    }

    this.categoryArray.push(this.#fb.control(newCategory, [Validators.required]));
    this.form.patchValue({ newCategory: '' });
    this.selectedCategory.set(newCategory);
  }

  startEditing(index: number): void {
    if (!this.isAdmin()) return;
    this.editingIndex.set(index);
  }

  finishEditing(index: number): void {
    const control = this.categoryArray.at(index);
    const trimmed = String(control.value ?? '').trim();
    if (!trimmed) {
      this.#notificationService.showError(
        this.#translationService.instant('projects.categoryNameRequired'),
      );
      return;
    }

    const previous = this.categories()[index] ?? '';
    const duplicate = this.categoryNames().some(
      (name, idx) => idx !== index && name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      this.#notificationService.showError(
        this.#translationService.instant('projects.categoryExists'),
      );
      control.setValue(previous);
      this.editingIndex.set(null);
      return;
    }

    control.setValue(trimmed);
    if (this.selectedCategory() === previous) {
      this.selectedCategory.set(trimmed);
    }
    this.editingIndex.set(null);
  }

  async removeCategory(index: number): Promise<void> {
    if (!this.isAdmin()) return;

    const name = String(this.categoryArray.at(index).value ?? '').trim();
    const confirmed = await this.#modalService.openConfirm({
      title: 'projects.removeCategory',
      message: 'projects.removeCategoryConfirm',
      confirmText: 'common.delete',
      confirmKind: 'danger',
    });
    if (!confirmed) return;

    this.categoryArray.removeAt(index);
    if (this.selectedCategory() === name) {
      this.selectedCategory.set(null);
    }
    if (this.editingIndex() === index) {
      this.editingIndex.set(null);
    }
  }

  save(): void {
    const projectId = this.projectId();
    const nextCategories = this.isAdmin() ? this.categoryNames() : this.categories();
    const nextSelection = this.selectedCategory();
    const originalCategories = (this.categories() ?? []).map((c) => c.trim()).filter(Boolean);
    const originalSelection = this.currentCategory() ?? null;

    if (nextSelection && !nextCategories.includes(nextSelection)) {
      this.#notificationService.showError(
        this.#translationService.instant('projects.selectedCategoryMissing'),
      );
      return;
    }

    const categoriesChanged =
      this.isAdmin() &&
      (nextCategories.length !== originalCategories.length ||
        nextCategories.some((cat, idx) => cat !== originalCategories[idx]));
    const selectionChanged = nextSelection !== originalSelection;

    if (!categoriesChanged && !selectionChanged) {
      this.close();
      return;
    }

    this.saving.set(true);

    const categories$ = categoriesChanged
      ? this.#projectStore.updateProjectCategories(projectId, nextCategories)
      : null;
    const selection$ = selectionChanged
      ? this.#projectStore.updateProjectCategory(projectId, nextSelection)
      : null;

    const request$ = categories$
      ? selection$
        ? categories$.pipe(switchMap(() => selection$))
        : categories$
      : selection$!;

    request$.subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant(
            categoriesChanged ? 'projects.categoriesUpdated' : 'projects.categoryUpdated',
          ),
        );
        this.saving.set(false);
        this.#modalService.close();
      },
      error: (error: { message?: string }) => {
        this.#notificationService.showError(
          error.message ||
            this.#translationService.instant(
              categoriesChanged ? 'projects.updateCategoriesFailed' : 'projects.updateCategoryFailed',
            ),
        );
        this.saving.set(false);
      },
    });
  }

  close(): void {
    this.#modalService.close();
  }
}
