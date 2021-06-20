import { Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { AbstractControl, FormControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms'
import { GoogleMap } from '@angular/google-maps'
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog'
import { MatSnackBar } from '@angular/material/snack-bar'
import { MatTable, MatTableDataSource } from '@angular/material/table'
import { FileItem, FileUploader, ParsedResponseHeaders } from 'ng2-file-upload'
import { Subscription } from 'rxjs'

import { environment } from '../environments/environment'
import { ApiService } from './app.service'


export interface Restaurant {
  no: number
  image: string
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
export class AppComponent implements OnDestroy, OnInit  {
  dataSource!: MatTableDataSource<Restaurant>
  displayedColumns: string[] = ['no', 'image', 'restaurant', 'coordinate', 'type', 'delete']
  hasBaseDropZoneOver: boolean = false
  isLoadingResults = true
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
  markers: google.maps.MarkerOptions[] = []
  restaurantFormControl = new FormControl('', [Validators.required])
  restaurantImage = ''
  restaurantTypes = new FormControl()
  selected = ''
  title = 'Aerodyne'
  typeFormControl = new FormControl('', [Validators.required])
  typeList: string[] = []
  uploader!: FileUploader
  private querySubscription!: Subscription
  private rawData: Restaurant[] = []

  @ViewChild('googleMapRef')
  googleMaps!: GoogleMap

  @ViewChild(MatTable)
  table!: MatTable<Restaurant>

  constructor (
    private _snackBar: MatSnackBar,
    private apiService: ApiService,
    public dialog: MatDialog,
    private element: ElementRef
  ) { }

  ngOnInit () {
    this.initTypeFilter()
    this.initUploader()

    this.dataSource = new MatTableDataSource()

    this.querySubscription = this.apiService.getData().subscribe(({ data, loading }) => {
      this.isLoadingResults = loading

      if (!loading) {
        const { restaurants } = data

        this.dataSource.data = Array.isArray(restaurants) ? restaurants.slice() : []
        this.rawData         = Array.isArray(restaurants) ? restaurants : []

        this.table.renderRows()
        this.updateTypes()
        this.renderRestaurantMarkers()
        setTimeout(() => {
          this.fitBounds()
        }, 500)
      }
    }, err => {
      this.isLoadingResults = false
      this._snackBar.open(err)
    }, )
  }

  ngOnDestroy () {
    this.querySubscription.unsubscribe()
  }

  addData () {
    let no = 0

    if (Array.isArray(this.dataSource.data) && this.dataSource.data.length) {
      const [last] = this.dataSource.data.slice(-1)
      no = last.no
    }

    const element = {
      no: no + 1,
      image: this.restaurantImage,
      coordinate: `${this.latitudeFormControl.value}, ${this.longitudeFormControl.value}`,
      restaurant: this.restaurantFormControl.value,
      latitude: this.latitudeFormControl.value,
      longitude: this.longitudeFormControl.value,
      type: this.typeFormControl.value,
      delete: Date.now().toString()
    }

    ;[
      this.restaurantFormControl,
      this.typeFormControl,
      this.latitudeFormControl,
      this.longitudeFormControl
    ].map((el: FormControl) => this.clearText(el))
    this.restaurantImage = ''

    this.dataSource.data.push(element)
    this.rawData.push(element)
    this.table.renderRows()
    this.updateTypes()
    this.putMarker(element.latitude, element.longitude, element.restaurant, { center: true })

    this.apiService.create(element).subscribe(result => {
      const { _id, _ref } = result?.data?.createRestaurant

      element.no     = _ref
      element.delete = _id

      this.uploader.clearQueue()

    }, err => {
      this._snackBar.open(err)
    })
  }

  applyFilter (event: Event) {
    const filterValue = (event.target as HTMLInputElement).value

    this.dataSource.filter = (filterValue) ? filterValue.trim().toLowerCase() : ''
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
    const list = this.dataSource.data.filter(itm => (itm.delete != obj.delete))

    this.apiService.remove(obj.delete).subscribe(res => {
      console.log('Restaurant deleted', res)
    }, err => {
      this._snackBar.open(err)
      this.restoreDeleted(obj)
    })

    this.selected = ''
    this.rawData  = this.rawData.filter(itm => (itm.delete != obj.delete))

    this.dataSource.data = list
    this.table.renderRows()

    this.markers = this.markers.filter(marker => {
      return (marker.position?.lat != obj.latitude && marker.position?.lng != obj.longitude)
    })
    this.fitBounds()

    this._snackBar.open(`${obj.restaurant} has deleted successfully.`, 'undo').onAction().subscribe(() => {
      this.restoreDeleted(obj)

      this.apiService.restore(obj.delete).subscribe(res => {
        console.log('Restaurant restored', res)
      }, err => {
        this._snackBar.open(err)
      })
    })
  }

  onRestaurant (el: any, col: string) {
    if (col == 'delete') return

    const zoom = this.googleMaps.googleMap?.getZoom() || 0
    const diff = zoom - 10
    const fps  = 200

    this.selected = el.no

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

  private initTypeFilter () {
    this.restaurantTypes.valueChanges.subscribe(value => {
      if (!value || value.length === 0) {
        this.dataSource.data = this.rawData.slice()
        this.table.renderRows()
        return
      }

      this.dataSource.data = this.rawData.filter((itm: Restaurant) => (value.includes(itm.type)))
      this.table.renderRows()
    })
  }

  private initUploader () {
    this.uploader = new FileUploader({
      url: environment.uploadUrl,
      disableMultipart: false,
      itemAlias: 'restaurant'
    })

    this.uploader.onSuccessItem = (item: FileItem, response: string, status: number, headers: ParsedResponseHeaders)=>{
      const res = JSON.parse(response)

      this.restaurantImage = res.url
    }

    this.uploader.onErrorItem = (item: FileItem, response: string, status: number, headers: ParsedResponseHeaders)=>{
      const res = JSON.parse(response)

      this.dialog.open(ContentDialogComponent, {
        width: '600px',
        data: {
          content: `Fail to upload file: ${item.file.name}. ${res.error}. Do you want to select another file?`,
          title: 'Error Upload File'
        }
      }).afterClosed().subscribe(result => {
        if (result === 'ok') {
          this.uploader.removeFromQueue(item)
        }
      })
    }

    this.uploader.onAfterAddingFile = (item: FileItem)=>{
      if (item.file.type.indexOf('image/') !== -1) return

      this.dialog.open(ContentDialogComponent, {
        width: '600px',
        data: {
          content: `Invalid type file: ${item.file.type}. Do you want to select another file?`,
          title: 'Error Process File'
        }
      }).afterClosed().subscribe(result => {
        if (result === 'ok') {
          this.uploader.removeFromQueue(item)
        }
      })
    }
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

  private renderRestaurantMarkers () {
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

  private restoreDeleted (obj: Restaurant) {
    this.dataSource.data.push(obj)
    this.dataSource.data.sort((a: Restaurant, b: Restaurant) => {
      if (a.no > b.no) return 1
      if (a.no < b.no) return -1
      return 0
    })

    this.rawData.push(obj)
    this.rawData.sort((a: Restaurant, b: Restaurant) => {
      if (a.no > b.no) return 1
      if (a.no < b.no) return -1
      return 0
    })

    this.table.renderRows()
    this.putMarker(obj.latitude, obj.longitude, obj.restaurant)
    this.fitBounds()
  }

  private updateTypes () {
    const list: string[] = []

    this.rawData.map((itm: Restaurant)=>{
      if (list.includes(itm.type)) return

      list.push(itm.type)
    })

    list.sort()

    this.typeList = list
  }
}


@Component({
  selector: 'content-dialog',
  templateUrl: 'content-dialog.component.html'
})
export class ContentDialogComponent {
  constructor (
    public dialogRef: MatDialogRef<ContentDialogComponent>,
    @Inject(MAT_DIALOG_DATA)
    public data: any
  ) { }

  onNoClick (): void {
    this.data.removeFile = false
    this.dialogRef.close()
  }

  onYesClick () {
    this.data.removeFile = true
  }
}
