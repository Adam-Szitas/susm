import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormGroup, Validators, FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { HttpService } from "../../services/http.service";
import { RouterLink } from "@angular/router";

@Component({
  selector: "app-register",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  imports: [ReactiveFormsModule, RouterLink]
})
export class RegisterComponent {
  #formBuilder = inject(FormBuilder);

  public form: FormGroup = this.#formBuilder.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.email, Validators.required]],
    password: ['', [Validators.required, Validators.minLength(5)]],
    addresses: this.#formBuilder.group({
      street: ['', [Validators.required]],
      city: ['', [Validators.required]],
      country: ['', [Validators.required]]
    })
  })

  constructor(private httpService: HttpService){}

  public Submit() {
    const credentials = this.form.getRawValue();
    console.log(credentials);
    this.httpService.post('register', credentials).subscribe({
      next: console.log
    })
  }
}
