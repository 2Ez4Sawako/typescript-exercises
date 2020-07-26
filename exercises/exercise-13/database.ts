import { readFile } from 'fs';
export class Database<T> {
    protected filename: string;
    protected fullTextSearchFieldNames: Array<keyof T>;

    constructor(filename: string, fullTextSearchFieldNames: Array<keyof T>) {
        this.filename = filename;
        this.fullTextSearchFieldNames = fullTextSearchFieldNames;
    }

    async find(query: IQuery<T>): Promise<T[]> {
        return new Promise((resolve, reject) => {
            readFile(this.filename, ((err, data) => {
                if (!err) {
                    const existings: T[] = data.toString().split('\n')
                        .filter(l => l.charAt(0) === 'E')
                        .map(l => JSON.parse(l.slice(1)));

                    resolve(existings.filter((item, i, items) => {
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
                    }));
                } else {
                    reject(new Error('read file error'))
                }
            }))

        });
        
        return [];
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

type FindCriteria<T> = {
    $eq?: T;
    $gt?: T;
    $lt?: T;
    $in?: T[];
}

type FieldQuery<T extends {}> = {
    [P in keyof T]?: FindCriteria<T[P]>
};

type IQuery<T> = FieldQuery<T> & {
    '$text'?: string;
    '$or'?: FieldQuery<T>[];
    '$and'?: FieldQuery<T>[];
};