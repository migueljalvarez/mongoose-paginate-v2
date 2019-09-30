/**
 * @param {Object}              [query={}]
 * @param {Object}              [options={}]
 * @param {Object|String}       [options.select='']
 * @param {Object|String}       [options.projection={}]
 * @param {Object}              [options.options={}]
 * @param {Object|String}       [options.sort]
 * @param {Object|String}       [options.customLabels]
 * @param {Object}              [options.collation]
 * @param {Array|Object|String} [options.populate]
 * @param {Boolean}             [options.lean=false]
 * @param {Boolean}             [options.leanWithId=true]
 * @param {Number}              [options.offset=0] - Use offset or page to set skip position
 * @param {Number}              [options.page=1]
 * @param {Number}              [options.limit=10]
 * @param {Function}            [callback]
 *
 * @returns {Promise}
 */

const defaultOptions = {
  customLabels: {
    totalDocs: 'totalDocs',
    limit: 'limit',
    page: 'page',
    totalPages: 'totalPages',
    docs: 'docs',
    nextPage: 'nextPage',
    prevPage: 'prevPage',
    pagingCounter: 'pagingCounter',
    hasPrevPage: 'hasPrevPage',
    hasNextPage: 'hasNextPage',
    meta: null,
  },
  collation: {},
  lean: false,
  leanWithId: true,
  limit: 10,
  projection: {},
  select: '',
  options: {},
  customFind: 'find',
};

function paginate(query, options, callback) {
  options = {
    ...defaultOptions,
    ...paginate.options,
    ...options
  };
  query = query || {};

  const {
    collation,
    lean,
    leanWithId,
    populate,
    projection,
    select,
    sort,
    customFind,
  } = options;

  const customLabels = {
    ...defaultOptions.customLabels,
    ...options.customLabels
  };

  const limit = parseInt(options.limit, 10) || 0;

  const isCallbackSpecified = typeof callback === 'function';
  const findOptions = options.options;

  let offset;
  let page;
  let skip;

  let docsPromise = [];

  // Labels
  const labelDocs = customLabels.docs;
  const labelLimit = customLabels.limit;
  const labelNextPage = customLabels.nextPage;
  const labelPage = customLabels.page;
  const labelPagingCounter = customLabels.pagingCounter;
  const labelPrevPage = customLabels.prevPage;
  const labelTotal = customLabels.totalDocs;
  const labelTotalPages = customLabels.totalPages;
  const labelHasPrevPage = customLabels.hasPrevPage;
  const labelHasNextPage = customLabels.hasNextPage;
  const labelMeta = customLabels.meta;

  if (Object.prototype.hasOwnProperty.call(options, 'offset')) {
    offset = parseInt(options.offset, 10);
    skip = offset;
  } else if (Object.prototype.hasOwnProperty.call(options, 'page')) {
    page = parseInt(options.page, 10);
    skip = (page - 1) * limit;
  } else {
    offset = 0;
    page = 1;
    skip = offset;
  }

  const countPromise = this[customFind](query).exec();

  if (limit) {
    const mQuery = this[customFind](query, projection, findOptions);
    mQuery.select(select);
    mQuery.sort(sort);
    mQuery.lean(lean);

    // Hack for mongo < v3.4
    if (Object.keys(collation).length > 0) {
      mQuery.collation(collation);
    }

    mQuery.skip(skip);
    mQuery.limit(limit);

    if (populate) {
      mQuery.populate(populate);
    }

    docsPromise = mQuery.exec();

    if (lean && leanWithId) {
      docsPromise = docsPromise.then((docs) => {
        docs.forEach((doc) => {
          doc.id = String(doc._id);
        });
        return docs;
      });
    }
  }

  return Promise.all([countPromise, docsPromise])
    .then((values) => {

      // const [count, docs] = values;

      const count = values[0].length;
      const docs = values[1];

      if(populate && Array.isArray(populate)) {
        for (let j = 0; j < docs.length; j++) {
          for (let i = 0; i < populate.length; i++) {
            if (populate[i] && populate[i].path && !this.schema.virtuals[populate[i].path].options.justOne) {
              const documentObject = docs[j].toObject();
              documentObject[populate[i].path] = undefined;
              documentObject[populate[i].path] = paginatePopulate(docs[j][populate[i].path], options.populateOptions && options.populateOptions[populate[i].path]);
              docs[j] = documentObject;
            }
          }
        }
      } else if(populate && typeof populate === 'object') {
        for (let i = 0; i < docs.length; i++) {
          docs[i][populate.path] = paginatePopulate(docs[i][populate.path], options.populateOptions && options.populateOptions[populate.path]);
        }
      }

      const meta = {
        [labelTotal]: count,
        [labelLimit]: parseInt(limit, 10),
      };
      let result = {};

      if (typeof offset !== 'undefined') {
        meta.offset = parseInt(offset, 10);
      }

      if (typeof page !== 'undefined') {

        const pages = (limit > 0) ? (Math.ceil(count / limit) || 1) : null;

        meta[labelHasPrevPage] = false;
        meta[labelHasNextPage] = false;
        meta[labelPage] = page;
        meta[labelTotalPages] = pages;
        meta[labelPagingCounter] = ((page - 1) * limit) + 1;

        // Set prev page
        if (page > 1) {
          meta[labelHasPrevPage] = true;
          meta[labelPrevPage] = (page - 1);
        } else {
          meta[labelPrevPage] = null;
        }

        // Set next page
        if (page < pages) {
          meta[labelHasNextPage] = true;
          meta[labelNextPage] = (page + 1);
        } else {
          meta[labelNextPage] = null;
        }
      }

      // Remove customLabels set to false
      delete meta['false'];

      if (labelMeta) {
        result = {
          [labelDocs]: docs,
          [labelMeta]: meta
        };
      } else {
        result = {
          [labelDocs]: docs,
          ...meta
        };
      }
      return isCallbackSpecified ? callback(null, result) : Promise.resolve(result);
    }).catch((error) => {
      return isCallbackSpecified ? callback(error) : Promise.reject(error);
    });
}

function paginatePopulate(populateArray = [], {
  limit = 10,
  offset = 0,
} = {}) {
  const customLabels = {
    ...defaultOptions.customLabels,
  };

  const labelDocs = customLabels.docs;
  const labelLimit = customLabels.limit;
  const labelTotal = customLabels.totalDocs;
  const labelMeta = customLabels.meta;
  const paginated = paginator(populateArray, offset, limit);
  const count = paginated.totalDocs;
  const docs = paginated.docs;
  const meta = {
    [labelTotal]: count,
    [labelLimit]: parseInt(limit, 10),
  };
  let result = {};

  if (typeof offset !== 'undefined') {
    meta.offset = parseInt(offset, 10);
  }

  // Remove customLabels set to false
  delete meta['false'];

  if (labelMeta) {
    result = {
      [labelDocs]: docs,
      [labelMeta]: meta
    };
  } else {
    result = {
      [labelDocs]: docs,
      ...meta
    };
  }
  return result;
}

function paginator(items = [], offset = 0, limit = 10) {
  return {
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    totalDocs: parseInt(items.length, 10),
    docs: items.slice(offset).slice(0, limit),
  };
}

/**
 * @param {Schema} schema
 */
module.exports = (schema) => {
  schema.statics.paginate = paginate;
};

module.exports.paginate = paginate;
