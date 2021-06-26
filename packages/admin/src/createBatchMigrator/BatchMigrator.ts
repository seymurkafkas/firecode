import type { firestore } from 'firebase-admin';
import type { Traverser } from '../Traverser';
import { Migrator } from '../Migrator';
import type {
  BaseTraversalConfig,
  MigrationPredicate,
  UpdateDataGetter,
  SetDataGetter,
  SetPartialDataGetter,
  SetOptions,
  MigrationResult,
} from '../types';
import { validateConfig } from './validateConfig';

export class BatchMigrator<
  D extends firestore.DocumentData,
  C extends BaseTraversalConfig,
  T extends Traverser<D, C>
> extends Migrator<D, C> {
  public constructor(
    public readonly traverser: T,
    private migrationPredicate: MigrationPredicate<D> = () => true
  ) {
    super();
    validateConfig(traverser.traversalConfig);
  }

  /**
   * Applies a migration predicate that returns a boolean indicating whether to migrate the current document.
   * If this is not provided, all documents will be migrated.
   *
   * @param predicate A function that takes a document snapshot and returns a boolean indicating whether to migrate it.
   * @returns A new BatchMigrator object.
   */
  public withPredicate(predicate: MigrationPredicate<D>): BatchMigrator<D, C, T> {
    return new BatchMigrator(this.traverser, predicate);
  }

  /**
   * Sets all documents in this collection with the provided data.
   *
   * **Properties:**
   *
   * - Time complexity: _TC_(`traverser`) where _C_ = _W_(`batchSize`)
   * - Space complexity: _SC_(`traverser`) where _S_ = _O_(`batchSize`)
   * - Billing: _N_ reads, _K_ writes
   *
   * where:
   *
   * - _N_: number of docs in the traversable
   * - _K_: number of docs that passed the migration predicate (_K_<=_N_)
   * - _W_(`batchSize`): average batch write time
   * - _TC_(`traverser`): time complexity of the underlying traverser
   * - _SC_(`traverser`): space complexity of the underlying traverser
   *
   * @param data - The data with which to set each document.
   * @param options - An object to configure the set behavior.
   * @returns A Promise resolving to an object representing the details of the migration.
   */
  public set(data: Partial<D>, options: SetOptions): Promise<MigrationResult>;

  /**
   * Sets all documents in this collection with the provided data.
   *
   * **Properties:**
   *
   * - Time complexity: _TC_(`traverser`) where _C_ = _W_(`batchSize`)
   * - Space complexity: _SC_(`traverser`) where _S_ = _O_(`batchSize`)
   * - Billing: _N_ reads, _K_ writes
   *
   * where:
   *
   * - _N_: number of docs in the traversable
   * - _K_: number of docs that passed the migration predicate (_K_<=_N_)
   * - _W_(`batchSize`): average batch write time
   * - _TC_(`traverser`): time complexity of the underlying traverser
   * - _SC_(`traverser`): space complexity of the underlying traverser
   *
   * @param data - The data with which to set each document.
   * @returns A Promise resolving to an object representing the details of the migration.
   */
  public set(data: D): Promise<MigrationResult>;

  /**
   * Sets all documents in this collection with the provided data.
   *
   * **Properties:**
   *
   * - Time complexity: _TC_(`traverser`) where _C_ = _W_(`batchSize`)
   * - Space complexity: _SC_(`traverser`) where _S_ = _O_(`batchSize`)
   * - Billing: _N_ reads, _K_ writes
   *
   * where:
   *
   * - _N_: number of docs in the traversable
   * - _K_: number of docs that passed the migration predicate (_K_<=_N_)
   * - _W_(`batchSize`): average batch write time
   * - _TC_(`traverser`): time complexity of the underlying traverser
   * - _SC_(`traverser`): space complexity of the underlying traverser
   *
   * @param getData - A function that returns an object with which to set each document.
   * @param options - An object to configure the set behavior.
   * @returns A Promise resolving to an object representing the details of the migration.
   */
  public set(getData: SetPartialDataGetter<D>, options: SetOptions): Promise<MigrationResult>;

  /**
   * Sets all documents in this collection with the provided data.
   *
   * **Properties:**
   *
   * - Time complexity: _TC_(`traverser`) where _C_ = _W_(`batchSize`)
   * - Space complexity: _SC_(`traverser`) where _S_ = _O_(`batchSize`)
   * - Billing: _N_ reads, _K_ writes
   *
   * where:
   *
   * - _N_: number of docs in the traversable
   * - _K_: number of docs that passed the migration predicate (_K_<=_N_)
   * - _W_(`batchSize`): average batch write time
   * - _TC_(`traverser`): time complexity of the underlying traverser
   * - _SC_(`traverser`): space complexity of the underlying traverser
   *
   * @param getData - A function that returns an object with which to set each document.
   * @returns A Promise resolving to an object representing the details of the migration.
   */
  public set(getData: SetDataGetter<D>): Promise<MigrationResult>;

  public async set(
    dataOrGetData: SetDataGetter<D> | SetPartialDataGetter<D> | D | Partial<D>,
    options?: SetOptions
  ): Promise<MigrationResult> {
    let migratedDocCount = 0;

    const { batchCount, docCount: traversedDocCount } = await this.traverser.traverse(
      async (snapshots, batchIndex) => {
        this.registeredCallbacks.onBeforeBatchStart?.(snapshots, batchIndex);

        const writeBatch = this.traverser.traversable.firestore.batch();
        let migratableDocCount = 0;

        snapshots.forEach((snapshot) => {
          const shouldMigrate = this.migrationPredicate(snapshot);

          if (!shouldMigrate) {
            return;
          }

          migratableDocCount++;

          if (typeof dataOrGetData === 'function') {
            if (options === undefined) {
              // Signature 1
              const getData = dataOrGetData as SetDataGetter<D>;
              const data = getData(snapshot);
              writeBatch.set(snapshot.ref, data);
            } else {
              // Signature 2
              const getData = dataOrGetData as SetPartialDataGetter<D>;
              const data = getData(snapshot);
              writeBatch.set(snapshot.ref, data, options);
            }
          } else {
            if (options === undefined) {
              // Signature 3
              const data = dataOrGetData as D;
              writeBatch.set(snapshot.ref, data);
            } else {
              // Signature 4
              const data = dataOrGetData as Partial<D>;
              writeBatch.set(snapshot.ref, data, options);
            }
          }
        });

        await writeBatch.commit();
        migratedDocCount += migratableDocCount;

        this.registeredCallbacks.onAfterBatchComplete?.(snapshots, batchIndex);
      }
    );

    return { batchCount, traversedDocCount, migratedDocCount };
  }

  /**
   * Updates all documents in this collection with the provided data.
   *
   * **Properties:**
   *
   * - Time complexity: _TC_(`traverser`) where _C_ = _W_(`batchSize`)
   * - Space complexity: _SC_(`traverser`) where _S_ = _O_(`batchSize`)
   * - Billing: _N_ reads, _K_ writes
   *
   * where:
   *
   * - _N_: number of docs in the traversable
   * - _K_: number of docs that passed the migration predicate (_K_<=_N_)
   * - _W_(`batchSize`): average batch write time
   * - _TC_(`traverser`): time complexity of the underlying traverser
   * - _SC_(`traverser`): space complexity of the underlying traverser
   *
   * @param getData - A function that returns the data with which to update each document.
   * @returns A Promise resolving to an object representing the details of the migration.
   */
  public update(getData: UpdateDataGetter<D>): Promise<MigrationResult>;

  /**
   * Updates all documents in this collection with the provided data.
   *
   * **Properties:**
   *
   * - Time complexity: _TC_(`traverser`) where _C_ = _W_(`batchSize`)
   * - Space complexity: _SC_(`traverser`) where _S_ = _O_(`batchSize`)
   * - Billing: _N_ reads, _K_ writes
   *
   * where:
   *
   * - _N_: number of docs in the traversable
   * - _K_: number of docs that passed the migration predicate (_K_<=_N_)
   * - _W_(`batchSize`): average batch write time
   * - _TC_(`traverser`): time complexity of the underlying traverser
   * - _SC_(`traverser`): space complexity of the underlying traverser
   *
   * @param data - The data with which to update each document. Must be a non-empty object.
   * @returns A Promise resolving to an object representing the details of the migration.
   */
  public update(data: firestore.UpdateData): Promise<MigrationResult>;

  /**
   * Updates all documents in this collection with the provided field-value pair.
   *
   * **Properties:**
   *
   * - Time complexity: _TC_(`traverser`) where _C_ = _W_(`batchSize`)
   * - Space complexity: _SC_(`traverser`) where _S_ = _O_(`batchSize`)
   * - Billing: _N_ reads, _K_ writes
   *
   * where:
   *
   * - _N_: number of docs in the traversable
   * - _K_: number of docs that passed the migration predicate (_K_<=_N_)
   * - _W_(`batchSize`): average batch write time
   * - _TC_(`traverser`): time complexity of the underlying traverser
   * - _SC_(`traverser`): space complexity of the underlying traverser
   *
   * @param field - The field to update in each document.
   * @param value - The value with which to update the specified field in each document. Must not be `undefined`.
   * @returns A Promise resolving to an object representing the details of the migration.
   */
  public update(field: string | firestore.FieldPath, value: any): Promise<MigrationResult>;

  public async update(
    arg1: firestore.UpdateData | string | firestore.FieldPath | UpdateDataGetter<D>,
    arg2?: any
  ): Promise<MigrationResult> {
    const argCount = [arg1, arg2].filter((a) => a !== undefined).length;
    let migratedDocCount = 0;

    const { batchCount, docCount: traversedDocCount } = await this.traverser.traverse(
      async (snapshots) => {
        const writeBatch = this.traverser.traversable.firestore.batch();
        let migratableDocCount = 0;

        snapshots.forEach((snapshot) => {
          if (typeof arg1 === 'function') {
            // Signature 1
            const getUpdateData = arg1 as UpdateDataGetter<D>;
            const shouldMigrate = this.migrationPredicate(snapshot);
            if (shouldMigrate) {
              writeBatch.update(snapshot.ref, getUpdateData(snapshot));
              migratableDocCount++;
            }
          } else if (argCount === 1) {
            // Signature 2
            const updateData = arg1 as firestore.UpdateData;
            const shouldMigrate = this.migrationPredicate(snapshot);
            if (shouldMigrate) {
              writeBatch.update(snapshot.ref, updateData);
              migratableDocCount++;
            }
          } else {
            // Signature 3
            const field = arg1 as string | firestore.FieldPath;
            const value = arg2 as any;
            const shouldMigrate = this.migrationPredicate(snapshot);
            if (shouldMigrate) {
              writeBatch.update(snapshot.ref, field, value);
              migratableDocCount++;
            }
          }
        });

        await writeBatch.commit();
        migratedDocCount += migratableDocCount;
      }
    );

    return { batchCount, traversedDocCount, migratedDocCount };
  }
}
