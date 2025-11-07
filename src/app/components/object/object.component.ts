import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Address } from '../../models/user.model';

@Component({
  selector: 'app-object',
  templateUrl: './object.component.html',
  styleUrl: './object.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectComponent {}

export interface Object {
  id: {
    $oid: string;
  };
  address: Address;
  note: string;
}
