"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

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
var defaultOptions = {
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
    meta: null
  },
  collation: {},
  lean: false,
  leanWithId: true,
  limit: 10,
  projection: {},
  select: '',
  options: {},
  customFind: 'find'
};

function paginate(query, options, callback) {
  options = _objectSpread({}, defaultOptions, {}, paginate.options, {}, options);
  query = query || {};
  var _options = options,
      collation = _options.collation,
      lean = _options.lean,
      leanWithId = _options.leanWithId,
      populate = _options.populate,
      projection = _options.projection,
      select = _options.select,
      sort = _options.sort,
      customFind = _options.customFind;

  var customLabels = _objectSpread({}, defaultOptions.customLabels, {}, options.customLabels);

  var limit = parseInt(options.limit, 10) || 0;
  var isCallbackSpecified = typeof callback === 'function';
  var findOptions = options.options;
  var offset;
  var page;
  var skip;
  var docsPromise = [];
  var docs = []; // Labels

  var labelDocs = customLabels.docs;
  var labelLimit = customLabels.limit;
  var labelNextPage = customLabels.nextPage;
  var labelPage = customLabels.page;
  var labelPagingCounter = customLabels.pagingCounter;
  var labelPrevPage = customLabels.prevPage;
  var labelTotal = customLabels.totalDocs;
  var labelTotalPages = customLabels.totalPages;
  var labelHasPrevPage = customLabels.hasPrevPage;
  var labelHasNextPage = customLabels.hasNextPage;
  var labelMeta = customLabels.meta;

  if (options.hasOwnProperty('offset')) {
    offset = parseInt(options.offset, 10);
    skip = offset;
  } else if (options.hasOwnProperty('page')) {
    page = parseInt(options.page, 10);
    skip = (page - 1) * limit;
  } else {
    offset = 0;
    page = 1;
    skip = offset;
  }

  var countPromise = this[customFind](query).exec();

  if (limit) {
    var mQuery = this[customFind](query, projection, findOptions);
    mQuery.select(select);
    mQuery.sort(sort);
    mQuery.lean(lean); // Hack for mongo < v3.4

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
      docsPromise = docsPromise.then(function (docs) {
        docs.forEach(function (doc) {
          doc.id = String(doc._id);
        });
        return docs;
      });
    }
  }

  return Promise.all([countPromise, docsPromise]).then(function (values) {
    // const [count, docs] = values;
    var count = values[0].length;
    var docs = values[1];
    var meta = {
      [labelTotal]: count,
      [labelLimit]: limit
    };
    var result = {};

    if (typeof offset !== 'undefined') {
      meta.offset = offset;
    }

    if (typeof page !== 'undefined') {
      var pages = limit > 0 ? Math.ceil(count / limit) || 1 : null;
      meta[labelHasPrevPage] = false;
      meta[labelHasNextPage] = false;
      meta[labelPage] = page;
      meta[labelTotalPages] = pages;
      meta[labelPagingCounter] = (page - 1) * limit + 1; // Set prev page

      if (page > 1) {
        meta[labelHasPrevPage] = true;
        meta[labelPrevPage] = page - 1;
      } else {
        meta[labelPrevPage] = null;
      } // Set next page


      if (page < pages) {
        meta[labelHasNextPage] = true;
        meta[labelNextPage] = page + 1;
      } else {
        meta[labelNextPage] = null;
      }
    } // Remove customLabels set to false


    delete meta['false'];

    if (labelMeta) {
      result = {
        [labelDocs]: docs,
        [labelMeta]: meta
      };
    } else {
      result = _objectSpread({
        [labelDocs]: docs
      }, meta);
    }

    return isCallbackSpecified ? callback(null, result) : Promise.resolve(result);
  }).catch(function (error) {
    return isCallbackSpecified ? callback(error) : Promise.reject(error);
  });
}
/**
 * @param {Schema} schema
 */


module.exports = function (schema) {
  schema.statics.paginate = paginate;
};

module.exports.paginate = paginate;