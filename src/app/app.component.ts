import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { AbstractControl, FormControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms'
import { GoogleMap } from '@angular/google-maps'
import { MatSnackBar } from '@angular/material/snack-bar'
import { MatTable, MatTableDataSource } from '@angular/material/table'
import { FileUploader } from 'ng2-file-upload'


export interface Restaurant {
  no: number
  restaurant: string
  coordinate: string
  latitude: number
  longitude: number
  type: string
  delete: string
}
interface PlaceMarkerOptions {
  center?: boolean
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent implements OnInit  {
  dataSource = new MatTableDataSource([
    {
      no: 1,
      restaurant: 'Aerodyne',
      coordinate: '2.901253, 101.652031',
      latitude: 2.901253,
      longitude: 101.652031,
      type: 'Cafe',
      delete: '1'
    },
    {
      no: 2,
      restaurant: 'Tealive Petronas Sg. Besi',
      coordinate: '3.0502805, 101.6282397',
      latitude: 	3.0502805,
      longitude: 101.6282397,
      type: 'Beverage',
      delete: '2'
    },
    {
      no: 3,
      restaurant: 'McDonald’s Bandar Kinrara',
      coordinate: '3.0378286, 101.6571857',
      latitude: 	3.0378286,
      longitude: 101.6571857,
      type: 'Fast Food',
      delete: '3'
    }
  ])
  displayedColumns: string[] = ['no', 'restaurant', 'coordinate', 'type', 'delete']
  hasBaseDropZoneOver: boolean = false
  markers: google.maps.MarkerOptions[] = []
  uploader: FileUploader


  @ViewChild('googleMapRef')
  googleMaps!: GoogleMap

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

  constructor (
    private _snackBar: MatSnackBar,
    private element: ElementRef
  ) {
    this.uploader = new FileUploader({
      url: 'http://localhost:3000/api/',
      disableMultipart: true,
      formatDataFunctionIsAsync: true,
      formatDataFunction: async (item: any) => {
        return new Promise( (resolve, reject) => {
          resolve({
            name: item._file.name,
            length: item._file.size,
            contentType: item._file.type,
            date: new Date()
          })
        })
      }
    })
  }

  ngOnInit () {
    this.loadRestaurants()

    setTimeout(() => {
      this.fitBounds()
    }, 500)
  }

  addData () {
    const element = {
      no: this.dataSource.data.length + 1,
      coordinate: `${this.latitudeFormControl.value}, ${this.longitudeFormControl.value}`,
      restaurant: this.restaurantFormControl.value,
      latitude: this.latitudeFormControl.value,
      longitude: this.longitudeFormControl.value,
      type: this.typeFormControl.value,
      delete: `${this.dataSource.data.length + 1}`
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
    this.putMarker(element.latitude, element.longitude, element.restaurant, { center: true })
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

  fileOverBase (evt: any) {}

  get isFormValid () {
    return (
      this.restaurantFormControl.valid &&
      this.typeFormControl.valid &&
      this.latitudeFormControl.valid && 
      this.longitudeFormControl.valid
    )
  }

  onDelete (obj: Restaurant) {
    const list = this.dataSource.data.filter(itm => (itm.no != obj.no))

    this.dataSource.data = list
    this.table.renderRows()

    this.markers = this.markers.filter(marker => {
      return (marker.position?.lat != obj.latitude && marker.position?.lng != obj.longitude)
    })
    this.fitBounds()

    this._snackBar.open(`${obj.restaurant} has deleted successfully.`, 'undo').onAction().subscribe(() => {
      this.dataSource.data.push(obj)
      this.dataSource.data.sort((a: Restaurant, b: Restaurant) => {
        if (a.no > b.no) return 1
        if (a.no < b.no) return -1
        return 0
      })
      this.table.renderRows()
      this.putMarker(obj.latitude, obj.longitude, obj.restaurant)
      this.fitBounds()
    })
  }

  onRestaurant (el: any, col: string) {
    if (col == 'delete') return

    const zoom = this.googleMaps.googleMap?.getZoom() || 0
    const diff = zoom - 10
    const fps  = 100

    // simulate zoom out
    for (let x=1; x<=diff; x++) {
      const zoomTo = zoom - x

      setTimeout(()=>{
        this.googleMaps.googleMap?.setZoom(zoomTo)
      }, (x * fps))
    }

    setTimeout(() => {
      const { latitude: lat, longitude: lng } = el
      const currentZoom = 10

      this.googleMaps.panTo({ lat, lng })

      // simulate zoom in
      for (let x=1; x<=5; x++) {
        const zoomTo = currentZoom + x

        setTimeout(()=>{
          this.googleMaps.googleMap?.setZoom(zoomTo)
        }, (x * fps))
      }
    }, diff * fps)
  }

  zoomChanged () {
    // console.log('zoom changed', this.googleMaps.getZoom())
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

  private fitBounds () {
    const bounds = new google.maps.LatLngBounds()

    this.dataSource.data.map((itm: Restaurant) => {
      bounds.extend(new google.maps.LatLng(itm.latitude, itm.longitude))
    })

    this.googleMaps.fitBounds(bounds)
  }

  private loadRestaurants () {
    const markers: google.maps.MarkerOptions[] = []

    this.dataSource.data.map((itm: Restaurant) => {
      const { latitude: lat, longitude: lng, restaurant } = itm
      const marker = {
        animation: google.maps.Animation.DROP,
        draggable: false,
        position: { lat, lng },
        title: restaurant
      }

      markers.push(marker)
    })

    this.markers = markers
  }

  private putMarker (lat: number, lng: number, restaurant: string, options: PlaceMarkerOptions = {}) {
    const { center=false } = options

    if (center) {
      this.googleMaps.panTo({ lat, lng })

      setTimeout(() => {
        this.markers.push({
          animation: google.maps.Animation.DROP,
          draggable: false,
          position: { lat, lng },
          title: restaurant
        })
      }, 500)
      return
    }

    this.markers.push({
      animation: google.maps.Animation.DROP,
      draggable: false,
      position: { lat, lng },
      title: restaurant
    })
  }
}
