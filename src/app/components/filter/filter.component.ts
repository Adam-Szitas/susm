import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  input,
  Output,
  OnInit,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-filter',
  templateUrl: './filter.component.html',
  styleUrl: './filter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
export class FilterComponent implements OnInit {
  public filter = input.required<Filter>();

  @Output()
  public filterChange = new EventEmitter<any>();

  searchForm = new FormGroup({
    search: new FormControl(''),
  });

  constructor() {
    this.searchForm.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe({
      next: (value) => {
        this.filterChange.emit(value);
      },
    });
  }

  ngOnInit(): void {
    if (this.filter().value) {
      this.searchForm.patchValue({ search: this.filter().value });
    }
  }
}

export interface Filter {
  placeholder: string;
  value: string;
  label: string;
}
