import type { firestore } from 'firebase-admin';

export async function populateCollection<D>(
  collectionRef: firestore.CollectionReference<D>,
  dataOrGetData: D | (() => D),
  docCount: number
): Promise<firestore.DocumentReference<D>[]> {
  const promises = new Array(docCount).fill(null).map(async () => {
    const data = typeof dataOrGetData === 'function' ? (dataOrGetData as () => D)() : dataOrGetData;
    return await collectionRef.add(data);
  });

  return await Promise.all(promises);
}
