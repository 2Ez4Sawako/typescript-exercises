import { readFile } from 'fs';
export class Database<T> {
    protected filename: string;
    protected fullTextSearchFieldNames: Array<keyof T>;

    constructor(filename: string, fullTextSearchFieldNames: Array<keyof T>) {
        this.filename = filename;
        this.fullTextSearchFieldNames = fullTextSearchFieldNames;
    }

    async find(query: IQuery<T>, options?: FindOptions<T>): Promise<Partial<T>[]> {
        return new Promise((resolve, reject) => {
            readFile(this.filename, ((err, data) => {
                if (!err) {
                    const existings: T[] = data.toString().split('\n')
                        .filter(l => l.charAt(0) === 'E')
                        .map(l => JSON.parse(l.slice(1)));

                    let result: Partial<T>[] = existings.filter((item, i, items) => {
                        return Object.keys(query).every((token, i, arr) => {
                            switch(token) {
                                case '$text':
                                    return this.fullTextSearchFieldNames.map((field) => `${item[field]}`.split(' '))
                                        .some((tokens) => tokens.some((value) => value.toLowerCase() === query.$text?.toLowerCase()));
                                case '$and':
                                    return query.$and?.every(_query => (
                                        Object.keys(_query).every(field => {
                                            return getRunnableFilter(field as keyof T, _query as FieldQuery<T>)(item, i, items);
                                        })
                                    ));
                                case '$or':
                                    return query.$or?.some(_query => (
                                        Object.keys(_query).every(field => {
                                            return getRunnableFilter(field as keyof T, _query as FieldQuery<T>)(item, i, items);
                                        })
                                    ));
                                default:
                                    // criterias && console.log(criterias, this.criterial2Filter(token as keyof T, criterias)(item, i, items));
                                    return getRunnableFilter(token as keyof T, query as FieldQuery<T>)(item, i, items);
                            }
                        })
                    });
                    options && options.sort && this.sort(options.sort, result);
                    options && options.projection && (result = this.projection(options.projection, result));
                    resolve(result);
                } else {
                    reject(new Error('read file error'))
                }
            }))

        });
        return [];
    }
    sort(criterias: SortCriteria<T>, result: Partial<T>[]): void {
        const priorities = Object.keys(criterias) as (keyof T)[];
        result.sort((a, b) => {
            let i:number = 0;
            let swap:(1 | -1) = -1;
            while(i < priorities.length) {
                const field = priorities[i];
                if (a[field] === b[field]) {
                    i ++;
                } else {
                    swap = a[field] > b[field] ? criterias[field] : (-criterias[field] as (1 | -1));
                    i = priorities.length;
                }
            }
            return swap;
        });
    }
    projection (projections: ProjectionCriteria<T>, result: Partial<T>[]): Partial<T>[] {
        const fields = Object.keys(projections) as (keyof T)[];
        return result.map(item => (
            Object.keys(item)
                .reduce((newObj: Partial<T>, field) => fields.includes(field as keyof T) ? ({
                    ...newObj,
                    [field]: item[field as keyof T],
                }) : newObj, {} as Partial<T>)
            )
        );
    }
}

function fail(...args: any[]): boolean {
    return false;
}

function getRunnableFilter<F extends keyof T, T extends {}>(field: F, query: FieldQuery<T>): ((item: T, i: number, array: T[]) => boolean) | (() => boolean){
    const filter = getFilter(field, query);
    return filter || fail;
}

function getFilter<F extends keyof T, T extends {}>(field: F, query: FieldQuery<T>): ((item: T, i: number, array: T[]) => boolean) | null {
    const criteria: FindCriteria<T[F]> | undefined = query[field];
    if (!criteria) return null;
    return (item: T, i: number, array: T[]) => Object.keys(criteria).every(key => {
        switch (key) {
            case '$eq':
                return item[field] === criteria.$eq;
            case '$gt':
                return criteria.$gt && item[field] > criteria.$gt;
            case '$lt':
                return criteria.$lt && item[field] < criteria.$lt;
            case '$in':
                return criteria.$in && criteria.$in.includes(item[field]);
            default:
                return false;
        }
    });
}

type FindOptions<T> = {
    projection?: ProjectionCriteria<T>
    sort?: SortCriteria<T>
}

type SortCriteria<T extends {}> = {
    [P in keyof Partial<T>]: 1 | -1
}

type ProjectionCriteria<T extends {}> = {
    [P in keyof Partial<T>]: 1
};

type FindCriteria<T> = {
    $eq?: T
    $gt?: T
    $lt?: T
    $in?: T[]
}

type FieldQuery<T extends {}> = {
    [P in keyof Partial<T>]: FindCriteria<T[P]>
};

type IQuery<T> = FieldQuery<T> & {
    '$text'?: string
    '$or'?: FieldQuery<T>[]
    '$and'?: FieldQuery<T>[]
};