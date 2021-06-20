import { Injectable } from '@angular/core'
import { ApolloQueryResult } from '@apollo/client/core'
import { Apollo, gql } from 'apollo-angular'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { Restaurant } from './app.component'


interface iRestaurant extends Restaurant {
  _id: string
  _ref: number
}

@Injectable()
export class ApiService {
  constructor (
    private apollo: Apollo
  ) { }

  create (data: Restaurant): Observable<any> {
    const { image, latitude, longitude, restaurant: name, type }= data

    return this.apollo.mutate({
      mutation: gql`
        mutation CreateRestaurant ($input: CreateRestaurantInput!) {
          createRestaurant (input: $input) {
            _id
            _ref
          }
        }`,
      variables: {
        input: { image, latitude, longitude, name, type }
      }
    })
  }

  getData (): Observable<ApolloQueryResult<{ restaurants: iRestaurant[] }>> {
    return this.apollo.watchQuery<{ restaurants: iRestaurant[] }>({
      query: gql`
        {
          restaurants {
            _id
            _ref
            image
            latitude
            longitude
            restaurant: name
            type
          }
        }`,
      errorPolicy: 'all'
    }).valueChanges.pipe(
      map(res => {
        const restaurants: any = []

        res.data.restaurants.map(itm => {
          const { _id, _ref, image, latitude, longitude, restaurant, type } = itm
          const coordinate = `${itm.latitude}, ${itm.longitude}`

          restaurants.push({ coordinate, delete: _id, image, latitude, longitude, no: _ref, restaurant, type })
        })

        return {
          ...res,
          data: { restaurants }
        }
      })
    )
  }

  remove (_id: string): Observable<any> {
    return this.apollo.mutate({
      mutation: gql`
        mutation RemoveRestaurant ($_id: ObjectId!) {
          removeRestaurant (_id: $_id) {
            _id
            _ref
          }
        }`,
      variables: { _id }
    })
  }

  restore (_id: string): Observable<any> {
    return this.apollo.mutate({
      mutation: gql`
        mutation RestoreRestaurant ($_id: ObjectId!) {
          restoreRestaurant (_id: $_id) {
            _id
            _ref
          }
        }`,
      variables: { _id }
    })
  }
}
