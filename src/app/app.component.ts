import { Component, ViewChild } from '@angular/core'
import { AbstractControl, FormControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms'
import { MatTable, MatTableDataSource } from '@angular/material/table'


export interface Restaurant {
  no: number
  restaurant: string
  coordinate: string
  latitude: number
  longitude: number
  type: string
}
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent {
  dataSource = new MatTableDataSource([
    {
      no: 1,
      restaurant: 'Aerodyne',
      coordinate: '2.901253, 101.652031',
      latitude: 2.901253,
      longitude: 101.652031,
      type: 'Cafe'
    }
  ])
  displayedColumns: string[] = ['no', 'restaurant', 'coordinate', 'type']

  @ViewChild(MatTable)
  table!: MatTable<Restaurant>

  latitudeFormControl = new FormControl('', [
    Validators.required,
    this.coordinateValidator(
      new RegExp(/^\(?[+-]?(90(\.0+)?|[1-8]?\d(\.\d+)?)$/),
      { 'precision': 'Latitude must have a valid coordinate' }
    )
  ])
  longitudeFormControl = new FormControl('', [
    Validators.required,
    this.coordinateValidator(
      new RegExp(/^\s?[+-]?(180(\.0+)?|1[0-7]\d(\.\d+)?|\d{1,2}(\.\d+)?)\)?$/),
      { 'precision': 'Longitude must have a valid coordinate' }
    )
  ])
  restaurantFormControl = new FormControl('', [Validators.required])
  typeFormControl = new FormControl('', [Validators.required])
  title = 'Aerodyne'

  constructor () { }

  addData () {
    const element = {
      no: this.dataSource.data.length + 1,
      coordinate: `${this.latitudeFormControl.value}, ${this.longitudeFormControl.value}`,
      restaurant: this.restaurantFormControl.value,
      latitude: this.latitudeFormControl.value,
      longitude: this.longitudeFormControl.value,
      type: this.typeFormControl.value
    }

    ;[
      this.restaurantFormControl,
      this.typeFormControl,
      this.latitudeFormControl,
      this.longitudeFormControl
    ].map((el: FormControl) => this.clearText(el))

    const list = this.dataSource.data

    list.push(element)

    this.dataSource.data = list
    this.table.renderRows()
  }

  applyFilter (event: Event) {
    const filterValue = (event.target as HTMLInputElement).value

    this.dataSource.filter = filterValue.trim().toLowerCase()
  }

  removeData () {
    this.table.renderRows()
  }

  clearText (formControl: FormControl) {
    formControl.setValue('')
    formControl.reset()
  }

  get isFormValid () {
    return (
      this.restaurantFormControl.valid &&
      this.typeFormControl.valid &&
      this.latitudeFormControl.valid && 
      this.longitudeFormControl.valid
    )
  }


  private coordinateValidator (regex: RegExp, error: ValidationErrors): ValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value) {
        return null
      }

      const valid = regex.test(control.value)

      return valid ? null : error
    }
  }
}
