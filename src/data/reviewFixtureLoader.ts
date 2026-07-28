import reviewItems from '../../data/working/review-fixtures/part4-v1/review-items.json'
import {
  part4ReviewItemsSchema,
  type Part4ReviewItem,
} from '../domain/dataReview'

let cachedItems: Part4ReviewItem[] | undefined

export function loadPart4ReviewItems(): Part4ReviewItem[] {
  cachedItems ??= part4ReviewItemsSchema.parse(reviewItems) as Part4ReviewItem[]
  return cachedItems
}
