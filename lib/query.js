'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * There are two ways to instantiate this class:
 *
 *      // 1. Using a Query Builder
 *      var queryBuilder = QueryBuilder.conversations().sortBy('lastMessage');
 *      var query = client.createQuery(queryBuilder);
 *
 *      // 2. Passing properties directly
 *      var query = client.createQuery({
 *        client: client,
 *        model: layer.Query.Conversation,
 *        sortBy: [{'createdAt': 'desc'}]
 *      });
 *
 * You can change the data selected by your query any time you want using:
 *
 *      query.update({
 *        paginationWindow: 200
 *      });
 *
 *      query.update({
 *        predicate: 'conversation.id = "' + conv.id + "'"
 *      });
 *
 *     // Or use the Query Builder:
 *     queryBuilder.paginationWindow(200);
 *     query.update(queryBuilder);
 *
 * You can release Conversations and Messages held in memory by your queries when done with them:
 *
 *      query.destroy();
 *
 * #### predicate
 *
 * Note that the `predicate` property is only supported for Messages, and only supports
 * querying by Conversation: `conversation.id = 'layer:///conversations/UUIUD'`
 *
 * #### sortBy
 *
 * Note that the `sortBy` property is only supported for Conversations at this time and only
 * supports "createdAt" and "lastMessage.sentAt" as sort fields.
 *
 * #### dataType
 *
 * The layer.Query.dataType property lets you specify what type of data shows up in your results:
 *
 * ```javascript
 * var query = client.createQuery({
 *     model: layer.Query.Message,
 *     predicate: "conversation.id = 'layer:///conversations/uuid'",
 *     dataType: layer.Query.InstanceDataType
 * })
 *
 * var query = client.createQuery({
 *     model: layer.Query.Message,
 *     predicate: "conversation.id = 'layer:///conversations/uuid'",
 *     dataType: layer.Query.ObjectDataType
 * })
 * ```
 *
 * The property defaults to layer.Query.InstanceDataType.  Instances support methods and let you subscribe to events for direct notification
 * of changes to any of the results of your query:
 *
* ```javascript
 * query.data[0].on('messages:change', function(evt) {
 *     alert('The first message has had a property change; probably isRead or recipient_status!');
 * });
 * ```
 *
 * A value of layer.Query.ObjectDataType will cause the data to be an array of immutable objects rather than instances.  One can still get an instance from the POJO:
 *
 * ```javascript
 * var m = client.getMessage(query.data[0].id);
 * m.on('messages:change', function(evt) {
 *     alert('The first message has had a property change; probably isRead or recipient_status!');
 * });
 * ```
 *
 * ## Query Events
 *
 * Queries fire events whenever their data changes.  There are 5 types of events;
 * all events are received by subscribing to the `change` event.
 *
 * ### 1. Data Events
 *
 * The Data event is fired whenever a request is sent to the server for new query results.  This could happen when first creating the query, when paging for more data, or when changing the query's properties, resulting in a new request to the server.
 *
 * The Event object will have an `evt.data` array of all newly added results.  But frequently you may just want to use the `query.data` array and get ALL results.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'data') {
 *      var newData = evt.data;
 *      var allData = query.data;
 *   }
 * });
 * ```
 *
 * Note that `query.on('change:data', function(evt) {}` is also supported.
 *
 * ### 2. Insert Events
 *
 * A new Conversation or Message was created. It may have been created locally by your user, or it may have been remotely created, received via websocket, and added to the Query's results.
 *
 * The layer.LayerEvent.target property contains the newly inserted object.
 *
 * ```javascript
 *  query.on('change', function(evt) {
 *    if (evt.type === 'insert') {
 *       var newItem = evt.target;
 *       var allData = query.data;
 *    }
 *  });
 * ```
 *
 * Note that `query.on('change:insert', function(evt) {}` is also supported.
 *
 * ### 3. Remove Events
 *
 * A Conversation or Message was deleted. This may have been deleted locally by your user, or it may have been remotely deleted, a notification received via websocket, and removed from the Query results.
 *
 * The layer.LayerEvent.target property contains the removed object.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'remove') {
 *       var removedItem = evt.target;
 *       var allData = query.data;
 *   }
 * });
 * ```
 *
 * Note that `query.on('change:remove', function(evt) {}` is also supported.
 *
 * ### 4. Reset Events
 *
 * Any time your query's model or predicate properties have been changed
 * the query is reset, and a new request is sent to the server.  The reset event informs your UI that the current result set is empty, and that the reason its empty is that it was `reset`.  This helps differentiate it from a `data` event that returns an empty array.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'reset') {
 *       var allData = query.data; // []
 *   }
 * });
 * ```
 *
 * Note that `query.on('change:reset', function(evt) {}` is also supported.
 *
 * ### 5. Property Events
 *
 * If any properties change in any of the objects listed in your layer.Query.data property, a `property` event will be fired.
 *
 * The layer.LayerEvent.target property contains object that was modified.
 *
 * See layer.LayerEvent.changes for details on how changes are reported.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'property') {
 *       var changedItem = evt.target;
 *       var isReadChanges = evt.getChangesFor('isRead');
 *       var recipientStatusChanges = evt.getChangesFor('recipientStatus');
 *       if (isReadChanges.length) {
 *           ...
 *       }
 *
 *       if (recipientStatusChanges.length) {
 *           ...
 *       }
 *   }
 * });
 *```
 * Note that `query.on('change:property', function(evt) {}` is also supported.
 *
 * ### 6. Move Events
 *
 * Occasionally, a property change will cause an item to be sorted differently, causing a Move event.
 * The event will tell you what index the item was at, and where it has moved to in the Query results.
 * This is currently only supported for Conversations.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'move') {
 *       var changedItem = evt.target;
 *       var oldIndex = evt.fromIndex;
 *       var newIndex = evt.newIndex;
 *       var moveNode = list.childNodes[oldIndex];
 *       list.removeChild(moveNode);
 *       list.insertBefore(moveNode, list.childNodes[newIndex]);
 *   }
 * });
 *```
 * Note that `query.on('change:move', function(evt) {}` is also supported.
 *
 * @class  layer.Query
 * @extends layer.Root
 *
 */
var Root = require('./root');
var LayerError = require('./layer-error');
var Util = require('./client-utils');
var Logger = require('./logger');

var _require = require('./const'),
    SYNC_STATE = _require.SYNC_STATE;

var CONVERSATION = 'Conversation';
var MESSAGE = 'Message';
var ANNOUNCEMENT = 'Announcement';
var IDENTITY = 'Identity';
var findConvIdRegex = new RegExp(/^conversation.id\s*=\s*['"]((layer:\/\/\/conversations\/)?.{8}-.{4}-.{4}-.{4}-.{12})['"]$/);

var Query = function (_Root) {
  _inherits(Query, _Root);

  function Query() {
    _classCallCheck(this, Query);

    var options = void 0;

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    if (args.length === 2) {
      options = args[1].build();
      options.client = args[0];
    } else {
      options = args[0];
    }

    var _this = _possibleConstructorReturn(this, (Query.__proto__ || Object.getPrototypeOf(Query)).call(this, options));

    _this.predicate = _this._fixPredicate(options.predicate || '');

    if ('paginationWindow' in options) {
      var paginationWindow = options.paginationWindow;
      _this.paginationWindow = Math.min(_this._getMaxPageSize(), options.paginationWindow);
      if (options.paginationWindow !== paginationWindow) {
        Logger.warn('paginationWindow value ' + paginationWindow + ' in Query constructor ' + ('excedes Query.MaxPageSize of ' + _this._getMaxPageSize()));
      }
    }

    _this.data = [];
    _this._initialPaginationWindow = _this.paginationWindow;
    if (!_this.client) throw new Error(LayerError.dictionary.clientMissing);
    _this.client.on('all', _this._handleChangeEvents, _this);

    if (!_this.client.isReady) {
      _this.client.once('ready', function () {
        return _this._run();
      }, _this);
    } else {
      _this._run();
    }
    return _this;
  }

  /**
   * Cleanup and remove this Query, its subscriptions and data.
   *
   * @method destroy
   */


  _createClass(Query, [{
    key: 'destroy',
    value: function destroy() {
      this.data = [];
      this._triggerChange({
        type: 'data',
        target: this.client,
        query: this,
        isChange: false,
        data: []
      });
      this.client.off(null, null, this);
      this.client._removeQuery(this);
      this.data = null;
      _get(Query.prototype.__proto__ || Object.getPrototypeOf(Query.prototype), 'destroy', this).call(this);
    }

    /**
     * Get the maximum number of items allowed in a page
     *
     * @method _getMaxPageSize
     * @private
     * @returns {number}
     */

  }, {
    key: '_getMaxPageSize',
    value: function _getMaxPageSize() {
      return this.model === Query.Identity ? Query.MaxPageSizeIdentity : Query.MaxPageSize;
    }

    /**
     * Updates properties of the Query.
     *
     * Currently supports updating:
     *
     * * paginationWindow
     * * predicate
     * * model
     *
     * Any change to predicate or model results in clearing all data from the
     * query's results and triggering a change event with [] as the new data.
     *
     * @method update
     * @param  {Object} options
     * @param {string} [options.predicate] - A new predicate for the query
     * @param {string} [options.model] - A new model for the Query
     * @param {number} [paginationWindow] - Increase/decrease our result size to match this pagination window.
     * @return {layer.Query} this
     */

  }, {
    key: 'update',
    value: function update() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      var needsRefresh = void 0,
          needsRecreate = void 0;

      var optionsBuilt = typeof options.build === 'function' ? options.build() : options;

      if ('paginationWindow' in optionsBuilt && this.paginationWindow !== optionsBuilt.paginationWindow) {
        this.paginationWindow = Math.min(this._getMaxPageSize() + this.size, optionsBuilt.paginationWindow);
        if (this.paginationWindow < optionsBuilt.paginationWindow) {
          Logger.warn('paginationWindow value ' + optionsBuilt.paginationWindow + ' in Query.update() ' + ('increases size greater than Query.MaxPageSize of ' + this._getMaxPageSize()));
        }
        needsRefresh = true;
      }
      if ('model' in optionsBuilt && this.model !== optionsBuilt.model) {
        this.model = optionsBuilt.model;
        needsRecreate = true;
      }

      if ('predicate' in optionsBuilt) {
        var predicate = this._fixPredicate(optionsBuilt.predicate || '');
        if (this.predicate !== predicate) {
          this.predicate = predicate;
          needsRecreate = true;
        }
      }
      if ('sortBy' in optionsBuilt && JSON.stringify(this.sortBy) !== JSON.stringify(optionsBuilt.sortBy)) {
        this.sortBy = optionsBuilt.sortBy;
        needsRecreate = true;
      }
      if (needsRecreate) {
        this._reset();
      }
      if (needsRecreate || needsRefresh) this._run();
      return this;
    }

    /**
     * Normalizes the predicate.
     *
     * @method _fixPredicate
     * @param {String} inValue
     * @private
     */

  }, {
    key: '_fixPredicate',
    value: function _fixPredicate(inValue) {
      if (inValue === '') return '';
      if (this.model === Query.Message) {
        var conversationId = inValue.match(findConvIdRegex) ? inValue.replace(findConvIdRegex, '$1') : null;
        if (!conversationId) throw new Error(LayerError.dictionary.invalidPredicate);
        if (conversationId.indexOf('layer:///conversations/') !== 0) conversationId = 'layer:///conversations/' + conversationId;
        return 'conversation.id = \'' + conversationId + '\'';
      } else {
        throw new Error(LayerError.dictionary.predicateNotSupported);
      }
    }

    /**
     * After redefining the query, reset it: remove all data/reset all state.
     *
     * @method _reset
     * @private
     */

  }, {
    key: '_reset',
    value: function _reset() {
      this.totalSize = 0;
      var data = this.data;
      this.data = [];
      this.client._checkAndPurgeCache(data);
      this.isFiring = false;
      this._predicate = null;
      this._nextDBFromId = '';
      this._nextServerFromId = '';
      this._isServerSyncing = false;
      this.pagedToEnd = false;
      this.paginationWindow = this._initialPaginationWindow;
      this._triggerChange({
        data: [],
        type: 'reset'
      });
    }

    /**
     * Reset your query to its initial state and then rerun it.
     *
     * @method reset
     */

  }, {
    key: 'reset',
    value: function reset() {
      if (this._isSyncingId) {
        clearTimeout(this._isSyncingId);
        this._isSyncingId = 0;
      }
      this._reset();
      this._run();
    }

    /**
     * Execute the query.
     *
     * No, don't murder it, just fire it.  No, don't make it unemployed,
     * just connect to the server and get the results.
     *
     * @method _run
     * @private
     */

  }, {
    key: '_run',
    value: function _run() {
      // Find the number of items we need to request.
      var pageSize = Math.min(this.paginationWindow - this.size, this._getMaxPageSize());

      // If there is a reduction in pagination window, then this variable will be negative, and we can shrink
      // the data.
      if (pageSize < 0) {
        var removedData = this.data.slice(this.paginationWindow);
        this.data = this.data.slice(0, this.paginationWindow);
        this.client._checkAndPurgeCache(removedData);
        this.pagedToEnd = false;
        this._triggerAsync('change', { data: [] });
      } else if (pageSize === 0 || this.pagedToEnd) {
        // No need to load 0 results.
      } else {
        switch (this.model) {
          case CONVERSATION:
            this._runConversation(pageSize);
            break;
          case MESSAGE:
            if (this.predicate) this._runMessage(pageSize);
            break;
          case ANNOUNCEMENT:
            this._runAnnouncement(pageSize);
            break;
          case IDENTITY:
            this._runIdentity(pageSize);
            break;
        }
      }
    }

    /**
     * Get Conversations from the server.
     *
     * @method _runConversation
     * @private
     * @param  {number} pageSize - Number of new results to request
     */

  }, {
    key: '_runConversation',
    value: function _runConversation(pageSize) {
      var _this2 = this;

      var sortBy = this._getSortField();

      this.client.dbManager.loadConversations(sortBy, this._nextDBFromId, pageSize, function (conversations) {
        if (conversations.length) _this2._appendResults({ data: conversations }, true);
      });

      var newRequest = 'conversations?sort_by=' + sortBy + '&page_size=' + pageSize + (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

      if (newRequest !== this._firingRequest) {
        this.isFiring = true;
        this._firingRequest = newRequest;
        this.client.xhr({
          url: this._firingRequest,
          method: 'GET',
          sync: false
        }, function (results) {
          return _this2._processRunResults(results, _this2._firingRequest, pageSize);
        });
      }
    }

    /**
     * Returns the sort field for the query.
     *
     * Returns One of:
     *
     * * 'position' (Messages only)
     * * 'last_message' (Conversations only)
     * * 'created_at' (Conversations only)
     * @method _getSortField
     * @private
     * @return {String} sort key used by server
     */

  }, {
    key: '_getSortField',
    value: function _getSortField() {
      if (this.model === MESSAGE || this.model === ANNOUNCEMENT) return 'position';
      if (this.sortBy && this.sortBy[0] && this.sortBy[0]['lastMessage.sentAt']) return 'last_message';
      return 'created_at';
    }

    /**
     * Get the Conversation UUID from the predicate property.
     *
     * Extract the Conversation's UUID from the predicate... or returned the cached value.
     *
     * @method _getConversationPredicateIds
     * @private
     */

  }, {
    key: '_getConversationPredicateIds',
    value: function _getConversationPredicateIds() {
      if (this.predicate.match(findConvIdRegex)) {
        var conversationId = this.predicate.replace(findConvIdRegex, '$1');

        // We will already have a this._predicate if we are paging; else we need to extract the UUID from
        // the conversationId.
        var uuid = (this._predicate || conversationId).replace(/^layer:\/\/\/conversations\//, '');
        if (uuid) {
          return {
            uuid: uuid,
            id: conversationId
          };
        }
      }
    }

    /**
     * Get Messages from the server.
     *
     * @method _runMessage
     * @private
     * @param  {number} pageSize - Number of new results to request
     */

  }, {
    key: '_runMessage',
    value: function _runMessage(pageSize) {
      var _this3 = this;

      var predicateIds = this._getConversationPredicateIds();

      // Do nothing if we don't have a conversation to query on
      if (predicateIds) {
        (function () {
          var conversationId = 'layer:///conversations/' + predicateIds.uuid;
          if (!_this3._predicate) _this3._predicate = predicateIds.id;
          var conversation = _this3.client.getConversation(conversationId);

          // Retrieve data from db cache in parallel with loading data from server
          _this3.client.dbManager.loadMessages(conversationId, _this3._nextDBFromId, pageSize, function (messages) {
            if (messages.length) _this3._appendResults({ data: messages }, true);
          });

          var newRequest = 'conversations/' + predicateIds.uuid + '/messages?page_size=' + pageSize + (_this3._nextServerFromId ? '&from_id=' + _this3._nextServerFromId : '');

          // Don't query on unsaved conversations, nor repeat still firing queries
          if ((!conversation || conversation.isSaved()) && newRequest !== _this3._firingRequest) {
            _this3.isFiring = true;
            _this3._firingRequest = newRequest;
            _this3.client.xhr({
              url: newRequest,
              method: 'GET',
              sync: false
            }, function (results) {
              return _this3._processRunResults(results, newRequest, pageSize);
            });
          }

          // If there are no results, then its a new query; automatically populate it with the Conversation's lastMessage.
          if (_this3.data.length === 0) {
            if (conversation && conversation.lastMessage) {
              _this3.data = [_this3._getData(conversation.lastMessage)];
              // Trigger the change event
              _this3._triggerChange({
                type: 'data',
                data: [_this3._getData(conversation.lastMessage)],
                query: _this3,
                target: _this3.client
              });
            }
          }
        })();
      } else if (!this.predicate.match(/['"]/)) {
        Logger.error('This query may need to quote its value');
      }
    }

    /**
     * Get Announcements from the server.
     *
     * @method _runAnnouncement
     * @private
     * @param  {number} pageSize - Number of new results to request
     */

  }, {
    key: '_runAnnouncement',
    value: function _runAnnouncement(pageSize) {
      var _this4 = this;

      // Retrieve data from db cache in parallel with loading data from server
      this.client.dbManager.loadAnnouncements(this._nextDBFromId, pageSize, function (messages) {
        if (messages.length) _this4._appendResults({ data: messages }, true);
      });

      var newRequest = 'announcements?page_size=' + pageSize + (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

      // Don't repeat still firing queries
      if (newRequest !== this._firingRequest) {
        this.isFiring = true;
        this._firingRequest = newRequest;
        this.client.xhr({
          url: newRequest,
          method: 'GET',
          sync: false
        }, function (results) {
          return _this4._processRunResults(results, newRequest, pageSize);
        });
      }
    }

    /**
     * Get Identities from the server.
     *
     * @method _runIdentities
     * @private
     * @param  {number} pageSize - Number of new results to request
     */

  }, {
    key: '_runIdentity',
    value: function _runIdentity(pageSize) {
      var _this5 = this;

      // There is not yet support for paging Identities;  as all identities are loaded,
      // if there is a _nextDBFromId, we no longer need to get any more from the database
      if (!this._nextDBFromId) {
        this.client.dbManager.loadIdentities(function (identities) {
          if (identities.length) _this5._appendResults({ data: identities }, true);
        });
      }

      var newRequest = 'identities?page_size=' + pageSize + (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

      // Don't repeat still firing queries
      if (newRequest !== this._firingRequest) {
        this.isFiring = true;
        this._firingRequest = newRequest;
        this.client.xhr({
          url: newRequest,
          method: 'GET',
          sync: false
        }, function (results) {
          return _this5._processRunResults(results, newRequest, pageSize);
        });
      }
    }

    /**
     * Process the results of the `_run` method; calls __appendResults.
     *
     * @method _processRunResults
     * @private
     * @param  {Object} results - Full xhr response object with server results
     * @param {Number} pageSize - Number of entries that were requested
     */

  }, {
    key: '_processRunResults',
    value: function _processRunResults(results, requestUrl, pageSize) {
      var _this6 = this;

      if (requestUrl !== this._firingRequest || this.isDestroyed) return;
      var isSyncing = results.xhr.getResponseHeader('Layer-Conversation-Is-Syncing') === 'true';

      // isFiring is false... unless we are still syncing
      this.isFiring = isSyncing;
      this._firingRequest = '';
      if (results.success) {
        if (isSyncing) {
          this._isSyncingId = setTimeout(function () {
            _this6._isSyncingId = 0;
            _this6._run();
          }, 1500);
        } else {
          this._isSyncingId = 0;
          this._appendResults(results, false);
          this.totalSize = Number(results.xhr.getResponseHeader('Layer-Count'));

          if (results.data.length < pageSize) this.pagedToEnd = true;
        }
      } else {
        this.trigger('error', { error: results.data });
      }
    }

    /**
     * Appends arrays of data to the Query results.
     *
     * @method  _appendResults
     * @private
     */

  }, {
    key: '_appendResults',
    value: function _appendResults(results, fromDb) {
      var _this7 = this;

      // For all results, register them with the client
      // If already registered with the client, properties will be updated as needed
      // Database results rather than server results will arrive already registered.
      results.data.forEach(function (item) {
        if (!(item instanceof Root)) _this7.client._createObject(item);
      });

      // Filter results to just the new results
      var newResults = results.data.filter(function (item) {
        return _this7._getIndex(item.id) === -1;
      });

      // Update the next ID to use in pagination
      var resultLength = results.data.length;
      if (resultLength) {
        if (fromDb) {
          this._nextDBFromId = results.data[resultLength - 1].id;
        } else {
          this._nextServerFromId = results.data[resultLength - 1].id;
        }
      }

      // Update this.data
      if (this.dataType === Query.ObjectDataType) {
        this.data = [].concat(this.data);
      }
      var data = this.data;

      // Insert the results... if the results are a match
      newResults.forEach(function (itemIn) {
        var index = void 0;
        var item = _this7.client._getObject(itemIn.id);
        switch (_this7.model) {
          case MESSAGE:
          case ANNOUNCEMENT:
            index = _this7._getInsertMessageIndex(item, data);
            break;
          case CONVERSATION:
            index = _this7._getInsertConversationIndex(item, data);
            break;
          case IDENTITY:
            index = data.length;
            break;
        }
        data.splice(index, 0, _this7._getData(item));
      });

      // Trigger the change event
      this._triggerChange({
        type: 'data',
        data: newResults.map(function (item) {
          return _this7._getData(_this7.client._getObject(item.id));
        }),
        query: this,
        target: this.client
      });
    }

    /**
     * Returns a correctly formatted object representing a result.
     *
     * Format is specified by the `dataType` property.
     *
     * @method _getData
     * @private
     * @param  {layer.Root} item - Conversation or Message instance
     * @return {Object} - Conversation or Message instance or Object
     */

  }, {
    key: '_getData',
    value: function _getData(item) {
      if (this.dataType === Query.ObjectDataType) {
        return item.toObject();
      }
      return item;
    }

    /**
     * Returns an instance regardless of whether the input is instance or object
     * @method _getInstance
     * @private
     * @param {layer.Root|Object} item - Conversation or Message object/instance
     * @return {layer.Root}
     */

  }, {
    key: '_getInstance',
    value: function _getInstance(item) {
      if (item instanceof Root) return item;
      return this.client._getObject(item.id);
    }

    /**
     * Ask the query for the item matching the ID.
     *
     * Returns undefined if the ID is not found.
     *
     * @method _getItem
     * @private
     * @param  {string} id
     * @return {Object} Conversation or Message object or instance
     */

  }, {
    key: '_getItem',
    value: function _getItem(id) {
      switch (Util.typeFromID(id)) {
        case 'announcements':
          if (this.model === ANNOUNCEMENT) {
            var index = this._getIndex(id);
            return index === -1 ? null : this.data[index];
          }
          break;
        case 'messages':
          if (this.model === MESSAGE) {
            var _index = this._getIndex(id);
            return _index === -1 ? null : this.data[_index];
          } else if (this.model === CONVERSATION) {
            for (var _index2 = 0; _index2 < this.data.length; _index2++) {
              var conversation = this.data[_index2];
              if (conversation.lastMessage && conversation.lastMessage.id === id) return conversation.lastMessage;
            }
            return null;
          }
          break;
        case 'conversations':
          if (this.model === CONVERSATION) {
            var _index3 = this._getIndex(id);
            return _index3 === -1 ? null : this.data[_index3];
          }
          break;
        case 'identities':
          if (this.model === IDENTITY) {
            var _index4 = this._getIndex(id);
            return _index4 === -1 ? null : this.data[_index4];
          }
          break;
      }
    }

    /**
     * Get the index of the item represented by the specified ID; or return -1.
     *
     * @method _getIndex
     * @private
     * @param  {string} id
     * @return {number}
     */

  }, {
    key: '_getIndex',
    value: function _getIndex(id) {
      for (var index = 0; index < this.data.length; index++) {
        if (this.data[index].id === id) return index;
      }
      return -1;
    }

    /**
     * Handle any change event received from the layer.Client.
     *
     * These can be caused by websocket events, as well as local
     * requests to create/delete/modify Conversations and Messages.
     *
     * The event does not necessarily apply to this Query, but the Query
     * must examine it to determine if it applies.
     *
     * @method _handleChangeEvents
     * @private
     * @param {string} eventName - "messages:add", "conversations:change"
     * @param {layer.LayerEvent} evt
     */

  }, {
    key: '_handleChangeEvents',
    value: function _handleChangeEvents(eventName, evt) {
      switch (this.model) {
        case CONVERSATION:
          this._handleConversationEvents(evt);
          break;
        case MESSAGE:
        case ANNOUNCEMENT:
          this._handleMessageEvents(evt);
          break;
        case IDENTITY:
          this._handleIdentityEvents(evt);
          break;
      }
    }
  }, {
    key: '_handleConversationEvents',
    value: function _handleConversationEvents(evt) {
      switch (evt.eventName) {

        // If a Conversation's property has changed, and the Conversation is in this
        // Query's data, then update it.
        case 'conversations:change':
          this._handleConversationChangeEvent(evt);
          break;

        // If a Conversation is added, and it isn't already in the Query,
        // add it and trigger an event
        case 'conversations:add':
          this._handleConversationAddEvent(evt);
          break;

        // If a Conversation is deleted, and its still in our data,
        // remove it and trigger an event.
        case 'conversations:remove':
          this._handleConversationRemoveEvent(evt);
          break;
      }
    }

    // TODO WEB-968: Refactor this into functions for instance, object, sortBy createdAt, sortBy lastMessage

  }, {
    key: '_handleConversationChangeEvent',
    value: function _handleConversationChangeEvent(evt) {
      var index = this._getIndex(evt.target.id);

      // If its an ID change (matching Distinct Conversation returned by server) make sure to update our data.
      // If dataType is an instance, its been updated for us.
      if (this.dataType === Query.ObjectDataType) {
        var idChanges = evt.getChangesFor('id');
        if (idChanges.length) {
          index = this._getIndex(idChanges[0].oldValue);
        }
      }

      // If dataType is "object" then update the object and our array;
      // else the object is already updated.
      // Ignore results that aren't already in our data; Results are added via
      // conversations:add events.  Websocket Manager automatically loads anything that receives an event
      // for which we have no object, so we'll get the add event at that time.
      if (index !== -1) {
        var sortField = this._getSortField();
        var reorder = evt.hasProperty('lastMessage') && sortField === 'last_message';
        var newIndex = void 0;

        if (this.dataType === Query.ObjectDataType) {
          if (!reorder) {
            // Replace the changed Conversation with a new immutable object
            this.data = [].concat(_toConsumableArray(this.data.slice(0, index)), [evt.target.toObject()], _toConsumableArray(this.data.slice(index + 1)));
          } else {
            newIndex = this._getInsertConversationIndex(evt.target, this.data);
            this.data.splice(index, 1);
            this.data.splice(newIndex, 0, this._getData(evt.target));
            this.data = this.data.concat([]);
          }
        }

        // Else dataType is instance not object
        else {
            if (reorder) {
              newIndex = this._getInsertConversationIndex(evt.target, this.data);
              if (newIndex !== index) {
                this.data.splice(index, 1);
                this.data.splice(newIndex, 0, evt.target);
              }
            }
          }

        // Trigger a 'property' event
        this._triggerChange({
          type: 'property',
          target: this._getData(evt.target),
          query: this,
          isChange: true,
          changes: evt.changes
        });

        if (reorder && newIndex !== index) {
          this._triggerChange({
            type: 'move',
            target: this._getData(evt.target),
            query: this,
            isChange: false,
            fromIndex: index,
            toIndex: newIndex
          });
        }
      }
    }
  }, {
    key: '_getInsertConversationIndex',
    value: function _getInsertConversationIndex(conversation, data) {
      if (!conversation.isSaved()) return 0;
      var sortField = this._getSortField();
      var index = void 0;
      if (sortField === 'created_at') {
        for (index = 0; index < data.length; index++) {
          var item = data[index];
          if (item.syncState === SYNC_STATE.NEW || item.syncState === SYNC_STATE.SAVING) continue;
          if (conversation.createdAt >= item.createdAt) break;
        }
        return index;
      } else {
        var oldIndex = -1;
        var d1 = conversation.lastMessage ? conversation.lastMessage.sentAt : conversation.createdAt;
        for (index = 0; index < data.length; index++) {
          var _item = data[index];
          if (_item.id === conversation.id) {
            oldIndex = index;
            continue;
          }
          if (_item.syncState === SYNC_STATE.NEW || _item.syncState === SYNC_STATE.SAVING) continue;
          var d2 = _item.lastMessage ? _item.lastMessage.sentAt : _item.createdAt;
          if (d1 >= d2) break;
        }
        return oldIndex === -1 || oldIndex > index ? index : index - 1;
      }
    }
  }, {
    key: '_getInsertMessageIndex',
    value: function _getInsertMessageIndex(message, data) {
      var index = void 0;
      for (index = 0; index < data.length; index++) {
        if (message.position > data[index].position) {
          break;
        }
      }
      return index;
    }
  }, {
    key: '_handleConversationAddEvent',
    value: function _handleConversationAddEvent(evt) {
      var _this8 = this;

      // Filter out any Conversations already in our data
      var list = evt.conversations.filter(function (conversation) {
        return _this8._getIndex(conversation.id) === -1;
      });

      if (list.length) {
        (function () {
          var data = _this8.data;
          list.forEach(function (conversation) {
            var newIndex = _this8._getInsertConversationIndex(conversation, data);
            data.splice(newIndex, 0, _this8._getData(conversation));
          });

          // Whether sorting by last_message or created_at, new results go at the top of the list
          if (_this8.dataType === Query.ObjectDataType) {
            _this8.data = [].concat(data);
          }
          _this8.totalSize += list.length;

          // Trigger an 'insert' event for each item added;
          // typically bulk inserts happen via _appendResults().
          list.forEach(function (conversation) {
            var item = _this8._getData(conversation);
            _this8._triggerChange({
              type: 'insert',
              index: _this8.data.indexOf(item),
              target: item,
              query: _this8
            });
          });
        })();
      }
    }
  }, {
    key: '_handleConversationRemoveEvent',
    value: function _handleConversationRemoveEvent(evt) {
      var _this9 = this;

      var removed = [];
      evt.conversations.forEach(function (conversation) {
        var index = _this9._getIndex(conversation.id);
        if (index !== -1) {
          if (conversation.id === _this9._nextDBFromId) _this9._nextDBFromId = _this9._updateNextFromId(index);
          if (conversation.id === _this9._nextServerFromId) _this9._nextServerFromId = _this9._updateNextFromId(index);
          removed.push({
            data: conversation,
            index: index
          });
          if (_this9.dataType === Query.ObjectDataType) {
            _this9.data = [].concat(_toConsumableArray(_this9.data.slice(0, index)), _toConsumableArray(_this9.data.slice(index + 1)));
          } else {
            _this9.data.splice(index, 1);
          }
        }
      });

      this.totalSize -= removed.length;
      removed.forEach(function (removedObj) {
        _this9._triggerChange({
          type: 'remove',
          index: removedObj.index,
          target: _this9._getData(removedObj.data),
          query: _this9
        });
      });
    }
  }, {
    key: '_handleMessageEvents',
    value: function _handleMessageEvents(evt) {
      switch (evt.eventName) {

        // If a Conversation's ID has changed, check our predicate, and update it automatically if needed.
        case 'conversations:change':
          if (this.model === MESSAGE) this._handleMessageConvIdChangeEvent(evt);
          break;

        // If a Message has changed and its in our result set, replace
        // it with a new immutable object
        case 'messages:change':
        case 'messages:read':
          this._handleMessageChangeEvent(evt);
          break;

        // If Messages are added, and they aren't already in our result set
        // add them.
        case 'messages:add':
          this._handleMessageAddEvent(evt);
          break;

        // If a Message is deleted and its in our result set, remove it
        // and trigger an event
        case 'messages:remove':
          this._handleMessageRemoveEvent(evt);
          break;
      }
    }

    /**
     * A Conversation ID changes if a matching Distinct Conversation was found on the server.
     *
     * If this Query's Conversation's ID has changed, update the predicate.
     *
     * @method _handleMessageConvIdChangeEvent
     * @param {layer.LayerEvent} evt - A Message Change Event
     * @private
     */

  }, {
    key: '_handleMessageConvIdChangeEvent',
    value: function _handleMessageConvIdChangeEvent(evt) {
      var cidChanges = evt.getChangesFor('id');
      if (cidChanges.length) {
        if (this._predicate === cidChanges[0].oldValue) {
          this._predicate = cidChanges[0].newValue;
          this.predicate = "conversation.id = '" + this._predicate + "'";
          this._run();
        }
      }
    }

    /**
     * If the ID of the message has changed, then the position property has likely changed as well.
     *
     * This method tests to see if changes to the position property have impacted the message's position in the
     * data array... and updates the array if it has.
     *
     * @method _handleMessagePositionChange
     * @private
     * @param {layer.LayerEvent} evt  A Message Change event
     * @param {number} index  Index of the message in the current data array
     * @return {boolean} True if a data was changed and a change event was emitted
     */

  }, {
    key: '_handleMessagePositionChange',
    value: function _handleMessagePositionChange(evt, index) {
      // If the message is not in the current data, then there is no change to our query results.
      if (index === -1) return false;

      // Create an array without our data item and then find out where the data item Should be inserted.
      // Note: we could just lookup the position in our current data array, but its too easy to introduce
      // errors where comparing this message to itself may yield index or index + 1.
      var newData = [].concat(_toConsumableArray(this.data.slice(0, index)), _toConsumableArray(this.data.slice(index + 1)));
      var newIndex = this._getInsertMessageIndex(evt.target, newData);

      // If the data item goes in the same index as before, then there is no change to be handled here;
      // else insert the item at the right index, update this.data and fire a change event
      if (newIndex !== index) {
        newData.splice(newIndex, 0, this._getData(evt.target));
        this.data = newData;
        this._triggerChange({
          type: 'property',
          target: this._getData(evt.target),
          query: this,
          isChange: true,
          changes: evt.changes
        });
        return true;
      }
      return false;
    }
  }, {
    key: '_handleMessageChangeEvent',
    value: function _handleMessageChangeEvent(evt) {
      var index = this._getIndex(evt.target.id);
      var positionChanges = evt.getChangesFor('position');

      // If there are position changes, handle them.  If all the changes are position changes,
      // exit when done.
      if (positionChanges.length) {
        if (this._handleMessagePositionChange(evt, index)) {
          if (positionChanges.length === evt.changes.length) return;
          index = this._getIndex(evt.target.id); // Get the updated position
        }
      }

      if (index !== -1) {
        if (this.dataType === Query.ObjectDataType) {
          this.data = [].concat(_toConsumableArray(this.data.slice(0, index)), [evt.target.toObject()], _toConsumableArray(this.data.slice(index + 1)));
        }
        this._triggerChange({
          type: 'property',
          target: this._getData(evt.target),
          query: this,
          isChange: true,
          changes: evt.changes
        });
      }
    }
  }, {
    key: '_handleMessageAddEvent',
    value: function _handleMessageAddEvent(evt) {
      var _this10 = this;

      // Only use added messages that are part of this Conversation
      // and not already in our result set
      var list = evt.messages
      // Filter so that we only see Messages if doing a Messages query or Announcements if doing an Announcements Query.
      .filter(function (message) {
        var type = Util.typeFromID(message.id);
        return type === 'messages' && _this10.model === MESSAGE || type === 'announcements' && _this10.model === ANNOUNCEMENT;
      })
      // Filter out Messages that aren't part of this Conversation
      .filter(function (message) {
        var type = Util.typeFromID(message.id);
        return type === 'announcements' || message.conversationId === _this10._predicate;
      })
      // Filter out Messages that are already in our data set
      .filter(function (message) {
        return _this10._getIndex(message.id) === -1;
      }).map(function (message) {
        return _this10._getData(message);
      });

      // Add them to our result set and trigger an event for each one
      if (list.length) {
        (function () {
          var data = _this10.data = _this10.dataType === Query.ObjectDataType ? [].concat(_this10.data) : _this10.data;
          list.forEach(function (item) {
            var index = _this10._getInsertMessageIndex(item, data);
            data.splice(index, 0, item);
          });

          _this10.totalSize += list.length;

          // Index calculated above may shift after additional insertions.  This has
          // to be done after the above insertions have completed.
          list.forEach(function (item) {
            _this10._triggerChange({
              type: 'insert',
              index: _this10.data.indexOf(item),
              target: item,
              query: _this10
            });
          });
        })();
      }
    }
  }, {
    key: '_handleMessageRemoveEvent',
    value: function _handleMessageRemoveEvent(evt) {
      var _this11 = this;

      var removed = [];
      evt.messages.forEach(function (message) {
        var index = _this11._getIndex(message.id);
        if (index !== -1) {
          if (message.id === _this11._nextDBFromId) _this11._nextDBFromId = _this11._updateNextFromId(index);
          if (message.id === _this11._nextServerFromId) _this11._nextServerFromId = _this11._updateNextFromId(index);
          removed.push({
            data: message,
            index: index
          });
          if (_this11.dataType === Query.ObjectDataType) {
            _this11.data = [].concat(_toConsumableArray(_this11.data.slice(0, index)), _toConsumableArray(_this11.data.slice(index + 1)));
          } else {
            _this11.data.splice(index, 1);
          }
        }
      });

      this.totalSize -= removed.length;
      removed.forEach(function (removedObj) {
        _this11._triggerChange({
          type: 'remove',
          target: _this11._getData(removedObj.data),
          index: removedObj.index,
          query: _this11
        });
      });
    }
  }, {
    key: '_handleIdentityEvents',
    value: function _handleIdentityEvents(evt) {
      switch (evt.eventName) {

        // If a Identity has changed and its in our result set, replace
        // it with a new immutable object
        case 'identities:change':
          this._handleIdentityChangeEvent(evt);
          break;

        // If Identities are added, and they aren't already in our result set
        // add them.
        case 'identities:add':
          this._handleIdentityAddEvent(evt);
          break;

        // If a Identity is deleted and its in our result set, remove it
        // and trigger an event
        case 'identities:remove':
          this._handleIdentityRemoveEvent(evt);
          break;
      }
    }
  }, {
    key: '_handleIdentityChangeEvent',
    value: function _handleIdentityChangeEvent(evt) {
      var index = this._getIndex(evt.target.id);

      if (index !== -1) {
        if (this.dataType === Query.ObjectDataType) {
          this.data = [].concat(_toConsumableArray(this.data.slice(0, index)), [evt.target.toObject()], _toConsumableArray(this.data.slice(index + 1)));
        }
        this._triggerChange({
          type: 'property',
          target: this._getData(evt.target),
          query: this,
          isChange: true,
          changes: evt.changes
        });
      }
    }
  }, {
    key: '_handleIdentityAddEvent',
    value: function _handleIdentityAddEvent(evt) {
      var _this12 = this;

      var list = evt.identities.filter(function (identity) {
        return _this12._getIndex(identity.id) === -1;
      }).map(function (identity) {
        return _this12._getData(identity);
      });

      // Add them to our result set and trigger an event for each one
      if (list.length) {
        (function () {
          var data = _this12.data = _this12.dataType === Query.ObjectDataType ? [].concat(_this12.data) : _this12.data;
          list.forEach(function (item) {
            return data.push(item);
          });

          _this12.totalSize += list.length;

          // Index calculated above may shift after additional insertions.  This has
          // to be done after the above insertions have completed.
          list.forEach(function (item) {
            _this12._triggerChange({
              type: 'insert',
              index: _this12.data.indexOf(item),
              target: item,
              query: _this12
            });
          });
        })();
      }
    }
  }, {
    key: '_handleIdentityRemoveEvent',
    value: function _handleIdentityRemoveEvent(evt) {
      var _this13 = this;

      var removed = [];
      evt.identities.forEach(function (identity) {
        var index = _this13._getIndex(identity.id);
        if (index !== -1) {
          if (identity.id === _this13._nextDBFromId) _this13._nextDBFromId = _this13._updateNextFromId(index);
          if (identity.id === _this13._nextServerFromId) _this13._nextServerFromId = _this13._updateNextFromId(index);
          removed.push({
            data: identity,
            index: index
          });
          if (_this13.dataType === Query.ObjectDataType) {
            _this13.data = [].concat(_toConsumableArray(_this13.data.slice(0, index)), _toConsumableArray(_this13.data.slice(index + 1)));
          } else {
            _this13.data.splice(index, 1);
          }
        }
      });

      this.totalSize -= removed.length;
      removed.forEach(function (removedObj) {
        _this13._triggerChange({
          type: 'remove',
          target: _this13._getData(removedObj.data),
          index: removedObj.index,
          query: _this13
        });
      });
    }

    /**
     * If the current next-id is removed from the list, get a new nextId.
     *
     * If the index is greater than 0, whatever is after that index may have come from
     * websockets or other sources, so decrement the index to get the next safe paging id.
     *
     * If the index if 0, even if there is data, that data did not come from paging and
     * can not be used safely as a paging id; return '';
     *
     * @method _updateNextFromId
     * @private
     * @param {number} index - Current index of the nextFromId
     * @returns {string} - Next ID or empty string
     */

  }, {
    key: '_updateNextFromId',
    value: function _updateNextFromId(index) {
      if (index > 0) return this.data[index - 1].id;else return '';
    }

    /*
     * If this is ever changed to be async, make sure that destroy() still triggers synchronous events
     */

  }, {
    key: '_triggerChange',
    value: function _triggerChange(evt) {
      this.trigger('change', evt);
      this.trigger('change:' + evt.type, evt);
    }
  }, {
    key: 'toString',
    value: function toString() {
      return this.id;
    }
  }]);

  return Query;
}(Root);

Query.prefixUUID = 'layer:///queries/';

/**
 * Query for Conversations.
 *
 * Use this value in the layer.Query.model property.
 * @type {string}
 * @static
 */
Query.Conversation = CONVERSATION;

/**
 * Query for Messages.
 *
 * Use this value in the layer.Query.model property.
 * @type {string}
 * @static
 */
Query.Message = MESSAGE;

/**
 * Query for Announcements.
 *
 * Use this value in the layer.Query.model property.
 * @type {string}
 * @static
 */
Query.Announcement = ANNOUNCEMENT;

/**
 * Query for Identities.
 *
 * Use this value in the layer.Query.model property.
 * @type {string}
 * @static
 */
Query.Identity = IDENTITY;

/**
 * Get data as POJOs/immutable objects.
 *
 * This value of layer.Query.dataType will cause your Query data and events to provide Messages/Conversations as immutable objects.
 *
 * @type {string}
 * @static
 */
Query.ObjectDataType = 'object';

/**
 * Get data as instances of layer.Message and layer.Conversation.
 *
 * This value of layer.Query.dataType will cause your Query data and events to provide Messages/Conversations as instances.
 *
 * @type {string}
 * @static
 */
Query.InstanceDataType = 'instance';

/**
 * Set the maximum page size for queries.
 *
 * @type {number}
 * @static
 */
Query.MaxPageSize = 100;

/**
 * Set the maximum page size for Identity queries.
 *
 * @type {number}
 * @static
 */
Query.MaxPageSizeIdentity = 500;

/**
 * Access the number of results currently loaded.
 *
 * @type {Number}
 * @readonly
 */
Object.defineProperty(Query.prototype, 'size', {
  enumerable: true,
  get: function get() {
    return !this.data ? 0 : this.data.length;
  }
});

/** Access the total number of results on the server.
 *
 * Will be 0 until the first query has successfully loaded results.
 *
 * @type {Number}
 * @readonly
 */
Query.prototype.totalSize = 0;

/**
 * Access to the client so it can listen to websocket and local events.
 *
 * @type {layer.Client}
 * @protected
 * @readonly
 */
Query.prototype.client = null;

/**
 * Query results.
 *
 * Array of data resulting from the Query; either a layer.Root subclass.
 *
 * or plain Objects
 * @type {Object[]}
 * @readonly
 */
Query.prototype.data = null;

/**
 * Specifies the type of data being queried for.
 *
 * Model is one of
 *
 * * layer.Query.Conversation
 * * layer.Query.Message
 * * layer.Query.Announcement
 * * layer.Query.Identity
 *
 * Value can be set via constructor and layer.Query.update().
 *
 * @type {String}
 * @readonly
 */
Query.prototype.model = '';

/**
 * What type of results to request of the server.
 *
 * Not yet supported; returnType is one of
 *
 * * object
 * * id
 * * count
 *
 *  Value set via constructor.
 + *
 * This Query API is designed only for use with 'object' at this time; waiting for updates to server for
 * this functionality.
 *
 * @type {String}
 * @readonly
 */
Query.prototype.returnType = 'object';

/**
 * Specify what kind of data array your application requires.
 *
 * Used to specify query dataType.  One of
 * * Query.ObjectDataType
 * * Query.InstanceDataType
 *
 * @type {String}
 * @readonly
 */
Query.prototype.dataType = Query.InstanceDataType;

/**
 * Number of results from the server to request/cache.
 *
 * The pagination window can be increased to download additional items, or decreased to purge results
 * from the data property.
 *
 *     query.update({
 *       paginationWindow: 150
 *     })
 *
 * This call will aim to achieve 150 results.  If it previously had 100,
 * then it will load 50 more. If it previously had 200, it will drop 50.
 *
 * Note that the server will only permit 100 at a time.
 *
 * @type {Number}
 * @readonly
 */
Query.prototype.paginationWindow = 100;

/**
 * Sorting criteria for Conversation Queries.
 *
 * Only supports an array of one field/element.
 * Only supports the following options:
 *
 *     [{'createdAt': 'desc'}]
 *     [{'lastMessage.sentAt': 'desc'}]
 *
 * Why such limitations? Why this structure?  The server will be exposing a Query API at which point the
 * above sort options will make a lot more sense, and full sorting will be provided.
 *
 * @type {String}
 * @readonly
 */
Query.prototype.sortBy = null;

/**
 * This value tells us what to reset the paginationWindow to when the query is redefined.
 *
 * @type {Number}
 * @private
 */
Query.prototype._initialPaginationWindow = 100;

/**
 * Your Query's WHERE clause.
 *
 * Currently, the only query supported is "conversation.id = 'layer:///conversations/uuid'"
 * Note that both ' and " are supported.
 *
 * Currently, the only query supported is `conversation.id = 'layer:///conversations/uuid'`
 *
 * @type {string}
 * @readonly
 */
Query.prototype.predicate = null;

/**
 * True if the Query is connecting to the server.
 *
 * It is not gaurenteed that every `update()` will fire a request to the server.
 * For example, updating a paginationWindow to be smaller,
 * Or changing a value to the existing value would cause the request not to fire.
 *
 * Recommended pattern is:
 *
 *      query.update({paginationWindow: 50});
 *      if (!query.isFiring) {
 *        alert("Done");
 *      } else {
 *          query.once("change", function(evt) {
 *            if (evt.type == "data") alert("Done");
 *          });
 *      }
 *
 * @type {Boolean}
 * @readonly
 */
Query.prototype.isFiring = false;

/**
 * True if we have reached the last result, and further paging will just return []
 *
 * @type {Boolean}
 * @readonly
 */
Query.prototype.pagedToEnd = false;

/**
 * The last request fired.
 *
 * If multiple requests are inflight, the response
 * matching this request is the ONLY response we will process.
 * @type {String}
 * @private
 */
Query.prototype._firingRequest = '';

/**
 * The ID to use in paging the server.
 *
 * Why not just use the ID of the last item in our result set?
 * Because as we receive websocket events, we insert and append items to our data.
 * That websocket event may not in fact deliver the NEXT item in our data, but simply an item, that sequentially
 * belongs at the end despite skipping over other items of data.  Paging should not be from this new item, but
 * only the last item pulled via this query from the server.
 *
 * @type {string}
 */
Query.prototype._nextServerFromId = '';

/**
 * The ID to use in paging the database.
 *
 * Why not just use the ID of the last item in our result set?
 * Because as we receive websocket events, we insert and append items to our data.
 * That websocket event may not in fact deliver the NEXT item in our data, but simply an item, that sequentially
 * belongs at the end despite skipping over other items of data.  Paging should not be from this new item, but
 * only the last item pulled via this query from the database.
 *
 * @type {string}
 */
Query.prototype._nextDBFromId = '';

Query._supportedEvents = [
/**
 * The query data has changed; any change event will cause this event to trigger.
 * @event change
 */
'change',

/**
 * A new page of data has been loaded from the server
 * @event 'change:data'
 */
'change:data',

/**
 * All data for this query has been reset due to a change in the Query predicate.
 * @event 'change:reset'
 */
'change:reset',

/**
 * An item of data within this Query has had a property change its value.
 * @event 'change:property'
 */
'change:property',

/**
 * A new item of data has been inserted into the Query. Not triggered by loading
 * a new page of data from the server, but is triggered by locally creating a matching
 * item of data, or receiving a new item of data via websocket.
 * @event 'change:insert'
 */
'change:insert',

/**
 * An item of data has been removed from the Query. Not triggered for every removal, but
 * is triggered by locally deleting a result, or receiving a report of deletion via websocket.
 * @event 'change:remove'
 */
'change:remove',

/**
 * The query data failed to load from the server.
 * @event error
 */
'error'].concat(Root._supportedEvents);

Root.initClass.apply(Query, [Query, 'Query']);

module.exports = Query;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9xdWVyeS5qcyJdLCJuYW1lcyI6WyJSb290IiwicmVxdWlyZSIsIkxheWVyRXJyb3IiLCJVdGlsIiwiTG9nZ2VyIiwiU1lOQ19TVEFURSIsIkNPTlZFUlNBVElPTiIsIk1FU1NBR0UiLCJBTk5PVU5DRU1FTlQiLCJJREVOVElUWSIsImZpbmRDb252SWRSZWdleCIsIlJlZ0V4cCIsIlF1ZXJ5Iiwib3B0aW9ucyIsImFyZ3MiLCJsZW5ndGgiLCJidWlsZCIsImNsaWVudCIsInByZWRpY2F0ZSIsIl9maXhQcmVkaWNhdGUiLCJwYWdpbmF0aW9uV2luZG93IiwiTWF0aCIsIm1pbiIsIl9nZXRNYXhQYWdlU2l6ZSIsIndhcm4iLCJkYXRhIiwiX2luaXRpYWxQYWdpbmF0aW9uV2luZG93IiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiY2xpZW50TWlzc2luZyIsIm9uIiwiX2hhbmRsZUNoYW5nZUV2ZW50cyIsImlzUmVhZHkiLCJvbmNlIiwiX3J1biIsIl90cmlnZ2VyQ2hhbmdlIiwidHlwZSIsInRhcmdldCIsInF1ZXJ5IiwiaXNDaGFuZ2UiLCJvZmYiLCJfcmVtb3ZlUXVlcnkiLCJtb2RlbCIsIklkZW50aXR5IiwiTWF4UGFnZVNpemVJZGVudGl0eSIsIk1heFBhZ2VTaXplIiwibmVlZHNSZWZyZXNoIiwibmVlZHNSZWNyZWF0ZSIsIm9wdGlvbnNCdWlsdCIsInNpemUiLCJKU09OIiwic3RyaW5naWZ5Iiwic29ydEJ5IiwiX3Jlc2V0IiwiaW5WYWx1ZSIsIk1lc3NhZ2UiLCJjb252ZXJzYXRpb25JZCIsIm1hdGNoIiwicmVwbGFjZSIsImludmFsaWRQcmVkaWNhdGUiLCJpbmRleE9mIiwicHJlZGljYXRlTm90U3VwcG9ydGVkIiwidG90YWxTaXplIiwiX2NoZWNrQW5kUHVyZ2VDYWNoZSIsImlzRmlyaW5nIiwiX3ByZWRpY2F0ZSIsIl9uZXh0REJGcm9tSWQiLCJfbmV4dFNlcnZlckZyb21JZCIsIl9pc1NlcnZlclN5bmNpbmciLCJwYWdlZFRvRW5kIiwiX2lzU3luY2luZ0lkIiwiY2xlYXJUaW1lb3V0IiwicGFnZVNpemUiLCJyZW1vdmVkRGF0YSIsInNsaWNlIiwiX3RyaWdnZXJBc3luYyIsIl9ydW5Db252ZXJzYXRpb24iLCJfcnVuTWVzc2FnZSIsIl9ydW5Bbm5vdW5jZW1lbnQiLCJfcnVuSWRlbnRpdHkiLCJfZ2V0U29ydEZpZWxkIiwiZGJNYW5hZ2VyIiwibG9hZENvbnZlcnNhdGlvbnMiLCJjb252ZXJzYXRpb25zIiwiX2FwcGVuZFJlc3VsdHMiLCJuZXdSZXF1ZXN0IiwiX2ZpcmluZ1JlcXVlc3QiLCJ4aHIiLCJ1cmwiLCJtZXRob2QiLCJzeW5jIiwiX3Byb2Nlc3NSdW5SZXN1bHRzIiwicmVzdWx0cyIsInV1aWQiLCJpZCIsInByZWRpY2F0ZUlkcyIsIl9nZXRDb252ZXJzYXRpb25QcmVkaWNhdGVJZHMiLCJjb252ZXJzYXRpb24iLCJnZXRDb252ZXJzYXRpb24iLCJsb2FkTWVzc2FnZXMiLCJtZXNzYWdlcyIsImlzU2F2ZWQiLCJsYXN0TWVzc2FnZSIsIl9nZXREYXRhIiwiZXJyb3IiLCJsb2FkQW5ub3VuY2VtZW50cyIsImxvYWRJZGVudGl0aWVzIiwiaWRlbnRpdGllcyIsInJlcXVlc3RVcmwiLCJpc0Rlc3Ryb3llZCIsImlzU3luY2luZyIsImdldFJlc3BvbnNlSGVhZGVyIiwic3VjY2VzcyIsInNldFRpbWVvdXQiLCJOdW1iZXIiLCJ0cmlnZ2VyIiwiZnJvbURiIiwiZm9yRWFjaCIsIml0ZW0iLCJfY3JlYXRlT2JqZWN0IiwibmV3UmVzdWx0cyIsImZpbHRlciIsIl9nZXRJbmRleCIsInJlc3VsdExlbmd0aCIsImRhdGFUeXBlIiwiT2JqZWN0RGF0YVR5cGUiLCJjb25jYXQiLCJpdGVtSW4iLCJpbmRleCIsIl9nZXRPYmplY3QiLCJfZ2V0SW5zZXJ0TWVzc2FnZUluZGV4IiwiX2dldEluc2VydENvbnZlcnNhdGlvbkluZGV4Iiwic3BsaWNlIiwibWFwIiwidG9PYmplY3QiLCJ0eXBlRnJvbUlEIiwiZXZlbnROYW1lIiwiZXZ0IiwiX2hhbmRsZUNvbnZlcnNhdGlvbkV2ZW50cyIsIl9oYW5kbGVNZXNzYWdlRXZlbnRzIiwiX2hhbmRsZUlkZW50aXR5RXZlbnRzIiwiX2hhbmRsZUNvbnZlcnNhdGlvbkNoYW5nZUV2ZW50IiwiX2hhbmRsZUNvbnZlcnNhdGlvbkFkZEV2ZW50IiwiX2hhbmRsZUNvbnZlcnNhdGlvblJlbW92ZUV2ZW50IiwiaWRDaGFuZ2VzIiwiZ2V0Q2hhbmdlc0ZvciIsIm9sZFZhbHVlIiwic29ydEZpZWxkIiwicmVvcmRlciIsImhhc1Byb3BlcnR5IiwibmV3SW5kZXgiLCJjaGFuZ2VzIiwiZnJvbUluZGV4IiwidG9JbmRleCIsInN5bmNTdGF0ZSIsIk5FVyIsIlNBVklORyIsImNyZWF0ZWRBdCIsIm9sZEluZGV4IiwiZDEiLCJzZW50QXQiLCJkMiIsIm1lc3NhZ2UiLCJwb3NpdGlvbiIsImxpc3QiLCJyZW1vdmVkIiwiX3VwZGF0ZU5leHRGcm9tSWQiLCJwdXNoIiwicmVtb3ZlZE9iaiIsIl9oYW5kbGVNZXNzYWdlQ29udklkQ2hhbmdlRXZlbnQiLCJfaGFuZGxlTWVzc2FnZUNoYW5nZUV2ZW50IiwiX2hhbmRsZU1lc3NhZ2VBZGRFdmVudCIsIl9oYW5kbGVNZXNzYWdlUmVtb3ZlRXZlbnQiLCJjaWRDaGFuZ2VzIiwibmV3VmFsdWUiLCJuZXdEYXRhIiwicG9zaXRpb25DaGFuZ2VzIiwiX2hhbmRsZU1lc3NhZ2VQb3NpdGlvbkNoYW5nZSIsIl9oYW5kbGVJZGVudGl0eUNoYW5nZUV2ZW50IiwiX2hhbmRsZUlkZW50aXR5QWRkRXZlbnQiLCJfaGFuZGxlSWRlbnRpdHlSZW1vdmVFdmVudCIsImlkZW50aXR5IiwicHJlZml4VVVJRCIsIkNvbnZlcnNhdGlvbiIsIkFubm91bmNlbWVudCIsIkluc3RhbmNlRGF0YVR5cGUiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsInByb3RvdHlwZSIsImVudW1lcmFibGUiLCJnZXQiLCJyZXR1cm5UeXBlIiwiX3N1cHBvcnRlZEV2ZW50cyIsImluaXRDbGFzcyIsImFwcGx5IiwibW9k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Z0wsU0FBTixDQUFnQjVILFFBQWhCLEdBQTJCLEtBQTNCOztBQUVBOzs7Ozs7QUFNQXBELE1BQU1nTCxTQUFOLENBQWdCdkgsVUFBaEIsR0FBNkIsS0FBN0I7O0FBRUE7Ozs7Ozs7O0FBUUF6RCxNQUFNZ0wsU0FBTixDQUFnQnRHLGNBQWhCLEdBQWlDLEVBQWpDOztBQUVBOzs7Ozs7Ozs7OztBQVdBMUUsTUFBTWdMLFNBQU4sQ0FBZ0J6SCxpQkFBaEIsR0FBb0MsRUFBcEM7O0FBRUE7Ozs7Ozs7Ozs7O0FBV0F2RCxNQUFNZ0wsU0FBTixDQUFnQjFILGFBQWhCLEdBQWdDLEVBQWhDOztBQUdBdEQsTUFBTW9MLGdCQUFOLEdBQXlCO0FBQ3ZCOzs7O0FBSUEsUUFMdUI7O0FBT3ZCOzs7O0FBSUEsYUFYdUI7O0FBYXZCOzs7O0FBSUEsY0FqQnVCOztBQW1CdkI7Ozs7QUFJQSxpQkF2QnVCOztBQXlCdkI7Ozs7OztBQU1BLGVBL0J1Qjs7QUFpQ3ZCOzs7OztBQUtBLGVBdEN1Qjs7QUF3Q3ZCOzs7O0FBSUEsT0E1Q3VCLEVBOEN2QmxFLE1BOUN1QixDQThDaEI5SCxLQUFLZ00sZ0JBOUNXLENBQXpCOztBQWdEQWhNLEtBQUtpTSxTQUFMLENBQWVDLEtBQWYsQ0FBcUJ0TCxLQUFyQixFQUE0QixDQUFDQSxLQUFELEVBQVEsT0FBUixDQUE1Qjs7QUFFQXVMLE9BQU9DLE9BQVAsR0FBaUJ4TCxLQUFqQiIsImZpbGUiOiJxdWVyeS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhlcmUgYXJlIHR3byB3YXlzIHRvIGluc3RhbnRpYXRlIHRoaXMgY2xhc3M6XG4gKlxuICogICAgICAvLyAxLiBVc2luZyBhIFF1ZXJ5IEJ1aWxkZXJcbiAqICAgICAgdmFyIHF1ZXJ5QnVpbGRlciA9IFF1ZXJ5QnVpbGRlci5jb252ZXJzYXRpb25zKCkuc29ydEJ5KCdsYXN0TWVzc2FnZScpO1xuICogICAgICB2YXIgcXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkocXVlcnlCdWlsZGVyKTtcbiAqXG4gKiAgICAgIC8vIDIuIFBhc3NpbmcgcHJvcGVydGllcyBkaXJlY3RseVxuICogICAgICB2YXIgcXVlcnkgPSBjbGllbnQuY3JlYXRlUXVlcnkoe1xuICogICAgICAgIGNsaWVudDogY2xpZW50LFxuICogICAgICAgIG1vZGVsOiBsYXllci5RdWVyeS5Db252ZXJzYXRpb24sXG4gKiAgICAgICAgc29ydEJ5OiBbeydjcmVhdGVkQXQnOiAnZGVzYyd9XVxuICogICAgICB9KTtcbiAqXG4gKiBZb3UgY2FuIGNoYW5nZSB0aGUgZGF0YSBzZWxlY3RlZCBieSB5b3VyIHF1ZXJ5IGFueSB0aW1lIHlvdSB3YW50IHVzaW5nOlxuICpcbiAqICAgICAgcXVlcnkudXBkYXRlKHtcbiAqICAgICAgICBwYWdpbmF0aW9uV2luZG93OiAyMDBcbiAqICAgICAgfSk7XG4gKlxuICogICAgICBxdWVyeS51cGRhdGUoe1xuICogICAgICAgIHByZWRpY2F0ZTogJ2NvbnZlcnNhdGlvbi5pZCA9IFwiJyArIGNvbnYuaWQgKyBcIidcIlxuICogICAgICB9KTtcbiAqXG4gKiAgICAgLy8gT3IgdXNlIHRoZSBRdWVyeSBCdWlsZGVyOlxuICogICAgIHF1ZXJ5QnVpbGRlci5wYWdpbmF0aW9uV2luZG93KDIwMCk7XG4gKiAgICAgcXVlcnkudXBkYXRlKHF1ZXJ5QnVpbGRlcik7XG4gKlxuICogWW91IGNhbiByZWxlYXNlIENvbnZlcnNhdGlvbnMgYW5kIE1lc3NhZ2VzIGhlbGQgaW4gbWVtb3J5IGJ5IHlvdXIgcXVlcmllcyB3aGVuIGRvbmUgd2l0aCB0aGVtOlxuICpcbiAqICAgICAgcXVlcnkuZGVzdHJveSgpO1xuICpcbiAqICMjIyMgcHJlZGljYXRlXG4gKlxuICogTm90ZSB0aGF0IHRoZSBgcHJlZGljYXRlYCBwcm9wZXJ0eSBpcyBvbmx5IHN1cHBvcnRlZCBmb3IgTWVzc2FnZXMsIGFuZCBvbmx5IHN1cHBvcnRzXG4gKiBxdWVyeWluZyBieSBDb252ZXJzYXRpb246IGBjb252ZXJzYXRpb24uaWQgPSAnbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy9VVUlVRCdgXG4gKlxuICogIyMjIyBzb3J0QnlcbiAqXG4gKiBOb3RlIHRoYXQgdGhlIGBzb3J0QnlgIHByb3BlcnR5IGlzIG9ubHkgc3VwcG9ydGVkIGZvciBDb252ZXJzYXRpb25zIGF0IHRoaXMgdGltZSBhbmQgb25seVxuICogc3VwcG9ydHMgXCJjcmVhdGVkQXRcIiBhbmQgXCJsYXN0TWVzc2FnZS5zZW50QXRcIiBhcyBzb3J0IGZpZWxkcy5cbiAqXG4gKiAjIyMjIGRhdGFUeXBlXG4gKlxuICogVGhlIGxheWVyLlF1ZXJ5LmRhdGFUeXBlIHByb3BlcnR5IGxldHMgeW91IHNwZWNpZnkgd2hhdCB0eXBlIG9mIGRhdGEgc2hvd3MgdXAgaW4geW91ciByZXN1bHRzOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHZhciBxdWVyeSA9IGNsaWVudC5jcmVhdGVRdWVyeSh7XG4gKiAgICAgbW9kZWw6IGxheWVyLlF1ZXJ5Lk1lc3NhZ2UsXG4gKiAgICAgcHJlZGljYXRlOiBcImNvbnZlcnNhdGlvbi5pZCA9ICdsYXllcjovLy9jb252ZXJzYXRpb25zL3V1aWQnXCIsXG4gKiAgICAgZGF0YVR5cGU6IGxheWVyLlF1ZXJ5Lkluc3RhbmNlRGF0YVR5cGVcbiAqIH0pXG4gKlxuICogdmFyIHF1ZXJ5ID0gY2xpZW50LmNyZWF0ZVF1ZXJ5KHtcbiAqICAgICBtb2RlbDogbGF5ZXIuUXVlcnkuTWVzc2FnZSxcbiAqICAgICBwcmVkaWNhdGU6IFwiY29udmVyc2F0aW9uLmlkID0gJ2xheWVyOi8vL2NvbnZlcnNhdGlvbnMvdXVpZCdcIixcbiAqICAgICBkYXRhVHlwZTogbGF5ZXIuUXVlcnkuT2JqZWN0RGF0YVR5cGVcbiAqIH0pXG4gKiBgYGBcbiAqXG4gKiBUaGUgcHJvcGVydHkgZGVmYXVsdHMgdG8gbGF5ZXIuUXVlcnkuSW5zdGFuY2VEYXRhVHlwZS4gIEluc3RhbmNlcyBzdXBwb3J0IG1ldGhvZHMgYW5kIGxldCB5b3Ugc3Vic2NyaWJlIHRvIGV2ZW50cyBmb3IgZGlyZWN0IG5vdGlmaWNhdGlvblxuICogb2YgY2hhbmdlcyB0byBhbnkgb2YgdGhlIHJlc3VsdHMgb2YgeW91ciBxdWVyeTpcbiAqXG4qIGBgYGphdmFzY3JpcHRcbiAqIHF1ZXJ5LmRhdGFbMF0ub24oJ21lc3NhZ2VzOmNoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICogICAgIGFsZXJ0KCdUaGUgZmlyc3QgbWVzc2FnZSBoYXMgaGFkIGEgcHJvcGVydHkgY2hhbmdlOyBwcm9iYWJseSBpc1JlYWQgb3IgcmVjaXBpZW50X3N0YXR1cyEnKTtcbiAqIH0pO1xuICogYGBgXG4gKlxuICogQSB2YWx1ZSBvZiBsYXllci5RdWVyeS5PYmplY3REYXRhVHlwZSB3aWxsIGNhdXNlIHRoZSBkYXRhIHRvIGJlIGFuIGFycmF5IG9mIGltbXV0YWJsZSBvYmplY3RzIHJhdGhlciB0aGFuIGluc3RhbmNlcy4gIE9uZSBjYW4gc3RpbGwgZ2V0IGFuIGluc3RhbmNlIGZyb20gdGhlIFBPSk86XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogdmFyIG0gPSBjbGllbnQuZ2V0TWVzc2FnZShxdWVyeS5kYXRhWzBdLmlkKTtcbiAqIG0ub24oJ21lc3NhZ2VzOmNoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICogICAgIGFsZXJ0KCdUaGUgZmlyc3QgbWVzc2FnZSBoYXMgaGFkIGEgcHJvcGVydHkgY2hhbmdlOyBwcm9iYWJseSBpc1JlYWQgb3IgcmVjaXBpZW50X3N0YXR1cyEnKTtcbiAqIH0pO1xuICogYGBgXG4gKlxuICogIyMgUXVlcnkgRXZlbnRzXG4gKlxuICogUXVlcmllcyBmaXJlIGV2ZW50cyB3aGVuZXZlciB0aGVpciBkYXRhIGNoYW5nZXMuICBUaGVyZSBhcmUgNSB0eXBlcyBvZiBldmVudHM7XG4gKiBhbGwgZXZlbnRzIGFyZSByZWNlaXZlZCBieSBzdWJzY3JpYmluZyB0byB0aGUgYGNoYW5nZWAgZXZlbnQuXG4gKlxuICogIyMjIDEuIERhdGEgRXZlbnRzXG4gKlxuICogVGhlIERhdGEgZXZlbnQgaXMgZmlyZWQgd2hlbmV2ZXIgYSByZXF1ZXN0IGlzIHNlbnQgdG8gdGhlIHNlcnZlciBmb3IgbmV3IHF1ZXJ5IHJlc3VsdHMuICBUaGlzIGNvdWxkIGhhcHBlbiB3aGVuIGZpcnN0IGNyZWF0aW5nIHRoZSBxdWVyeSwgd2hlbiBwYWdpbmcgZm9yIG1vcmUgZGF0YSwgb3Igd2hlbiBjaGFuZ2luZyB0aGUgcXVlcnkncyBwcm9wZXJ0aWVzLCByZXN1bHRpbmcgaW4gYSBuZXcgcmVxdWVzdCB0byB0aGUgc2VydmVyLlxuICpcbiAqIFRoZSBFdmVudCBvYmplY3Qgd2lsbCBoYXZlIGFuIGBldnQuZGF0YWAgYXJyYXkgb2YgYWxsIG5ld2x5IGFkZGVkIHJlc3VsdHMuICBCdXQgZnJlcXVlbnRseSB5b3UgbWF5IGp1c3Qgd2FudCB0byB1c2UgdGhlIGBxdWVyeS5kYXRhYCBhcnJheSBhbmQgZ2V0IEFMTCByZXN1bHRzLlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHF1ZXJ5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAqICAgaWYgKGV2dC50eXBlID09PSAnZGF0YScpIHtcbiAqICAgICAgdmFyIG5ld0RhdGEgPSBldnQuZGF0YTtcbiAqICAgICAgdmFyIGFsbERhdGEgPSBxdWVyeS5kYXRhO1xuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIE5vdGUgdGhhdCBgcXVlcnkub24oJ2NoYW5nZTpkYXRhJywgZnVuY3Rpb24oZXZ0KSB7fWAgaXMgYWxzbyBzdXBwb3J0ZWQuXG4gKlxuICogIyMjIDIuIEluc2VydCBFdmVudHNcbiAqXG4gKiBBIG5ldyBDb252ZXJzYXRpb24gb3IgTWVzc2FnZSB3YXMgY3JlYXRlZC4gSXQgbWF5IGhhdmUgYmVlbiBjcmVhdGVkIGxvY2FsbHkgYnkgeW91ciB1c2VyLCBvciBpdCBtYXkgaGF2ZSBiZWVuIHJlbW90ZWx5IGNyZWF0ZWQsIHJlY2VpdmVkIHZpYSB3ZWJzb2NrZXQsIGFuZCBhZGRlZCB0byB0aGUgUXVlcnkncyByZXN1bHRzLlxuICpcbiAqIFRoZSBsYXllci5MYXllckV2ZW50LnRhcmdldCBwcm9wZXJ0eSBjb250YWlucyB0aGUgbmV3bHkgaW5zZXJ0ZWQgb2JqZWN0LlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqICBxdWVyeS5vbignY2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gKiAgICBpZiAoZXZ0LnR5cGUgPT09ICdpbnNlcnQnKSB7XG4gKiAgICAgICB2YXIgbmV3SXRlbSA9IGV2dC50YXJnZXQ7XG4gKiAgICAgICB2YXIgYWxsRGF0YSA9IHF1ZXJ5LmRhdGE7XG4gKiAgICB9XG4gKiAgfSk7XG4gKiBgYGBcbiAqXG4gKiBOb3RlIHRoYXQgYHF1ZXJ5Lm9uKCdjaGFuZ2U6aW5zZXJ0JywgZnVuY3Rpb24oZXZ0KSB7fWAgaXMgYWxzbyBzdXBwb3J0ZWQuXG4gKlxuICogIyMjIDMuIFJlbW92ZSBFdmVudHNcbiAqXG4gKiBBIENvbnZlcnNhdGlvbiBvciBNZXNzYWdlIHdhcyBkZWxldGVkLiBUaGlzIG1heSBoYXZlIGJlZW4gZGVsZXRlZCBsb2NhbGx5IGJ5IHlvdXIgdXNlciwgb3IgaXQgbWF5IGhhdmUgYmVlbiByZW1vdGVseSBkZWxldGVkLCBhIG5vdGlmaWNhdGlvbiByZWNlaXZlZCB2aWEgd2Vic29ja2V0LCBhbmQgcmVtb3ZlZCBmcm9tIHRoZSBRdWVyeSByZXN1bHRzLlxuICpcbiAqIFRoZSBsYXllci5MYXllckV2ZW50LnRhcmdldCBwcm9wZXJ0eSBjb250YWlucyB0aGUgcmVtb3ZlZCBvYmplY3QuXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogcXVlcnkub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICogICBpZiAoZXZ0LnR5cGUgPT09ICdyZW1vdmUnKSB7XG4gKiAgICAgICB2YXIgcmVtb3ZlZEl0ZW0gPSBldnQudGFyZ2V0O1xuICogICAgICAgdmFyIGFsbERhdGEgPSBxdWVyeS5kYXRhO1xuICogICB9XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIE5vdGUgdGhhdCBgcXVlcnkub24oJ2NoYW5nZTpyZW1vdmUnLCBmdW5jdGlvbihldnQpIHt9YCBpcyBhbHNvIHN1cHBvcnRlZC5cbiAqXG4gKiAjIyMgNC4gUmVzZXQgRXZlbnRzXG4gKlxuICogQW55IHRpbWUgeW91ciBxdWVyeSdzIG1vZGVsIG9yIHByZWRpY2F0ZSBwcm9wZXJ0aWVzIGhhdmUgYmVlbiBjaGFuZ2VkXG4gKiB0aGUgcXVlcnkgaXMgcmVzZXQsIGFuZCBhIG5ldyByZXF1ZXN0IGlzIHNlbnQgdG8gdGhlIHNlcnZlci4gIFRoZSByZXNldCBldmVudCBpbmZvcm1zIHlvdXIgVUkgdGhhdCB0aGUgY3VycmVudCByZXN1bHQgc2V0IGlzIGVtcHR5LCBhbmQgdGhhdCB0aGUgcmVhc29uIGl0cyBlbXB0eSBpcyB0aGF0IGl0IHdhcyBgcmVzZXRgLiAgVGhpcyBoZWxwcyBkaWZmZXJlbnRpYXRlIGl0IGZyb20gYSBgZGF0YWAgZXZlbnQgdGhhdCByZXR1cm5zIGFuIGVtcHR5IGFycmF5LlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHF1ZXJ5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAqICAgaWYgKGV2dC50eXBlID09PSAncmVzZXQnKSB7XG4gKiAgICAgICB2YXIgYWxsRGF0YSA9IHF1ZXJ5LmRhdGE7IC8vIFtdXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKlxuICogTm90ZSB0aGF0IGBxdWVyeS5vbignY2hhbmdlOnJlc2V0JywgZnVuY3Rpb24oZXZ0KSB7fWAgaXMgYWxzbyBzdXBwb3J0ZWQuXG4gKlxuICogIyMjIDUuIFByb3BlcnR5IEV2ZW50c1xuICpcbiAqIElmIGFueSBwcm9wZXJ0aWVzIGNoYW5nZSBpbiBhbnkgb2YgdGhlIG9iamVjdHMgbGlzdGVkIGluIHlvdXIgbGF5ZXIuUXVlcnkuZGF0YSBwcm9wZXJ0eSwgYSBgcHJvcGVydHlgIGV2ZW50IHdpbGwgYmUgZmlyZWQuXG4gKlxuICogVGhlIGxheWVyLkxheWVyRXZlbnQudGFyZ2V0IHByb3BlcnR5IGNvbnRhaW5zIG9iamVjdCB0aGF0IHdhcyBtb2RpZmllZC5cbiAqXG4gKiBTZWUgbGF5ZXIuTGF5ZXJFdmVudC5jaGFuZ2VzIGZvciBkZXRhaWxzIG9uIGhvdyBjaGFuZ2VzIGFyZSByZXBvcnRlZC5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiBxdWVyeS5vbignY2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gKiAgIGlmIChldnQudHlwZSA9PT0gJ3Byb3BlcnR5Jykge1xuICogICAgICAgdmFyIGNoYW5nZWRJdGVtID0gZXZ0LnRhcmdldDtcbiAqICAgICAgIHZhciBpc1JlYWRDaGFuZ2VzID0gZXZ0LmdldENoYW5nZXNGb3IoJ2lzUmVhZCcpO1xuICogICAgICAgdmFyIHJlY2lwaWVudFN0YXR1c0NoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcigncmVjaXBpZW50U3RhdHVzJyk7XG4gKiAgICAgICBpZiAoaXNSZWFkQ2hhbmdlcy5sZW5ndGgpIHtcbiAqICAgICAgICAgICAuLi5cbiAqICAgICAgIH1cbiAqXG4gKiAgICAgICBpZiAocmVjaXBpZW50U3RhdHVzQ2hhbmdlcy5sZW5ndGgpIHtcbiAqICAgICAgICAgICAuLi5cbiAqICAgICAgIH1cbiAqICAgfVxuICogfSk7XG4gKmBgYFxuICogTm90ZSB0aGF0IGBxdWVyeS5vbignY2hhbmdlOnByb3BlcnR5JywgZnVuY3Rpb24oZXZ0KSB7fWAgaXMgYWxzbyBzdXBwb3J0ZWQuXG4gKlxuICogIyMjIDYuIE1vdmUgRXZlbnRzXG4gKlxuICogT2NjYXNpb25hbGx5LCBhIHByb3BlcnR5IGNoYW5nZSB3aWxsIGNhdXNlIGFuIGl0ZW0gdG8gYmUgc29ydGVkIGRpZmZlcmVudGx5LCBjYXVzaW5nIGEgTW92ZSBldmVudC5cbiAqIFRoZSBldmVudCB3aWxsIHRlbGwgeW91IHdoYXQgaW5kZXggdGhlIGl0ZW0gd2FzIGF0LCBhbmQgd2hlcmUgaXQgaGFzIG1vdmVkIHRvIGluIHRoZSBRdWVyeSByZXN1bHRzLlxuICogVGhpcyBpcyBjdXJyZW50bHkgb25seSBzdXBwb3J0ZWQgZm9yIENvbnZlcnNhdGlvbnMuXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogcXVlcnkub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGV2dCkge1xuICogICBpZiAoZXZ0LnR5cGUgPT09ICdtb3ZlJykge1xuICogICAgICAgdmFyIGNoYW5nZWRJdGVtID0gZXZ0LnRhcmdldDtcbiAqICAgICAgIHZhciBvbGRJbmRleCA9IGV2dC5mcm9tSW5kZXg7XG4gKiAgICAgICB2YXIgbmV3SW5kZXggPSBldnQubmV3SW5kZXg7XG4gKiAgICAgICB2YXIgbW92ZU5vZGUgPSBsaXN0LmNoaWxkTm9kZXNbb2xkSW5kZXhdO1xuICogICAgICAgbGlzdC5yZW1vdmVDaGlsZChtb3ZlTm9kZSk7XG4gKiAgICAgICBsaXN0Lmluc2VydEJlZm9yZShtb3ZlTm9kZSwgbGlzdC5jaGlsZE5vZGVzW25ld0luZGV4XSk7XG4gKiAgIH1cbiAqIH0pO1xuICpgYGBcbiAqIE5vdGUgdGhhdCBgcXVlcnkub24oJ2NoYW5nZTptb3ZlJywgZnVuY3Rpb24oZXZ0KSB7fWAgaXMgYWxzbyBzdXBwb3J0ZWQuXG4gKlxuICogQGNsYXNzICBsYXllci5RdWVyeVxuICogQGV4dGVuZHMgbGF5ZXIuUm9vdFxuICpcbiAqL1xuY29uc3QgUm9vdCA9IHJlcXVpcmUoJy4vcm9vdCcpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4vbGF5ZXItZXJyb3InKTtcbmNvbnN0IFV0aWwgPSByZXF1aXJlKCcuL2NsaWVudC11dGlscycpO1xuY29uc3QgTG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXInKTtcbmNvbnN0IHsgU1lOQ19TVEFURSB9ID0gcmVxdWlyZSgnLi9jb25zdCcpO1xuXG5jb25zdCBDT05WRVJTQVRJT04gPSAnQ29udmVyc2F0aW9uJztcbmNvbnN0IE1FU1NBR0UgPSAnTWVzc2FnZSc7XG5jb25zdCBBTk5PVU5DRU1FTlQgPSAnQW5ub3VuY2VtZW50JztcbmNvbnN0IElERU5USVRZID0gJ0lkZW50aXR5JztcbmNvbnN0IGZpbmRDb252SWRSZWdleCA9IG5ldyBSZWdFeHAoXG4gIC9eY29udmVyc2F0aW9uLmlkXFxzKj1cXHMqWydcIl0oKGxheWVyOlxcL1xcL1xcL2NvbnZlcnNhdGlvbnNcXC8pPy57OH0tLns0fS0uezR9LS57NH0tLnsxMn0pWydcIl0kLyk7XG5cbmNsYXNzIFF1ZXJ5IGV4dGVuZHMgUm9vdCB7XG5cbiAgY29uc3RydWN0b3IoLi4uYXJncykge1xuICAgIGxldCBvcHRpb25zO1xuICAgIGlmIChhcmdzLmxlbmd0aCA9PT0gMikge1xuICAgICAgb3B0aW9ucyA9IGFyZ3NbMV0uYnVpbGQoKTtcbiAgICAgIG9wdGlvbnMuY2xpZW50ID0gYXJnc1swXTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IGFyZ3NbMF07XG4gICAgfVxuXG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5wcmVkaWNhdGUgPSB0aGlzLl9maXhQcmVkaWNhdGUob3B0aW9ucy5wcmVkaWNhdGUgfHwgJycpO1xuXG4gICAgaWYgKCdwYWdpbmF0aW9uV2luZG93JyBpbiBvcHRpb25zKSB7XG4gICAgICBjb25zdCBwYWdpbmF0aW9uV2luZG93ID0gb3B0aW9ucy5wYWdpbmF0aW9uV2luZG93O1xuICAgICAgdGhpcy5wYWdpbmF0aW9uV2luZG93ID0gTWF0aC5taW4odGhpcy5fZ2V0TWF4UGFnZVNpemUoKSwgb3B0aW9ucy5wYWdpbmF0aW9uV2luZG93KTtcbiAgICAgIGlmIChvcHRpb25zLnBhZ2luYXRpb25XaW5kb3cgIT09IHBhZ2luYXRpb25XaW5kb3cpIHtcbiAgICAgICAgTG9nZ2VyLndhcm4oYHBhZ2luYXRpb25XaW5kb3cgdmFsdWUgJHtwYWdpbmF0aW9uV2luZG93fSBpbiBRdWVyeSBjb25zdHJ1Y3RvciBgICtcbiAgICAgICAgICBgZXhjZWRlcyBRdWVyeS5NYXhQYWdlU2l6ZSBvZiAke3RoaXMuX2dldE1heFBhZ2VTaXplKCl9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5kYXRhID0gW107XG4gICAgdGhpcy5faW5pdGlhbFBhZ2luYXRpb25XaW5kb3cgPSB0aGlzLnBhZ2luYXRpb25XaW5kb3c7XG4gICAgaWYgKCF0aGlzLmNsaWVudCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jbGllbnRNaXNzaW5nKTtcbiAgICB0aGlzLmNsaWVudC5vbignYWxsJywgdGhpcy5faGFuZGxlQ2hhbmdlRXZlbnRzLCB0aGlzKTtcblxuICAgIGlmICghdGhpcy5jbGllbnQuaXNSZWFkeSkge1xuICAgICAgdGhpcy5jbGllbnQub25jZSgncmVhZHknLCAoKSA9PiB0aGlzLl9ydW4oKSwgdGhpcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3J1bigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDbGVhbnVwIGFuZCByZW1vdmUgdGhpcyBRdWVyeSwgaXRzIHN1YnNjcmlwdGlvbnMgYW5kIGRhdGEuXG4gICAqXG4gICAqIEBtZXRob2QgZGVzdHJveVxuICAgKi9cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmRhdGEgPSBbXTtcbiAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgIHR5cGU6ICdkYXRhJyxcbiAgICAgIHRhcmdldDogdGhpcy5jbGllbnQsXG4gICAgICBxdWVyeTogdGhpcyxcbiAgICAgIGlzQ2hhbmdlOiBmYWxzZSxcbiAgICAgIGRhdGE6IFtdLFxuICAgIH0pO1xuICAgIHRoaXMuY2xpZW50Lm9mZihudWxsLCBudWxsLCB0aGlzKTtcbiAgICB0aGlzLmNsaWVudC5fcmVtb3ZlUXVlcnkodGhpcyk7XG4gICAgdGhpcy5kYXRhID0gbnVsbDtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBtYXhpbXVtIG51bWJlciBvZiBpdGVtcyBhbGxvd2VkIGluIGEgcGFnZVxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRNYXhQYWdlU2l6ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgKi9cbiAgX2dldE1heFBhZ2VTaXplKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsID09PSBRdWVyeS5JZGVudGl0eSA/IFF1ZXJ5Lk1heFBhZ2VTaXplSWRlbnRpdHkgOiBRdWVyeS5NYXhQYWdlU2l6ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGVzIHByb3BlcnRpZXMgb2YgdGhlIFF1ZXJ5LlxuICAgKlxuICAgKiBDdXJyZW50bHkgc3VwcG9ydHMgdXBkYXRpbmc6XG4gICAqXG4gICAqICogcGFnaW5hdGlvbldpbmRvd1xuICAgKiAqIHByZWRpY2F0ZVxuICAgKiAqIG1vZGVsXG4gICAqXG4gICAqIEFueSBjaGFuZ2UgdG8gcHJlZGljYXRlIG9yIG1vZGVsIHJlc3VsdHMgaW4gY2xlYXJpbmcgYWxsIGRhdGEgZnJvbSB0aGVcbiAgICogcXVlcnkncyByZXN1bHRzIGFuZCB0cmlnZ2VyaW5nIGEgY2hhbmdlIGV2ZW50IHdpdGggW10gYXMgdGhlIG5ldyBkYXRhLlxuICAgKlxuICAgKiBAbWV0aG9kIHVwZGF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnByZWRpY2F0ZV0gLSBBIG5ldyBwcmVkaWNhdGUgZm9yIHRoZSBxdWVyeVxuICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMubW9kZWxdIC0gQSBuZXcgbW9kZWwgZm9yIHRoZSBRdWVyeVxuICAgKiBAcGFyYW0ge251bWJlcn0gW3BhZ2luYXRpb25XaW5kb3ddIC0gSW5jcmVhc2UvZGVjcmVhc2Ugb3VyIHJlc3VsdCBzaXplIHRvIG1hdGNoIHRoaXMgcGFnaW5hdGlvbiB3aW5kb3cuXG4gICAqIEByZXR1cm4ge2xheWVyLlF1ZXJ5fSB0aGlzXG4gICAqL1xuICB1cGRhdGUob3B0aW9ucyA9IHt9KSB7XG4gICAgbGV0IG5lZWRzUmVmcmVzaCxcbiAgICAgIG5lZWRzUmVjcmVhdGU7XG5cbiAgICBjb25zdCBvcHRpb25zQnVpbHQgPSAodHlwZW9mIG9wdGlvbnMuYnVpbGQgPT09ICdmdW5jdGlvbicpID8gb3B0aW9ucy5idWlsZCgpIDogb3B0aW9ucztcblxuICAgIGlmICgncGFnaW5hdGlvbldpbmRvdycgaW4gb3B0aW9uc0J1aWx0ICYmIHRoaXMucGFnaW5hdGlvbldpbmRvdyAhPT0gb3B0aW9uc0J1aWx0LnBhZ2luYXRpb25XaW5kb3cpIHtcbiAgICAgIHRoaXMucGFnaW5hdGlvbldpbmRvdyA9IE1hdGgubWluKHRoaXMuX2dldE1heFBhZ2VTaXplKCkgKyB0aGlzLnNpemUsIG9wdGlvbnNCdWlsdC5wYWdpbmF0aW9uV2luZG93KTtcbiAgICAgIGlmICh0aGlzLnBhZ2luYXRpb25XaW5kb3cgPCBvcHRpb25zQnVpbHQucGFnaW5hdGlvbldpbmRvdykge1xuICAgICAgICBMb2dnZXIud2FybihgcGFnaW5hdGlvbldpbmRvdyB2YWx1ZSAke29wdGlvbnNCdWlsdC5wYWdpbmF0aW9uV2luZG93fSBpbiBRdWVyeS51cGRhdGUoKSBgICtcbiAgICAgICAgICBgaW5jcmVhc2VzIHNpemUgZ3JlYXRlciB0aGFuIFF1ZXJ5Lk1heFBhZ2VTaXplIG9mICR7dGhpcy5fZ2V0TWF4UGFnZVNpemUoKX1gKTtcbiAgICAgIH1cbiAgICAgIG5lZWRzUmVmcmVzaCA9IHRydWU7XG4gICAgfVxuICAgIGlmICgnbW9kZWwnIGluIG9wdGlvbnNCdWlsdCAmJiB0aGlzLm1vZGVsICE9PSBvcHRpb25zQnVpbHQubW9kZWwpIHtcbiAgICAgIHRoaXMubW9kZWwgPSBvcHRpb25zQnVpbHQubW9kZWw7XG4gICAgICBuZWVkc1JlY3JlYXRlID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoJ3ByZWRpY2F0ZScgaW4gb3B0aW9uc0J1aWx0KSB7XG4gICAgICBjb25zdCBwcmVkaWNhdGUgPSB0aGlzLl9maXhQcmVkaWNhdGUob3B0aW9uc0J1aWx0LnByZWRpY2F0ZSB8fCAnJyk7XG4gICAgICBpZiAodGhpcy5wcmVkaWNhdGUgIT09IHByZWRpY2F0ZSkge1xuICAgICAgICB0aGlzLnByZWRpY2F0ZSA9IHByZWRpY2F0ZTtcbiAgICAgICAgbmVlZHNSZWNyZWF0ZSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICgnc29ydEJ5JyBpbiBvcHRpb25zQnVpbHQgJiYgSlNPTi5zdHJpbmdpZnkodGhpcy5zb3J0QnkpICE9PSBKU09OLnN0cmluZ2lmeShvcHRpb25zQnVpbHQuc29ydEJ5KSkge1xuICAgICAgdGhpcy5zb3J0QnkgPSBvcHRpb25zQnVpbHQuc29ydEJ5O1xuICAgICAgbmVlZHNSZWNyZWF0ZSA9IHRydWU7XG4gICAgfVxuICAgIGlmIChuZWVkc1JlY3JlYXRlKSB7XG4gICAgICB0aGlzLl9yZXNldCgpO1xuICAgIH1cbiAgICBpZiAobmVlZHNSZWNyZWF0ZSB8fCBuZWVkc1JlZnJlc2gpIHRoaXMuX3J1bigpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIE5vcm1hbGl6ZXMgdGhlIHByZWRpY2F0ZS5cbiAgICpcbiAgICogQG1ldGhvZCBfZml4UHJlZGljYXRlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBpblZhbHVlXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfZml4UHJlZGljYXRlKGluVmFsdWUpIHtcbiAgICBpZiAoaW5WYWx1ZSA9PT0gJycpIHJldHVybiAnJztcbiAgICBpZiAodGhpcy5tb2RlbCA9PT0gUXVlcnkuTWVzc2FnZSkge1xuICAgICAgbGV0IGNvbnZlcnNhdGlvbklkID0gaW5WYWx1ZS5tYXRjaChmaW5kQ29udklkUmVnZXgpID8gaW5WYWx1ZS5yZXBsYWNlKGZpbmRDb252SWRSZWdleCwgJyQxJykgOiBudWxsO1xuICAgICAgaWYgKCFjb252ZXJzYXRpb25JZCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5pbnZhbGlkUHJlZGljYXRlKTtcbiAgICAgIGlmIChjb252ZXJzYXRpb25JZC5pbmRleE9mKCdsYXllcjovLy9jb252ZXJzYXRpb25zLycpICE9PSAwKSBjb252ZXJzYXRpb25JZCA9ICdsYXllcjovLy9jb252ZXJzYXRpb25zLycgKyBjb252ZXJzYXRpb25JZDtcbiAgICAgIHJldHVybiBgY29udmVyc2F0aW9uLmlkID0gJyR7Y29udmVyc2F0aW9uSWR9J2A7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihMYXllckVycm9yLmRpY3Rpb25hcnkucHJlZGljYXRlTm90U3VwcG9ydGVkKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQWZ0ZXIgcmVkZWZpbmluZyB0aGUgcXVlcnksIHJlc2V0IGl0OiByZW1vdmUgYWxsIGRhdGEvcmVzZXQgYWxsIHN0YXRlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9yZXNldFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3Jlc2V0KCkge1xuICAgIHRoaXMudG90YWxTaXplID0gMDtcbiAgICBjb25zdCBkYXRhID0gdGhpcy5kYXRhO1xuICAgIHRoaXMuZGF0YSA9IFtdO1xuICAgIHRoaXMuY2xpZW50Ll9jaGVja0FuZFB1cmdlQ2FjaGUoZGF0YSk7XG4gICAgdGhpcy5pc0ZpcmluZyA9IGZhbHNlO1xuICAgIHRoaXMuX3ByZWRpY2F0ZSA9IG51bGw7XG4gICAgdGhpcy5fbmV4dERCRnJvbUlkID0gJyc7XG4gICAgdGhpcy5fbmV4dFNlcnZlckZyb21JZCA9ICcnO1xuICAgIHRoaXMuX2lzU2VydmVyU3luY2luZyA9IGZhbHNlO1xuICAgIHRoaXMucGFnZWRUb0VuZCA9IGZhbHNlO1xuICAgIHRoaXMucGFnaW5hdGlvbldpbmRvdyA9IHRoaXMuX2luaXRpYWxQYWdpbmF0aW9uV2luZG93O1xuICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgZGF0YTogW10sXG4gICAgICB0eXBlOiAncmVzZXQnLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IHlvdXIgcXVlcnkgdG8gaXRzIGluaXRpYWwgc3RhdGUgYW5kIHRoZW4gcmVydW4gaXQuXG4gICAqXG4gICAqIEBtZXRob2QgcmVzZXRcbiAgICovXG4gIHJlc2V0KCkge1xuICAgIGlmICh0aGlzLl9pc1N5bmNpbmdJZCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX2lzU3luY2luZ0lkKTtcbiAgICAgIHRoaXMuX2lzU3luY2luZ0lkID0gMDtcbiAgICB9XG4gICAgdGhpcy5fcmVzZXQoKTtcbiAgICB0aGlzLl9ydW4oKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlIHRoZSBxdWVyeS5cbiAgICpcbiAgICogTm8sIGRvbid0IG11cmRlciBpdCwganVzdCBmaXJlIGl0LiAgTm8sIGRvbid0IG1ha2UgaXQgdW5lbXBsb3llZCxcbiAgICoganVzdCBjb25uZWN0IHRvIHRoZSBzZXJ2ZXIgYW5kIGdldCB0aGUgcmVzdWx0cy5cbiAgICpcbiAgICogQG1ldGhvZCBfcnVuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcnVuKCkge1xuICAgIC8vIEZpbmQgdGhlIG51bWJlciBvZiBpdGVtcyB3ZSBuZWVkIHRvIHJlcXVlc3QuXG4gICAgY29uc3QgcGFnZVNpemUgPSBNYXRoLm1pbih0aGlzLnBhZ2luYXRpb25XaW5kb3cgLSB0aGlzLnNpemUsIHRoaXMuX2dldE1heFBhZ2VTaXplKCkpO1xuXG4gICAgLy8gSWYgdGhlcmUgaXMgYSByZWR1Y3Rpb24gaW4gcGFnaW5hdGlvbiB3aW5kb3csIHRoZW4gdGhpcyB2YXJpYWJsZSB3aWxsIGJlIG5lZ2F0aXZlLCBhbmQgd2UgY2FuIHNocmlua1xuICAgIC8vIHRoZSBkYXRhLlxuICAgIGlmIChwYWdlU2l6ZSA8IDApIHtcbiAgICAgIGNvbnN0IHJlbW92ZWREYXRhID0gdGhpcy5kYXRhLnNsaWNlKHRoaXMucGFnaW5hdGlvbldpbmRvdyk7XG4gICAgICB0aGlzLmRhdGEgPSB0aGlzLmRhdGEuc2xpY2UoMCwgdGhpcy5wYWdpbmF0aW9uV2luZG93KTtcbiAgICAgIHRoaXMuY2xpZW50Ll9jaGVja0FuZFB1cmdlQ2FjaGUocmVtb3ZlZERhdGEpO1xuICAgICAgdGhpcy5wYWdlZFRvRW5kID0gZmFsc2U7XG4gICAgICB0aGlzLl90cmlnZ2VyQXN5bmMoJ2NoYW5nZScsIHsgZGF0YTogW10gfSk7XG4gICAgfSBlbHNlIGlmIChwYWdlU2l6ZSA9PT0gMCB8fCB0aGlzLnBhZ2VkVG9FbmQpIHtcbiAgICAgIC8vIE5vIG5lZWQgdG8gbG9hZCAwIHJlc3VsdHMuXG4gICAgfSBlbHNlIHtcbiAgICAgIHN3aXRjaCAodGhpcy5tb2RlbCkge1xuICAgICAgICBjYXNlIENPTlZFUlNBVElPTjpcbiAgICAgICAgICB0aGlzLl9ydW5Db252ZXJzYXRpb24ocGFnZVNpemUpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIE1FU1NBR0U6XG4gICAgICAgICAgaWYgKHRoaXMucHJlZGljYXRlKSB0aGlzLl9ydW5NZXNzYWdlKHBhZ2VTaXplKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBBTk5PVU5DRU1FTlQ6XG4gICAgICAgICAgdGhpcy5fcnVuQW5ub3VuY2VtZW50KHBhZ2VTaXplKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBJREVOVElUWTpcbiAgICAgICAgICB0aGlzLl9ydW5JZGVudGl0eShwYWdlU2l6ZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBDb252ZXJzYXRpb25zIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQG1ldGhvZCBfcnVuQ29udmVyc2F0aW9uXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge251bWJlcn0gcGFnZVNpemUgLSBOdW1iZXIgb2YgbmV3IHJlc3VsdHMgdG8gcmVxdWVzdFxuICAgKi9cbiAgX3J1bkNvbnZlcnNhdGlvbihwYWdlU2l6ZSkge1xuICAgIGNvbnN0IHNvcnRCeSA9IHRoaXMuX2dldFNvcnRGaWVsZCgpO1xuXG4gICAgdGhpcy5jbGllbnQuZGJNYW5hZ2VyLmxvYWRDb252ZXJzYXRpb25zKHNvcnRCeSwgdGhpcy5fbmV4dERCRnJvbUlkLCBwYWdlU2l6ZSwgKGNvbnZlcnNhdGlvbnMpID0+IHtcbiAgICAgIGlmIChjb252ZXJzYXRpb25zLmxlbmd0aCkgdGhpcy5fYXBwZW5kUmVzdWx0cyh7IGRhdGE6IGNvbnZlcnNhdGlvbnMgfSwgdHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBuZXdSZXF1ZXN0ID0gYGNvbnZlcnNhdGlvbnM/c29ydF9ieT0ke3NvcnRCeX0mcGFnZV9zaXplPSR7cGFnZVNpemV9YCArXG4gICAgICAodGhpcy5fbmV4dFNlcnZlckZyb21JZCA/ICcmZnJvbV9pZD0nICsgdGhpcy5fbmV4dFNlcnZlckZyb21JZCA6ICcnKTtcblxuICAgIGlmIChuZXdSZXF1ZXN0ICE9PSB0aGlzLl9maXJpbmdSZXF1ZXN0KSB7XG4gICAgICB0aGlzLmlzRmlyaW5nID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2ZpcmluZ1JlcXVlc3QgPSBuZXdSZXF1ZXN0O1xuICAgICAgdGhpcy5jbGllbnQueGhyKHtcbiAgICAgICAgdXJsOiB0aGlzLl9maXJpbmdSZXF1ZXN0LFxuICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICBzeW5jOiBmYWxzZSxcbiAgICAgIH0sIHJlc3VsdHMgPT4gdGhpcy5fcHJvY2Vzc1J1blJlc3VsdHMocmVzdWx0cywgdGhpcy5fZmlyaW5nUmVxdWVzdCwgcGFnZVNpemUpKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgc29ydCBmaWVsZCBmb3IgdGhlIHF1ZXJ5LlxuICAgKlxuICAgKiBSZXR1cm5zIE9uZSBvZjpcbiAgICpcbiAgICogKiAncG9zaXRpb24nIChNZXNzYWdlcyBvbmx5KVxuICAgKiAqICdsYXN0X21lc3NhZ2UnIChDb252ZXJzYXRpb25zIG9ubHkpXG4gICAqICogJ2NyZWF0ZWRfYXQnIChDb252ZXJzYXRpb25zIG9ubHkpXG4gICAqIEBtZXRob2QgX2dldFNvcnRGaWVsZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IHNvcnQga2V5IHVzZWQgYnkgc2VydmVyXG4gICAqL1xuICBfZ2V0U29ydEZpZWxkKCkge1xuICAgIGlmICh0aGlzLm1vZGVsID09PSBNRVNTQUdFIHx8IHRoaXMubW9kZWwgPT09IEFOTk9VTkNFTUVOVCkgcmV0dXJuICdwb3NpdGlvbic7XG4gICAgaWYgKHRoaXMuc29ydEJ5ICYmIHRoaXMuc29ydEJ5WzBdICYmIHRoaXMuc29ydEJ5WzBdWydsYXN0TWVzc2FnZS5zZW50QXQnXSkgcmV0dXJuICdsYXN0X21lc3NhZ2UnO1xuICAgIHJldHVybiAnY3JlYXRlZF9hdCc7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBDb252ZXJzYXRpb24gVVVJRCBmcm9tIHRoZSBwcmVkaWNhdGUgcHJvcGVydHkuXG4gICAqXG4gICAqIEV4dHJhY3QgdGhlIENvbnZlcnNhdGlvbidzIFVVSUQgZnJvbSB0aGUgcHJlZGljYXRlLi4uIG9yIHJldHVybmVkIHRoZSBjYWNoZWQgdmFsdWUuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldENvbnZlcnNhdGlvblByZWRpY2F0ZUlkc1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2dldENvbnZlcnNhdGlvblByZWRpY2F0ZUlkcygpIHtcbiAgICBpZiAodGhpcy5wcmVkaWNhdGUubWF0Y2goZmluZENvbnZJZFJlZ2V4KSkge1xuICAgICAgY29uc3QgY29udmVyc2F0aW9uSWQgPSB0aGlzLnByZWRpY2F0ZS5yZXBsYWNlKGZpbmRDb252SWRSZWdleCwgJyQxJyk7XG5cbiAgICAgIC8vIFdlIHdpbGwgYWxyZWFkeSBoYXZlIGEgdGhpcy5fcHJlZGljYXRlIGlmIHdlIGFyZSBwYWdpbmc7IGVsc2Ugd2UgbmVlZCB0byBleHRyYWN0IHRoZSBVVUlEIGZyb21cbiAgICAgIC8vIHRoZSBjb252ZXJzYXRpb25JZC5cbiAgICAgIGNvbnN0IHV1aWQgPSAodGhpcy5fcHJlZGljYXRlIHx8IGNvbnZlcnNhdGlvbklkKS5yZXBsYWNlKC9ebGF5ZXI6XFwvXFwvXFwvY29udmVyc2F0aW9uc1xcLy8sICcnKTtcbiAgICAgIGlmICh1dWlkKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdXVpZCxcbiAgICAgICAgICBpZDogY29udmVyc2F0aW9uSWQsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBNZXNzYWdlcyBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgX3J1bk1lc3NhZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bnVtYmVyfSBwYWdlU2l6ZSAtIE51bWJlciBvZiBuZXcgcmVzdWx0cyB0byByZXF1ZXN0XG4gICAqL1xuICBfcnVuTWVzc2FnZShwYWdlU2l6ZSkge1xuICAgIGNvbnN0IHByZWRpY2F0ZUlkcyA9IHRoaXMuX2dldENvbnZlcnNhdGlvblByZWRpY2F0ZUlkcygpO1xuXG4gICAgLy8gRG8gbm90aGluZyBpZiB3ZSBkb24ndCBoYXZlIGEgY29udmVyc2F0aW9uIHRvIHF1ZXJ5IG9uXG4gICAgaWYgKHByZWRpY2F0ZUlkcykge1xuICAgICAgY29uc3QgY29udmVyc2F0aW9uSWQgPSAnbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy8nICsgcHJlZGljYXRlSWRzLnV1aWQ7XG4gICAgICBpZiAoIXRoaXMuX3ByZWRpY2F0ZSkgdGhpcy5fcHJlZGljYXRlID0gcHJlZGljYXRlSWRzLmlkO1xuICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gdGhpcy5jbGllbnQuZ2V0Q29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkKTtcblxuICAgICAgLy8gUmV0cmlldmUgZGF0YSBmcm9tIGRiIGNhY2hlIGluIHBhcmFsbGVsIHdpdGggbG9hZGluZyBkYXRhIGZyb20gc2VydmVyXG4gICAgICB0aGlzLmNsaWVudC5kYk1hbmFnZXIubG9hZE1lc3NhZ2VzKGNvbnZlcnNhdGlvbklkLCB0aGlzLl9uZXh0REJGcm9tSWQsIHBhZ2VTaXplLCAobWVzc2FnZXMpID0+IHtcbiAgICAgICAgaWYgKG1lc3NhZ2VzLmxlbmd0aCkgdGhpcy5fYXBwZW5kUmVzdWx0cyh7IGRhdGE6IG1lc3NhZ2VzIH0sIHRydWUpO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IG5ld1JlcXVlc3QgPSBgY29udmVyc2F0aW9ucy8ke3ByZWRpY2F0ZUlkcy51dWlkfS9tZXNzYWdlcz9wYWdlX3NpemU9JHtwYWdlU2l6ZX1gICtcbiAgICAgICAgKHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPyAnJmZyb21faWQ9JyArIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgOiAnJyk7XG5cbiAgICAgIC8vIERvbid0IHF1ZXJ5IG9uIHVuc2F2ZWQgY29udmVyc2F0aW9ucywgbm9yIHJlcGVhdCBzdGlsbCBmaXJpbmcgcXVlcmllc1xuICAgICAgaWYgKCghY29udmVyc2F0aW9uIHx8IGNvbnZlcnNhdGlvbi5pc1NhdmVkKCkpICYmIG5ld1JlcXVlc3QgIT09IHRoaXMuX2ZpcmluZ1JlcXVlc3QpIHtcbiAgICAgICAgdGhpcy5pc0ZpcmluZyA9IHRydWU7XG4gICAgICAgIHRoaXMuX2ZpcmluZ1JlcXVlc3QgPSBuZXdSZXF1ZXN0O1xuICAgICAgICB0aGlzLmNsaWVudC54aHIoe1xuICAgICAgICAgIHVybDogbmV3UmVxdWVzdCxcbiAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgICB9LCByZXN1bHRzID0+IHRoaXMuX3Byb2Nlc3NSdW5SZXN1bHRzKHJlc3VsdHMsIG5ld1JlcXVlc3QsIHBhZ2VTaXplKSk7XG4gICAgICB9XG5cbiAgICAgIC8vIElmIHRoZXJlIGFyZSBubyByZXN1bHRzLCB0aGVuIGl0cyBhIG5ldyBxdWVyeTsgYXV0b21hdGljYWxseSBwb3B1bGF0ZSBpdCB3aXRoIHRoZSBDb252ZXJzYXRpb24ncyBsYXN0TWVzc2FnZS5cbiAgICAgIGlmICh0aGlzLmRhdGEubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGlmIChjb252ZXJzYXRpb24gJiYgY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlKSB7XG4gICAgICAgICAgdGhpcy5kYXRhID0gW3RoaXMuX2dldERhdGEoY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlKV07XG4gICAgICAgICAgLy8gVHJpZ2dlciB0aGUgY2hhbmdlIGV2ZW50XG4gICAgICAgICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICAgICAgICB0eXBlOiAnZGF0YScsXG4gICAgICAgICAgICBkYXRhOiBbdGhpcy5fZ2V0RGF0YShjb252ZXJzYXRpb24ubGFzdE1lc3NhZ2UpXSxcbiAgICAgICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICAgICAgdGFyZ2V0OiB0aGlzLmNsaWVudCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIXRoaXMucHJlZGljYXRlLm1hdGNoKC9bJ1wiXS8pKSB7XG4gICAgICBMb2dnZXIuZXJyb3IoJ1RoaXMgcXVlcnkgbWF5IG5lZWQgdG8gcXVvdGUgaXRzIHZhbHVlJyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBBbm5vdW5jZW1lbnRzIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQG1ldGhvZCBfcnVuQW5ub3VuY2VtZW50XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge251bWJlcn0gcGFnZVNpemUgLSBOdW1iZXIgb2YgbmV3IHJlc3VsdHMgdG8gcmVxdWVzdFxuICAgKi9cbiAgX3J1bkFubm91bmNlbWVudChwYWdlU2l6ZSkge1xuICAgIC8vIFJldHJpZXZlIGRhdGEgZnJvbSBkYiBjYWNoZSBpbiBwYXJhbGxlbCB3aXRoIGxvYWRpbmcgZGF0YSBmcm9tIHNlcnZlclxuICAgIHRoaXMuY2xpZW50LmRiTWFuYWdlci5sb2FkQW5ub3VuY2VtZW50cyh0aGlzLl9uZXh0REJGcm9tSWQsIHBhZ2VTaXplLCAobWVzc2FnZXMpID0+IHtcbiAgICAgIGlmIChtZXNzYWdlcy5sZW5ndGgpIHRoaXMuX2FwcGVuZFJlc3VsdHMoeyBkYXRhOiBtZXNzYWdlcyB9LCB0cnVlKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IG5ld1JlcXVlc3QgPSBgYW5ub3VuY2VtZW50cz9wYWdlX3NpemU9JHtwYWdlU2l6ZX1gICtcbiAgICAgICh0aGlzLl9uZXh0U2VydmVyRnJvbUlkID8gJyZmcm9tX2lkPScgKyB0aGlzLl9uZXh0U2VydmVyRnJvbUlkIDogJycpO1xuXG4gICAgLy8gRG9uJ3QgcmVwZWF0IHN0aWxsIGZpcmluZyBxdWVyaWVzXG4gICAgaWYgKG5ld1JlcXVlc3QgIT09IHRoaXMuX2ZpcmluZ1JlcXVlc3QpIHtcbiAgICAgIHRoaXMuaXNGaXJpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fZmlyaW5nUmVxdWVzdCA9IG5ld1JlcXVlc3Q7XG4gICAgICB0aGlzLmNsaWVudC54aHIoe1xuICAgICAgICB1cmw6IG5ld1JlcXVlc3QsXG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgfSwgcmVzdWx0cyA9PiB0aGlzLl9wcm9jZXNzUnVuUmVzdWx0cyhyZXN1bHRzLCBuZXdSZXF1ZXN0LCBwYWdlU2l6ZSkpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgSWRlbnRpdGllcyBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBtZXRob2QgX3J1bklkZW50aXRpZXNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bnVtYmVyfSBwYWdlU2l6ZSAtIE51bWJlciBvZiBuZXcgcmVzdWx0cyB0byByZXF1ZXN0XG4gICAqL1xuICBfcnVuSWRlbnRpdHkocGFnZVNpemUpIHtcbiAgICAvLyBUaGVyZSBpcyBub3QgeWV0IHN1cHBvcnQgZm9yIHBhZ2luZyBJZGVudGl0aWVzOyAgYXMgYWxsIGlkZW50aXRpZXMgYXJlIGxvYWRlZCxcbiAgICAvLyBpZiB0aGVyZSBpcyBhIF9uZXh0REJGcm9tSWQsIHdlIG5vIGxvbmdlciBuZWVkIHRvIGdldCBhbnkgbW9yZSBmcm9tIHRoZSBkYXRhYmFzZVxuICAgIGlmICghdGhpcy5fbmV4dERCRnJvbUlkKSB7XG4gICAgICB0aGlzLmNsaWVudC5kYk1hbmFnZXIubG9hZElkZW50aXRpZXMoKGlkZW50aXRpZXMpID0+IHtcbiAgICAgICAgaWYgKGlkZW50aXRpZXMubGVuZ3RoKSB0aGlzLl9hcHBlbmRSZXN1bHRzKHsgZGF0YTogaWRlbnRpdGllcyB9LCB0cnVlKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IG5ld1JlcXVlc3QgPSBgaWRlbnRpdGllcz9wYWdlX3NpemU9JHtwYWdlU2l6ZX1gICtcbiAgICAgICh0aGlzLl9uZXh0U2VydmVyRnJvbUlkID8gJyZmcm9tX2lkPScgKyB0aGlzLl9uZXh0U2VydmVyRnJvbUlkIDogJycpO1xuXG4gICAgLy8gRG9uJ3QgcmVwZWF0IHN0aWxsIGZpcmluZyBxdWVyaWVzXG4gICAgaWYgKG5ld1JlcXVlc3QgIT09IHRoaXMuX2ZpcmluZ1JlcXVlc3QpIHtcbiAgICAgIHRoaXMuaXNGaXJpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5fZmlyaW5nUmVxdWVzdCA9IG5ld1JlcXVlc3Q7XG4gICAgICB0aGlzLmNsaWVudC54aHIoe1xuICAgICAgICB1cmw6IG5ld1JlcXVlc3QsXG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHN5bmM6IGZhbHNlLFxuICAgICAgfSwgcmVzdWx0cyA9PiB0aGlzLl9wcm9jZXNzUnVuUmVzdWx0cyhyZXN1bHRzLCBuZXdSZXF1ZXN0LCBwYWdlU2l6ZSkpO1xuICAgIH1cbiAgfVxuXG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgdGhlIHJlc3VsdHMgb2YgdGhlIGBfcnVuYCBtZXRob2Q7IGNhbGxzIF9fYXBwZW5kUmVzdWx0cy5cbiAgICpcbiAgICogQG1ldGhvZCBfcHJvY2Vzc1J1blJlc3VsdHNcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHRzIC0gRnVsbCB4aHIgcmVzcG9uc2Ugb2JqZWN0IHdpdGggc2VydmVyIHJlc3VsdHNcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHBhZ2VTaXplIC0gTnVtYmVyIG9mIGVudHJpZXMgdGhhdCB3ZXJlIHJlcXVlc3RlZFxuICAgKi9cbiAgX3Byb2Nlc3NSdW5SZXN1bHRzKHJlc3VsdHMsIHJlcXVlc3RVcmwsIHBhZ2VTaXplKSB7XG4gICAgaWYgKHJlcXVlc3RVcmwgIT09IHRoaXMuX2ZpcmluZ1JlcXVlc3QgfHwgdGhpcy5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuICAgIGNvbnN0IGlzU3luY2luZyA9IHJlc3VsdHMueGhyLmdldFJlc3BvbnNlSGVhZGVyKCdMYXllci1Db252ZXJzYXRpb24tSXMtU3luY2luZycpID09PSAndHJ1ZSc7XG5cblxuICAgIC8vIGlzRmlyaW5nIGlzIGZhbHNlLi4uIHVubGVzcyB3ZSBhcmUgc3RpbGwgc3luY2luZ1xuICAgIHRoaXMuaXNGaXJpbmcgPSBpc1N5bmNpbmc7XG4gICAgdGhpcy5fZmlyaW5nUmVxdWVzdCA9ICcnO1xuICAgIGlmIChyZXN1bHRzLnN1Y2Nlc3MpIHtcbiAgICAgIGlmIChpc1N5bmNpbmcpIHtcbiAgICAgICAgdGhpcy5faXNTeW5jaW5nSWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICB0aGlzLl9pc1N5bmNpbmdJZCA9IDA7XG4gICAgICAgICAgdGhpcy5fcnVuKClcbiAgICAgICAgfSwgMTUwMCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9pc1N5bmNpbmdJZCA9IDA7XG4gICAgICAgIHRoaXMuX2FwcGVuZFJlc3VsdHMocmVzdWx0cywgZmFsc2UpO1xuICAgICAgICB0aGlzLnRvdGFsU2l6ZSA9IE51bWJlcihyZXN1bHRzLnhoci5nZXRSZXNwb25zZUhlYWRlcignTGF5ZXItQ291bnQnKSk7XG5cbiAgICAgICAgaWYgKHJlc3VsdHMuZGF0YS5sZW5ndGggPCBwYWdlU2l6ZSkgdGhpcy5wYWdlZFRvRW5kID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy50cmlnZ2VyKCdlcnJvcicsIHsgZXJyb3I6IHJlc3VsdHMuZGF0YSB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQXBwZW5kcyBhcnJheXMgb2YgZGF0YSB0byB0aGUgUXVlcnkgcmVzdWx0cy5cbiAgICpcbiAgICogQG1ldGhvZCAgX2FwcGVuZFJlc3VsdHNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9hcHBlbmRSZXN1bHRzKHJlc3VsdHMsIGZyb21EYikge1xuICAgIC8vIEZvciBhbGwgcmVzdWx0cywgcmVnaXN0ZXIgdGhlbSB3aXRoIHRoZSBjbGllbnRcbiAgICAvLyBJZiBhbHJlYWR5IHJlZ2lzdGVyZWQgd2l0aCB0aGUgY2xpZW50LCBwcm9wZXJ0aWVzIHdpbGwgYmUgdXBkYXRlZCBhcyBuZWVkZWRcbiAgICAvLyBEYXRhYmFzZSByZXN1bHRzIHJhdGhlciB0aGFuIHNlcnZlciByZXN1bHRzIHdpbGwgYXJyaXZlIGFscmVhZHkgcmVnaXN0ZXJlZC5cbiAgICByZXN1bHRzLmRhdGEuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgICAgaWYgKCEoaXRlbSBpbnN0YW5jZW9mIFJvb3QpKSB0aGlzLmNsaWVudC5fY3JlYXRlT2JqZWN0KGl0ZW0pO1xuICAgIH0pO1xuXG4gICAgLy8gRmlsdGVyIHJlc3VsdHMgdG8ganVzdCB0aGUgbmV3IHJlc3VsdHNcbiAgICBjb25zdCBuZXdSZXN1bHRzID0gcmVzdWx0cy5kYXRhLmZpbHRlcihpdGVtID0+IHRoaXMuX2dldEluZGV4KGl0ZW0uaWQpID09PSAtMSk7XG5cbiAgICAvLyBVcGRhdGUgdGhlIG5leHQgSUQgdG8gdXNlIGluIHBhZ2luYXRpb25cbiAgICBjb25zdCByZXN1bHRMZW5ndGggPSByZXN1bHRzLmRhdGEubGVuZ3RoO1xuICAgIGlmIChyZXN1bHRMZW5ndGgpIHtcbiAgICAgIGlmIChmcm9tRGIpIHtcbiAgICAgICAgdGhpcy5fbmV4dERCRnJvbUlkID0gcmVzdWx0cy5kYXRhW3Jlc3VsdExlbmd0aCAtIDFdLmlkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fbmV4dFNlcnZlckZyb21JZCA9IHJlc3VsdHMuZGF0YVtyZXN1bHRMZW5ndGggLSAxXS5pZDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBVcGRhdGUgdGhpcy5kYXRhXG4gICAgaWYgKHRoaXMuZGF0YVR5cGUgPT09IFF1ZXJ5Lk9iamVjdERhdGFUeXBlKSB7XG4gICAgICB0aGlzLmRhdGEgPSBbXS5jb25jYXQodGhpcy5kYXRhKTtcbiAgICB9XG4gICAgY29uc3QgZGF0YSA9IHRoaXMuZGF0YTtcblxuICAgIC8vIEluc2VydCB0aGUgcmVzdWx0cy4uLiBpZiB0aGUgcmVzdWx0cyBhcmUgYSBtYXRjaFxuICAgIG5ld1Jlc3VsdHMuZm9yRWFjaCgoaXRlbUluKSA9PiB7XG4gICAgICBsZXQgaW5kZXg7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5jbGllbnQuX2dldE9iamVjdChpdGVtSW4uaWQpO1xuICAgICAgc3dpdGNoICh0aGlzLm1vZGVsKSB7XG4gICAgICAgIGNhc2UgTUVTU0FHRTpcbiAgICAgICAgY2FzZSBBTk5PVU5DRU1FTlQ6XG4gICAgICAgICAgaW5kZXggPSB0aGlzLl9nZXRJbnNlcnRNZXNzYWdlSW5kZXgoaXRlbSwgZGF0YSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQ09OVkVSU0FUSU9OOlxuICAgICAgICAgIGluZGV4ID0gdGhpcy5fZ2V0SW5zZXJ0Q29udmVyc2F0aW9uSW5kZXgoaXRlbSwgZGF0YSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgSURFTlRJVFk6XG4gICAgICAgICAgaW5kZXggPSBkYXRhLmxlbmd0aDtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGRhdGEuc3BsaWNlKGluZGV4LCAwLCB0aGlzLl9nZXREYXRhKGl0ZW0pKTtcbiAgICB9KTtcblxuXG4gICAgLy8gVHJpZ2dlciB0aGUgY2hhbmdlIGV2ZW50XG4gICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICB0eXBlOiAnZGF0YScsXG4gICAgICBkYXRhOiBuZXdSZXN1bHRzLm1hcChpdGVtID0+IHRoaXMuX2dldERhdGEodGhpcy5jbGllbnQuX2dldE9iamVjdChpdGVtLmlkKSkpLFxuICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICB0YXJnZXQ6IHRoaXMuY2xpZW50LFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBjb3JyZWN0bHkgZm9ybWF0dGVkIG9iamVjdCByZXByZXNlbnRpbmcgYSByZXN1bHQuXG4gICAqXG4gICAqIEZvcm1hdCBpcyBzcGVjaWZpZWQgYnkgdGhlIGBkYXRhVHlwZWAgcHJvcGVydHkuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldERhdGFcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuUm9vdH0gaXRlbSAtIENvbnZlcnNhdGlvbiBvciBNZXNzYWdlIGluc3RhbmNlXG4gICAqIEByZXR1cm4ge09iamVjdH0gLSBDb252ZXJzYXRpb24gb3IgTWVzc2FnZSBpbnN0YW5jZSBvciBPYmplY3RcbiAgICovXG4gIF9nZXREYXRhKGl0ZW0pIHtcbiAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgIHJldHVybiBpdGVtLnRvT2JqZWN0KCk7XG4gICAgfVxuICAgIHJldHVybiBpdGVtO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYW4gaW5zdGFuY2UgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHRoZSBpbnB1dCBpcyBpbnN0YW5jZSBvciBvYmplY3RcbiAgICogQG1ldGhvZCBfZ2V0SW5zdGFuY2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5Sb290fE9iamVjdH0gaXRlbSAtIENvbnZlcnNhdGlvbiBvciBNZXNzYWdlIG9iamVjdC9pbnN0YW5jZVxuICAgKiBAcmV0dXJuIHtsYXllci5Sb290fVxuICAgKi9cbiAgX2dldEluc3RhbmNlKGl0ZW0pIHtcbiAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIFJvb3QpIHJldHVybiBpdGVtO1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5fZ2V0T2JqZWN0KGl0ZW0uaWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzayB0aGUgcXVlcnkgZm9yIHRoZSBpdGVtIG1hdGNoaW5nIHRoZSBJRC5cbiAgICpcbiAgICogUmV0dXJucyB1bmRlZmluZWQgaWYgdGhlIElEIGlzIG5vdCBmb3VuZC5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0SXRlbVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGlkXG4gICAqIEByZXR1cm4ge09iamVjdH0gQ29udmVyc2F0aW9uIG9yIE1lc3NhZ2Ugb2JqZWN0IG9yIGluc3RhbmNlXG4gICAqL1xuICBfZ2V0SXRlbShpZCkge1xuICAgIHN3aXRjaCAoVXRpbC50eXBlRnJvbUlEKGlkKSkge1xuICAgICAgY2FzZSAnYW5ub3VuY2VtZW50cyc6XG4gICAgICAgIGlmICh0aGlzLm1vZGVsID09PSBBTk5PVU5DRU1FTlQpIHtcbiAgICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2dldEluZGV4KGlkKTtcbiAgICAgICAgICByZXR1cm4gaW5kZXggPT09IC0xID8gbnVsbCA6IHRoaXMuZGF0YVtpbmRleF07XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdtZXNzYWdlcyc6XG4gICAgICAgIGlmICh0aGlzLm1vZGVsID09PSBNRVNTQUdFKSB7XG4gICAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9nZXRJbmRleChpZCk7XG4gICAgICAgICAgcmV0dXJuIGluZGV4ID09PSAtMSA/IG51bGwgOiB0aGlzLmRhdGFbaW5kZXhdO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMubW9kZWwgPT09IENPTlZFUlNBVElPTikge1xuICAgICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLmRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb24gPSB0aGlzLmRhdGFbaW5kZXhdO1xuICAgICAgICAgICAgaWYgKGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZSAmJiBjb252ZXJzYXRpb24ubGFzdE1lc3NhZ2UuaWQgPT09IGlkKSByZXR1cm4gY29udmVyc2F0aW9uLmxhc3RNZXNzYWdlO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2NvbnZlcnNhdGlvbnMnOlxuICAgICAgICBpZiAodGhpcy5tb2RlbCA9PT0gQ09OVkVSU0FUSU9OKSB7XG4gICAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9nZXRJbmRleChpZCk7XG4gICAgICAgICAgcmV0dXJuIGluZGV4ID09PSAtMSA/IG51bGwgOiB0aGlzLmRhdGFbaW5kZXhdO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnaWRlbnRpdGllcyc6XG4gICAgICAgIGlmICh0aGlzLm1vZGVsID09PSBJREVOVElUWSkge1xuICAgICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoaWQpO1xuICAgICAgICAgIHJldHVybiBpbmRleCA9PT0gLTEgPyBudWxsIDogdGhpcy5kYXRhW2luZGV4XTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBpbmRleCBvZiB0aGUgaXRlbSByZXByZXNlbnRlZCBieSB0aGUgc3BlY2lmaWVkIElEOyBvciByZXR1cm4gLTEuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldEluZGV4XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge3N0cmluZ30gaWRcbiAgICogQHJldHVybiB7bnVtYmVyfVxuICAgKi9cbiAgX2dldEluZGV4KGlkKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGlmICh0aGlzLmRhdGFbaW5kZXhdLmlkID09PSBpZCkgcmV0dXJuIGluZGV4O1xuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIGFueSBjaGFuZ2UgZXZlbnQgcmVjZWl2ZWQgZnJvbSB0aGUgbGF5ZXIuQ2xpZW50LlxuICAgKlxuICAgKiBUaGVzZSBjYW4gYmUgY2F1c2VkIGJ5IHdlYnNvY2tldCBldmVudHMsIGFzIHdlbGwgYXMgbG9jYWxcbiAgICogcmVxdWVzdHMgdG8gY3JlYXRlL2RlbGV0ZS9tb2RpZnkgQ29udmVyc2F0aW9ucyBhbmQgTWVzc2FnZXMuXG4gICAqXG4gICAqIFRoZSBldmVudCBkb2VzIG5vdCBuZWNlc3NhcmlseSBhcHBseSB0byB0aGlzIFF1ZXJ5LCBidXQgdGhlIFF1ZXJ5XG4gICAqIG11c3QgZXhhbWluZSBpdCB0byBkZXRlcm1pbmUgaWYgaXQgYXBwbGllcy5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlQ2hhbmdlRXZlbnRzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudE5hbWUgLSBcIm1lc3NhZ2VzOmFkZFwiLCBcImNvbnZlcnNhdGlvbnM6Y2hhbmdlXCJcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICovXG4gIF9oYW5kbGVDaGFuZ2VFdmVudHMoZXZlbnROYW1lLCBldnQpIHtcbiAgICBzd2l0Y2ggKHRoaXMubW9kZWwpIHtcbiAgICAgIGNhc2UgQ09OVkVSU0FUSU9OOlxuICAgICAgICB0aGlzLl9oYW5kbGVDb252ZXJzYXRpb25FdmVudHMoZXZ0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIE1FU1NBR0U6XG4gICAgICBjYXNlIEFOTk9VTkNFTUVOVDpcbiAgICAgICAgdGhpcy5faGFuZGxlTWVzc2FnZUV2ZW50cyhldnQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgSURFTlRJVFk6XG4gICAgICAgIHRoaXMuX2hhbmRsZUlkZW50aXR5RXZlbnRzKGV2dCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIF9oYW5kbGVDb252ZXJzYXRpb25FdmVudHMoZXZ0KSB7XG4gICAgc3dpdGNoIChldnQuZXZlbnROYW1lKSB7XG5cbiAgICAgIC8vIElmIGEgQ29udmVyc2F0aW9uJ3MgcHJvcGVydHkgaGFzIGNoYW5nZWQsIGFuZCB0aGUgQ29udmVyc2F0aW9uIGlzIGluIHRoaXNcbiAgICAgIC8vIFF1ZXJ5J3MgZGF0YSwgdGhlbiB1cGRhdGUgaXQuXG4gICAgICBjYXNlICdjb252ZXJzYXRpb25zOmNoYW5nZSc6XG4gICAgICAgIHRoaXMuX2hhbmRsZUNvbnZlcnNhdGlvbkNoYW5nZUV2ZW50KGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBhIENvbnZlcnNhdGlvbiBpcyBhZGRlZCwgYW5kIGl0IGlzbid0IGFscmVhZHkgaW4gdGhlIFF1ZXJ5LFxuICAgICAgLy8gYWRkIGl0IGFuZCB0cmlnZ2VyIGFuIGV2ZW50XG4gICAgICBjYXNlICdjb252ZXJzYXRpb25zOmFkZCc6XG4gICAgICAgIHRoaXMuX2hhbmRsZUNvbnZlcnNhdGlvbkFkZEV2ZW50KGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBhIENvbnZlcnNhdGlvbiBpcyBkZWxldGVkLCBhbmQgaXRzIHN0aWxsIGluIG91ciBkYXRhLFxuICAgICAgLy8gcmVtb3ZlIGl0IGFuZCB0cmlnZ2VyIGFuIGV2ZW50LlxuICAgICAgY2FzZSAnY29udmVyc2F0aW9uczpyZW1vdmUnOlxuICAgICAgICB0aGlzLl9oYW5kbGVDb252ZXJzYXRpb25SZW1vdmVFdmVudChldnQpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBUT0RPIFdFQi05Njg6IFJlZmFjdG9yIHRoaXMgaW50byBmdW5jdGlvbnMgZm9yIGluc3RhbmNlLCBvYmplY3QsIHNvcnRCeSBjcmVhdGVkQXQsIHNvcnRCeSBsYXN0TWVzc2FnZVxuICBfaGFuZGxlQ29udmVyc2F0aW9uQ2hhbmdlRXZlbnQoZXZ0KSB7XG4gICAgbGV0IGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoZXZ0LnRhcmdldC5pZCk7XG5cbiAgICAvLyBJZiBpdHMgYW4gSUQgY2hhbmdlIChtYXRjaGluZyBEaXN0aW5jdCBDb252ZXJzYXRpb24gcmV0dXJuZWQgYnkgc2VydmVyKSBtYWtlIHN1cmUgdG8gdXBkYXRlIG91ciBkYXRhLlxuICAgIC8vIElmIGRhdGFUeXBlIGlzIGFuIGluc3RhbmNlLCBpdHMgYmVlbiB1cGRhdGVkIGZvciB1cy5cbiAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgIGNvbnN0IGlkQ2hhbmdlcyA9IGV2dC5nZXRDaGFuZ2VzRm9yKCdpZCcpO1xuICAgICAgaWYgKGlkQ2hhbmdlcy5sZW5ndGgpIHtcbiAgICAgICAgaW5kZXggPSB0aGlzLl9nZXRJbmRleChpZENoYW5nZXNbMF0ub2xkVmFsdWUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIGRhdGFUeXBlIGlzIFwib2JqZWN0XCIgdGhlbiB1cGRhdGUgdGhlIG9iamVjdCBhbmQgb3VyIGFycmF5O1xuICAgIC8vIGVsc2UgdGhlIG9iamVjdCBpcyBhbHJlYWR5IHVwZGF0ZWQuXG4gICAgLy8gSWdub3JlIHJlc3VsdHMgdGhhdCBhcmVuJ3QgYWxyZWFkeSBpbiBvdXIgZGF0YTsgUmVzdWx0cyBhcmUgYWRkZWQgdmlhXG4gICAgLy8gY29udmVyc2F0aW9uczphZGQgZXZlbnRzLiAgV2Vic29ja2V0IE1hbmFnZXIgYXV0b21hdGljYWxseSBsb2FkcyBhbnl0aGluZyB0aGF0IHJlY2VpdmVzIGFuIGV2ZW50XG4gICAgLy8gZm9yIHdoaWNoIHdlIGhhdmUgbm8gb2JqZWN0LCBzbyB3ZSdsbCBnZXQgdGhlIGFkZCBldmVudCBhdCB0aGF0IHRpbWUuXG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgY29uc3Qgc29ydEZpZWxkID0gdGhpcy5fZ2V0U29ydEZpZWxkKCk7XG4gICAgICBjb25zdCByZW9yZGVyID0gZXZ0Lmhhc1Byb3BlcnR5KCdsYXN0TWVzc2FnZScpICYmIHNvcnRGaWVsZCA9PT0gJ2xhc3RfbWVzc2FnZSc7XG4gICAgICBsZXQgbmV3SW5kZXg7XG5cbiAgICAgIGlmICh0aGlzLmRhdGFUeXBlID09PSBRdWVyeS5PYmplY3REYXRhVHlwZSkge1xuICAgICAgICBpZiAoIXJlb3JkZXIpIHtcbiAgICAgICAgICAvLyBSZXBsYWNlIHRoZSBjaGFuZ2VkIENvbnZlcnNhdGlvbiB3aXRoIGEgbmV3IGltbXV0YWJsZSBvYmplY3RcbiAgICAgICAgICB0aGlzLmRhdGEgPSBbXG4gICAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoMCwgaW5kZXgpLFxuICAgICAgICAgICAgZXZ0LnRhcmdldC50b09iamVjdCgpLFxuICAgICAgICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKGluZGV4ICsgMSksXG4gICAgICAgICAgXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdJbmRleCA9IHRoaXMuX2dldEluc2VydENvbnZlcnNhdGlvbkluZGV4KGV2dC50YXJnZXQsIHRoaXMuZGF0YSk7XG4gICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShuZXdJbmRleCwgMCwgdGhpcy5fZ2V0RGF0YShldnQudGFyZ2V0KSk7XG4gICAgICAgICAgdGhpcy5kYXRhID0gdGhpcy5kYXRhLmNvbmNhdChbXSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gRWxzZSBkYXRhVHlwZSBpcyBpbnN0YW5jZSBub3Qgb2JqZWN0XG4gICAgICBlbHNlIHtcbiAgICAgICAgaWYgKHJlb3JkZXIpIHtcbiAgICAgICAgICBuZXdJbmRleCA9IHRoaXMuX2dldEluc2VydENvbnZlcnNhdGlvbkluZGV4KGV2dC50YXJnZXQsIHRoaXMuZGF0YSk7XG4gICAgICAgICAgaWYgKG5ld0luZGV4ICE9PSBpbmRleCkge1xuICAgICAgICAgICAgdGhpcy5kYXRhLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB0aGlzLmRhdGEuc3BsaWNlKG5ld0luZGV4LCAwLCBldnQudGFyZ2V0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVHJpZ2dlciBhICdwcm9wZXJ0eScgZXZlbnRcbiAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICB0eXBlOiAncHJvcGVydHknLFxuICAgICAgICB0YXJnZXQ6IHRoaXMuX2dldERhdGEoZXZ0LnRhcmdldCksXG4gICAgICAgIHF1ZXJ5OiB0aGlzLFxuICAgICAgICBpc0NoYW5nZTogdHJ1ZSxcbiAgICAgICAgY2hhbmdlczogZXZ0LmNoYW5nZXMsXG4gICAgICB9KTtcblxuICAgICAgaWYgKHJlb3JkZXIgJiYgbmV3SW5kZXggIT09IGluZGV4KSB7XG4gICAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICAgIHR5cGU6ICdtb3ZlJyxcbiAgICAgICAgICB0YXJnZXQ6IHRoaXMuX2dldERhdGEoZXZ0LnRhcmdldCksXG4gICAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICAgICAgaXNDaGFuZ2U6IGZhbHNlLFxuICAgICAgICAgIGZyb21JbmRleDogaW5kZXgsXG4gICAgICAgICAgdG9JbmRleDogbmV3SW5kZXhcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgX2dldEluc2VydENvbnZlcnNhdGlvbkluZGV4KGNvbnZlcnNhdGlvbiwgZGF0YSkge1xuICAgIGlmICghY29udmVyc2F0aW9uLmlzU2F2ZWQoKSkgcmV0dXJuIDA7XG4gICAgY29uc3Qgc29ydEZpZWxkID0gdGhpcy5fZ2V0U29ydEZpZWxkKCk7XG4gICAgbGV0IGluZGV4O1xuICAgIGlmIChzb3J0RmllbGQgPT09ICdjcmVhdGVkX2F0Jykge1xuICAgICAgZm9yIChpbmRleCA9IDA7IGluZGV4IDwgZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgY29uc3QgaXRlbSA9IGRhdGFbaW5kZXhdO1xuICAgICAgICBpZiAoaXRlbS5zeW5jU3RhdGUgPT09IFNZTkNfU1RBVEUuTkVXIHx8IGl0ZW0uc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLlNBVklORykgY29udGludWU7XG4gICAgICAgIGlmIChjb252ZXJzYXRpb24uY3JlYXRlZEF0ID49IGl0ZW0uY3JlYXRlZEF0KSBicmVhaztcbiAgICAgIH1cbiAgICAgIHJldHVybiBpbmRleDtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IG9sZEluZGV4ID0gLTE7XG4gICAgICBjb25zdCBkMSA9IGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZSA/IGNvbnZlcnNhdGlvbi5sYXN0TWVzc2FnZS5zZW50QXQgOiBjb252ZXJzYXRpb24uY3JlYXRlZEF0O1xuICAgICAgZm9yIChpbmRleCA9IDA7IGluZGV4IDwgZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgY29uc3QgaXRlbSA9IGRhdGFbaW5kZXhdO1xuICAgICAgICBpZiAoaXRlbS5pZCA9PT0gY29udmVyc2F0aW9uLmlkKSB7XG4gICAgICAgICAgb2xkSW5kZXggPSBpbmRleDtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXRlbS5zeW5jU3RhdGUgPT09IFNZTkNfU1RBVEUuTkVXIHx8IGl0ZW0uc3luY1N0YXRlID09PSBTWU5DX1NUQVRFLlNBVklORykgY29udGludWU7XG4gICAgICAgIGNvbnN0IGQyID0gaXRlbS5sYXN0TWVzc2FnZSA/IGl0ZW0ubGFzdE1lc3NhZ2Uuc2VudEF0IDogaXRlbS5jcmVhdGVkQXQ7XG4gICAgICAgIGlmIChkMSA+PSBkMikgYnJlYWs7XG4gICAgICB9XG4gICAgICByZXR1cm4gb2xkSW5kZXggPT09IC0xIHx8IG9sZEluZGV4ID4gaW5kZXggPyBpbmRleCA6IGluZGV4IC0gMTtcbiAgICB9XG4gIH1cblxuICBfZ2V0SW5zZXJ0TWVzc2FnZUluZGV4KG1lc3NhZ2UsIGRhdGEpIHtcbiAgICBsZXQgaW5kZXg7XG4gICAgZm9yIChpbmRleCA9IDA7IGluZGV4IDwgZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGlmIChtZXNzYWdlLnBvc2l0aW9uID4gZGF0YVtpbmRleF0ucG9zaXRpb24pIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpbmRleDtcbiAgfVxuXG4gIF9oYW5kbGVDb252ZXJzYXRpb25BZGRFdmVudChldnQpIHtcbiAgICAvLyBGaWx0ZXIgb3V0IGFueSBDb252ZXJzYXRpb25zIGFscmVhZHkgaW4gb3VyIGRhdGFcbiAgICBjb25zdCBsaXN0ID0gZXZ0LmNvbnZlcnNhdGlvbnNcbiAgICAgICAgICAgICAgICAgIC5maWx0ZXIoY29udmVyc2F0aW9uID0+IHRoaXMuX2dldEluZGV4KGNvbnZlcnNhdGlvbi5pZCkgPT09IC0xKTtcblxuICAgIGlmIChsaXN0Lmxlbmd0aCkge1xuICAgICAgY29uc3QgZGF0YSA9IHRoaXMuZGF0YTtcbiAgICAgIGxpc3QuZm9yRWFjaCgoY29udmVyc2F0aW9uKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld0luZGV4ID0gdGhpcy5fZ2V0SW5zZXJ0Q29udmVyc2F0aW9uSW5kZXgoY29udmVyc2F0aW9uLCBkYXRhKTtcbiAgICAgICAgZGF0YS5zcGxpY2UobmV3SW5kZXgsIDAsIHRoaXMuX2dldERhdGEoY29udmVyc2F0aW9uKSk7XG4gICAgICB9KTtcblxuICAgICAgLy8gV2hldGhlciBzb3J0aW5nIGJ5IGxhc3RfbWVzc2FnZSBvciBjcmVhdGVkX2F0LCBuZXcgcmVzdWx0cyBnbyBhdCB0aGUgdG9wIG9mIHRoZSBsaXN0XG4gICAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgICAgdGhpcy5kYXRhID0gW10uY29uY2F0KGRhdGEpO1xuICAgICAgfVxuICAgICAgdGhpcy50b3RhbFNpemUgKz0gbGlzdC5sZW5ndGg7XG5cbiAgICAgIC8vIFRyaWdnZXIgYW4gJ2luc2VydCcgZXZlbnQgZm9yIGVhY2ggaXRlbSBhZGRlZDtcbiAgICAgIC8vIHR5cGljYWxseSBidWxrIGluc2VydHMgaGFwcGVuIHZpYSBfYXBwZW5kUmVzdWx0cygpLlxuICAgICAgbGlzdC5mb3JFYWNoKChjb252ZXJzYXRpb24pID0+IHtcbiAgICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX2dldERhdGEoY29udmVyc2F0aW9uKTtcbiAgICAgICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICAgICAgdHlwZTogJ2luc2VydCcsXG4gICAgICAgICAgaW5kZXg6IHRoaXMuZGF0YS5pbmRleE9mKGl0ZW0pLFxuICAgICAgICAgIHRhcmdldDogaXRlbSxcbiAgICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuXG4gIF9oYW5kbGVDb252ZXJzYXRpb25SZW1vdmVFdmVudChldnQpIHtcbiAgICBjb25zdCByZW1vdmVkID0gW107XG4gICAgZXZ0LmNvbnZlcnNhdGlvbnMuZm9yRWFjaCgoY29udmVyc2F0aW9uKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2dldEluZGV4KGNvbnZlcnNhdGlvbi5pZCk7XG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIGlmIChjb252ZXJzYXRpb24uaWQgPT09IHRoaXMuX25leHREQkZyb21JZCkgdGhpcy5fbmV4dERCRnJvbUlkID0gdGhpcy5fdXBkYXRlTmV4dEZyb21JZChpbmRleCk7XG4gICAgICAgIGlmIChjb252ZXJzYXRpb24uaWQgPT09IHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQpIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPSB0aGlzLl91cGRhdGVOZXh0RnJvbUlkKGluZGV4KTtcbiAgICAgICAgcmVtb3ZlZC5wdXNoKHtcbiAgICAgICAgICBkYXRhOiBjb252ZXJzYXRpb24sXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgICAgICB0aGlzLmRhdGEgPSBbLi4udGhpcy5kYXRhLnNsaWNlKDAsIGluZGV4KSwgLi4udGhpcy5kYXRhLnNsaWNlKGluZGV4ICsgMSldO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZGF0YS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnRvdGFsU2l6ZSAtPSByZW1vdmVkLmxlbmd0aDtcbiAgICByZW1vdmVkLmZvckVhY2goKHJlbW92ZWRPYmopID0+IHtcbiAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICB0eXBlOiAncmVtb3ZlJyxcbiAgICAgICAgaW5kZXg6IHJlbW92ZWRPYmouaW5kZXgsXG4gICAgICAgIHRhcmdldDogdGhpcy5fZ2V0RGF0YShyZW1vdmVkT2JqLmRhdGEpLFxuICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgX2hhbmRsZU1lc3NhZ2VFdmVudHMoZXZ0KSB7XG4gICAgc3dpdGNoIChldnQuZXZlbnROYW1lKSB7XG5cbiAgICAgIC8vIElmIGEgQ29udmVyc2F0aW9uJ3MgSUQgaGFzIGNoYW5nZWQsIGNoZWNrIG91ciBwcmVkaWNhdGUsIGFuZCB1cGRhdGUgaXQgYXV0b21hdGljYWxseSBpZiBuZWVkZWQuXG4gICAgICBjYXNlICdjb252ZXJzYXRpb25zOmNoYW5nZSc6XG4gICAgICAgIGlmICh0aGlzLm1vZGVsID09PSBNRVNTQUdFKSB0aGlzLl9oYW5kbGVNZXNzYWdlQ29udklkQ2hhbmdlRXZlbnQoZXZ0KTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIC8vIElmIGEgTWVzc2FnZSBoYXMgY2hhbmdlZCBhbmQgaXRzIGluIG91ciByZXN1bHQgc2V0LCByZXBsYWNlXG4gICAgICAvLyBpdCB3aXRoIGEgbmV3IGltbXV0YWJsZSBvYmplY3RcbiAgICAgIGNhc2UgJ21lc3NhZ2VzOmNoYW5nZSc6XG4gICAgICBjYXNlICdtZXNzYWdlczpyZWFkJzpcbiAgICAgICAgdGhpcy5faGFuZGxlTWVzc2FnZUNoYW5nZUV2ZW50KGV2dCk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICAvLyBJZiBNZXNzYWdlcyBhcmUgYWRkZWQsIGFuZCB0aGV5IGFyZW4ndCBhbHJlYWR5IGluIG91ciByZXN1bHQgc2V0XG4gICAgICAvLyBhZGQgdGhlbS5cbiAgICAgIGNhc2UgJ21lc3NhZ2VzOmFkZCc6XG4gICAgICAgIHRoaXMuX2hhbmRsZU1lc3NhZ2VBZGRFdmVudChldnQpO1xuICAgICAgICBicmVhaztcblxuICAgICAgLy8gSWYgYSBNZXNzYWdlIGlzIGRlbGV0ZWQgYW5kIGl0cyBpbiBvdXIgcmVzdWx0IHNldCwgcmVtb3ZlIGl0XG4gICAgICAvLyBhbmQgdHJpZ2dlciBhbiBldmVudFxuICAgICAgY2FzZSAnbWVzc2FnZXM6cmVtb3ZlJzpcbiAgICAgICAgdGhpcy5faGFuZGxlTWVzc2FnZVJlbW92ZUV2ZW50KGV2dCk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBIENvbnZlcnNhdGlvbiBJRCBjaGFuZ2VzIGlmIGEgbWF0Y2hpbmcgRGlzdGluY3QgQ29udmVyc2F0aW9uIHdhcyBmb3VuZCBvbiB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBJZiB0aGlzIFF1ZXJ5J3MgQ29udmVyc2F0aW9uJ3MgSUQgaGFzIGNoYW5nZWQsIHVwZGF0ZSB0aGUgcHJlZGljYXRlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVNZXNzYWdlQ29udklkQ2hhbmdlRXZlbnRcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnQgLSBBIE1lc3NhZ2UgQ2hhbmdlIEV2ZW50XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfaGFuZGxlTWVzc2FnZUNvbnZJZENoYW5nZUV2ZW50KGV2dCkge1xuICAgIGNvbnN0IGNpZENoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcignaWQnKTtcbiAgICBpZiAoY2lkQ2hhbmdlcy5sZW5ndGgpIHtcbiAgICAgIGlmICh0aGlzLl9wcmVkaWNhdGUgPT09IGNpZENoYW5nZXNbMF0ub2xkVmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcHJlZGljYXRlID0gY2lkQ2hhbmdlc1swXS5uZXdWYWx1ZTtcbiAgICAgICAgdGhpcy5wcmVkaWNhdGUgPSBcImNvbnZlcnNhdGlvbi5pZCA9ICdcIiArIHRoaXMuX3ByZWRpY2F0ZSArIFwiJ1wiO1xuICAgICAgICB0aGlzLl9ydW4oKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSWYgdGhlIElEIG9mIHRoZSBtZXNzYWdlIGhhcyBjaGFuZ2VkLCB0aGVuIHRoZSBwb3NpdGlvbiBwcm9wZXJ0eSBoYXMgbGlrZWx5IGNoYW5nZWQgYXMgd2VsbC5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgdGVzdHMgdG8gc2VlIGlmIGNoYW5nZXMgdG8gdGhlIHBvc2l0aW9uIHByb3BlcnR5IGhhdmUgaW1wYWN0ZWQgdGhlIG1lc3NhZ2UncyBwb3NpdGlvbiBpbiB0aGVcbiAgICogZGF0YSBhcnJheS4uLiBhbmQgdXBkYXRlcyB0aGUgYXJyYXkgaWYgaXQgaGFzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9oYW5kbGVNZXNzYWdlUG9zaXRpb25DaGFuZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5MYXllckV2ZW50fSBldnQgIEEgTWVzc2FnZSBDaGFuZ2UgZXZlbnRcbiAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4ICBJbmRleCBvZiB0aGUgbWVzc2FnZSBpbiB0aGUgY3VycmVudCBkYXRhIGFycmF5XG4gICAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgYSBkYXRhIHdhcyBjaGFuZ2VkIGFuZCBhIGNoYW5nZSBldmVudCB3YXMgZW1pdHRlZFxuICAgKi9cbiAgX2hhbmRsZU1lc3NhZ2VQb3NpdGlvbkNoYW5nZShldnQsIGluZGV4KSB7XG4gICAgLy8gSWYgdGhlIG1lc3NhZ2UgaXMgbm90IGluIHRoZSBjdXJyZW50IGRhdGEsIHRoZW4gdGhlcmUgaXMgbm8gY2hhbmdlIHRvIG91ciBxdWVyeSByZXN1bHRzLlxuICAgIGlmIChpbmRleCA9PT0gLTEpIHJldHVybiBmYWxzZTtcblxuICAgIC8vIENyZWF0ZSBhbiBhcnJheSB3aXRob3V0IG91ciBkYXRhIGl0ZW0gYW5kIHRoZW4gZmluZCBvdXQgd2hlcmUgdGhlIGRhdGEgaXRlbSBTaG91bGQgYmUgaW5zZXJ0ZWQuXG4gICAgLy8gTm90ZTogd2UgY291bGQganVzdCBsb29rdXAgdGhlIHBvc2l0aW9uIGluIG91ciBjdXJyZW50IGRhdGEgYXJyYXksIGJ1dCBpdHMgdG9vIGVhc3kgdG8gaW50cm9kdWNlXG4gICAgLy8gZXJyb3JzIHdoZXJlIGNvbXBhcmluZyB0aGlzIG1lc3NhZ2UgdG8gaXRzZWxmIG1heSB5aWVsZCBpbmRleCBvciBpbmRleCArIDEuXG4gICAgY29uc3QgbmV3RGF0YSA9IFtcbiAgICAgIC4uLnRoaXMuZGF0YS5zbGljZSgwLCBpbmRleCksXG4gICAgICAuLi50aGlzLmRhdGEuc2xpY2UoaW5kZXggKyAxKSxcbiAgICBdO1xuICAgIGNvbnN0IG5ld0luZGV4ID0gdGhpcy5fZ2V0SW5zZXJ0TWVzc2FnZUluZGV4KGV2dC50YXJnZXQsIG5ld0RhdGEpO1xuXG4gICAgLy8gSWYgdGhlIGRhdGEgaXRlbSBnb2VzIGluIHRoZSBzYW1lIGluZGV4IGFzIGJlZm9yZSwgdGhlbiB0aGVyZSBpcyBubyBjaGFuZ2UgdG8gYmUgaGFuZGxlZCBoZXJlO1xuICAgIC8vIGVsc2UgaW5zZXJ0IHRoZSBpdGVtIGF0IHRoZSByaWdodCBpbmRleCwgdXBkYXRlIHRoaXMuZGF0YSBhbmQgZmlyZSBhIGNoYW5nZSBldmVudFxuICAgIGlmIChuZXdJbmRleCAhPT0gaW5kZXgpIHtcbiAgICAgIG5ld0RhdGEuc3BsaWNlKG5ld0luZGV4LCAwLCB0aGlzLl9nZXREYXRhKGV2dC50YXJnZXQpKTtcbiAgICAgIHRoaXMuZGF0YSA9IG5ld0RhdGE7XG4gICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgdHlwZTogJ3Byb3BlcnR5JyxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKGV2dC50YXJnZXQpLFxuICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgICAgaXNDaGFuZ2U6IHRydWUsXG4gICAgICAgIGNoYW5nZXM6IGV2dC5jaGFuZ2VzLFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgX2hhbmRsZU1lc3NhZ2VDaGFuZ2VFdmVudChldnQpIHtcbiAgICBsZXQgaW5kZXggPSB0aGlzLl9nZXRJbmRleChldnQudGFyZ2V0LmlkKTtcbiAgICBjb25zdCBwb3NpdGlvbkNoYW5nZXMgPSBldnQuZ2V0Q2hhbmdlc0ZvcigncG9zaXRpb24nKTtcblxuICAgIC8vIElmIHRoZXJlIGFyZSBwb3NpdGlvbiBjaGFuZ2VzLCBoYW5kbGUgdGhlbS4gIElmIGFsbCB0aGUgY2hhbmdlcyBhcmUgcG9zaXRpb24gY2hhbmdlcyxcbiAgICAvLyBleGl0IHdoZW4gZG9uZS5cbiAgICBpZiAocG9zaXRpb25DaGFuZ2VzLmxlbmd0aCkge1xuICAgICAgaWYgKHRoaXMuX2hhbmRsZU1lc3NhZ2VQb3NpdGlvbkNoYW5nZShldnQsIGluZGV4KSkge1xuICAgICAgICBpZiAocG9zaXRpb25DaGFuZ2VzLmxlbmd0aCA9PT0gZXZ0LmNoYW5nZXMubGVuZ3RoKSByZXR1cm47XG4gICAgICAgIGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoZXZ0LnRhcmdldC5pZCk7IC8vIEdldCB0aGUgdXBkYXRlZCBwb3NpdGlvblxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgIGlmICh0aGlzLmRhdGFUeXBlID09PSBRdWVyeS5PYmplY3REYXRhVHlwZSkge1xuICAgICAgICB0aGlzLmRhdGEgPSBbXG4gICAgICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKDAsIGluZGV4KSxcbiAgICAgICAgICBldnQudGFyZ2V0LnRvT2JqZWN0KCksXG4gICAgICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKGluZGV4ICsgMSksXG4gICAgICAgIF07XG4gICAgICB9XG4gICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgdHlwZTogJ3Byb3BlcnR5JyxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKGV2dC50YXJnZXQpLFxuICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgICAgaXNDaGFuZ2U6IHRydWUsXG4gICAgICAgIGNoYW5nZXM6IGV2dC5jaGFuZ2VzLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgX2hhbmRsZU1lc3NhZ2VBZGRFdmVudChldnQpIHtcbiAgICAvLyBPbmx5IHVzZSBhZGRlZCBtZXNzYWdlcyB0aGF0IGFyZSBwYXJ0IG9mIHRoaXMgQ29udmVyc2F0aW9uXG4gICAgLy8gYW5kIG5vdCBhbHJlYWR5IGluIG91ciByZXN1bHQgc2V0XG4gICAgY29uc3QgbGlzdCA9IGV2dC5tZXNzYWdlc1xuICAgICAgLy8gRmlsdGVyIHNvIHRoYXQgd2Ugb25seSBzZWUgTWVzc2FnZXMgaWYgZG9pbmcgYSBNZXNzYWdlcyBxdWVyeSBvciBBbm5vdW5jZW1lbnRzIGlmIGRvaW5nIGFuIEFubm91bmNlbWVudHMgUXVlcnkuXG4gICAgICAuZmlsdGVyKG1lc3NhZ2UgPT4ge1xuICAgICAgICBjb25zdCB0eXBlID0gVXRpbC50eXBlRnJvbUlEKG1lc3NhZ2UuaWQpO1xuICAgICAgICByZXR1cm4gdHlwZSA9PT0gJ21lc3NhZ2VzJyAmJiB0aGlzLm1vZGVsID09PSBNRVNTQUdFIHx8XG4gICAgICAgICAgICAgICAgdHlwZSA9PT0gJ2Fubm91bmNlbWVudHMnICYmIHRoaXMubW9kZWwgPT09IEFOTk9VTkNFTUVOVDtcbiAgICAgIH0pXG4gICAgICAvLyBGaWx0ZXIgb3V0IE1lc3NhZ2VzIHRoYXQgYXJlbid0IHBhcnQgb2YgdGhpcyBDb252ZXJzYXRpb25cbiAgICAgIC5maWx0ZXIobWVzc2FnZSA9PiB7XG4gICAgICAgIGNvbnN0IHR5cGUgPSBVdGlsLnR5cGVGcm9tSUQobWVzc2FnZS5pZCk7XG4gICAgICAgIHJldHVybiB0eXBlID09PSAnYW5ub3VuY2VtZW50cycgfHwgbWVzc2FnZS5jb252ZXJzYXRpb25JZCA9PT0gdGhpcy5fcHJlZGljYXRlO1xuICAgICAgfSlcbiAgICAgIC8vIEZpbHRlciBvdXQgTWVzc2FnZXMgdGhhdCBhcmUgYWxyZWFkeSBpbiBvdXIgZGF0YSBzZXRcbiAgICAgIC5maWx0ZXIobWVzc2FnZSA9PiB0aGlzLl9nZXRJbmRleChtZXNzYWdlLmlkKSA9PT0gLTEpXG4gICAgICAubWFwKG1lc3NhZ2UgPT4gdGhpcy5fZ2V0RGF0YShtZXNzYWdlKSk7XG5cbiAgICAvLyBBZGQgdGhlbSB0byBvdXIgcmVzdWx0IHNldCBhbmQgdHJpZ2dlciBhbiBldmVudCBmb3IgZWFjaCBvbmVcbiAgICBpZiAobGlzdC5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLmRhdGEgPSB0aGlzLmRhdGFUeXBlID09PSBRdWVyeS5PYmplY3REYXRhVHlwZSA/IFtdLmNvbmNhdCh0aGlzLmRhdGEpIDogdGhpcy5kYXRhO1xuICAgICAgbGlzdC5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fZ2V0SW5zZXJ0TWVzc2FnZUluZGV4KGl0ZW0sIGRhdGEpO1xuICAgICAgICBkYXRhLnNwbGljZShpbmRleCwgMCwgaXRlbSk7XG4gICAgICB9KTtcblxuICAgICAgdGhpcy50b3RhbFNpemUgKz0gbGlzdC5sZW5ndGg7XG5cbiAgICAgIC8vIEluZGV4IGNhbGN1bGF0ZWQgYWJvdmUgbWF5IHNoaWZ0IGFmdGVyIGFkZGl0aW9uYWwgaW5zZXJ0aW9ucy4gIFRoaXMgaGFzXG4gICAgICAvLyB0byBiZSBkb25lIGFmdGVyIHRoZSBhYm92ZSBpbnNlcnRpb25zIGhhdmUgY29tcGxldGVkLlxuICAgICAgbGlzdC5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICAgIHR5cGU6ICdpbnNlcnQnLFxuICAgICAgICAgIGluZGV4OiB0aGlzLmRhdGEuaW5kZXhPZihpdGVtKSxcbiAgICAgICAgICB0YXJnZXQ6IGl0ZW0sXG4gICAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgX2hhbmRsZU1lc3NhZ2VSZW1vdmVFdmVudChldnQpIHtcbiAgICBjb25zdCByZW1vdmVkID0gW107XG4gICAgZXZ0Lm1lc3NhZ2VzLmZvckVhY2goKG1lc3NhZ2UpID0+IHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgobWVzc2FnZS5pZCk7XG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIGlmIChtZXNzYWdlLmlkID09PSB0aGlzLl9uZXh0REJGcm9tSWQpIHRoaXMuX25leHREQkZyb21JZCA9IHRoaXMuX3VwZGF0ZU5leHRGcm9tSWQoaW5kZXgpO1xuICAgICAgICBpZiAobWVzc2FnZS5pZCA9PT0gdGhpcy5fbmV4dFNlcnZlckZyb21JZCkgdGhpcy5fbmV4dFNlcnZlckZyb21JZCA9IHRoaXMuX3VwZGF0ZU5leHRGcm9tSWQoaW5kZXgpO1xuICAgICAgICByZW1vdmVkLnB1c2goe1xuICAgICAgICAgIGRhdGE6IG1lc3NhZ2UsXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgICAgICB0aGlzLmRhdGEgPSBbXG4gICAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoMCwgaW5kZXgpLFxuICAgICAgICAgICAgLi4udGhpcy5kYXRhLnNsaWNlKGluZGV4ICsgMSksXG4gICAgICAgICAgXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmRhdGEuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy50b3RhbFNpemUgLT0gcmVtb3ZlZC5sZW5ndGg7XG4gICAgcmVtb3ZlZC5mb3JFYWNoKChyZW1vdmVkT2JqKSA9PiB7XG4gICAgICB0aGlzLl90cmlnZ2VyQ2hhbmdlKHtcbiAgICAgICAgdHlwZTogJ3JlbW92ZScsXG4gICAgICAgIHRhcmdldDogdGhpcy5fZ2V0RGF0YShyZW1vdmVkT2JqLmRhdGEpLFxuICAgICAgICBpbmRleDogcmVtb3ZlZE9iai5pbmRleCxcbiAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIF9oYW5kbGVJZGVudGl0eUV2ZW50cyhldnQpIHtcbiAgICBzd2l0Y2ggKGV2dC5ldmVudE5hbWUpIHtcblxuICAgICAgLy8gSWYgYSBJZGVudGl0eSBoYXMgY2hhbmdlZCBhbmQgaXRzIGluIG91ciByZXN1bHQgc2V0LCByZXBsYWNlXG4gICAgICAvLyBpdCB3aXRoIGEgbmV3IGltbXV0YWJsZSBvYmplY3RcbiAgICAgIGNhc2UgJ2lkZW50aXRpZXM6Y2hhbmdlJzpcbiAgICAgICAgdGhpcy5faGFuZGxlSWRlbnRpdHlDaGFuZ2VFdmVudChldnQpO1xuICAgICAgICBicmVhaztcblxuICAgICAgLy8gSWYgSWRlbnRpdGllcyBhcmUgYWRkZWQsIGFuZCB0aGV5IGFyZW4ndCBhbHJlYWR5IGluIG91ciByZXN1bHQgc2V0XG4gICAgICAvLyBhZGQgdGhlbS5cbiAgICAgIGNhc2UgJ2lkZW50aXRpZXM6YWRkJzpcbiAgICAgICAgdGhpcy5faGFuZGxlSWRlbnRpdHlBZGRFdmVudChldnQpO1xuICAgICAgICBicmVhaztcblxuICAgICAgLy8gSWYgYSBJZGVudGl0eSBpcyBkZWxldGVkIGFuZCBpdHMgaW4gb3VyIHJlc3VsdCBzZXQsIHJlbW92ZSBpdFxuICAgICAgLy8gYW5kIHRyaWdnZXIgYW4gZXZlbnRcbiAgICAgIGNhc2UgJ2lkZW50aXRpZXM6cmVtb3ZlJzpcbiAgICAgICAgdGhpcy5faGFuZGxlSWRlbnRpdHlSZW1vdmVFdmVudChldnQpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuXG4gIF9oYW5kbGVJZGVudGl0eUNoYW5nZUV2ZW50KGV2dCkge1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fZ2V0SW5kZXgoZXZ0LnRhcmdldC5pZCk7XG5cbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICBpZiAodGhpcy5kYXRhVHlwZSA9PT0gUXVlcnkuT2JqZWN0RGF0YVR5cGUpIHtcbiAgICAgICAgdGhpcy5kYXRhID0gW1xuICAgICAgICAgIC4uLnRoaXMuZGF0YS5zbGljZSgwLCBpbmRleCksXG4gICAgICAgICAgZXZ0LnRhcmdldC50b09iamVjdCgpLFxuICAgICAgICAgIC4uLnRoaXMuZGF0YS5zbGljZShpbmRleCArIDEpLFxuICAgICAgICBdO1xuICAgICAgfVxuICAgICAgdGhpcy5fdHJpZ2dlckNoYW5nZSh7XG4gICAgICAgIHR5cGU6ICdwcm9wZXJ0eScsXG4gICAgICAgIHRhcmdldDogdGhpcy5fZ2V0RGF0YShldnQudGFyZ2V0KSxcbiAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICAgIGlzQ2hhbmdlOiB0cnVlLFxuICAgICAgICBjaGFuZ2VzOiBldnQuY2hhbmdlcyxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIF9oYW5kbGVJZGVudGl0eUFkZEV2ZW50KGV2dCkge1xuICAgIGNvbnN0IGxpc3QgPSBldnQuaWRlbnRpdGllc1xuICAgICAgLmZpbHRlcihpZGVudGl0eSA9PiB0aGlzLl9nZXRJbmRleChpZGVudGl0eS5pZCkgPT09IC0xKVxuICAgICAgLm1hcChpZGVudGl0eSA9PiB0aGlzLl9nZXREYXRhKGlkZW50aXR5KSk7XG5cbiAgICAvLyBBZGQgdGhlbSB0byBvdXIgcmVzdWx0IHNldCBhbmQgdHJpZ2dlciBhbiBldmVudCBmb3IgZWFjaCBvbmVcbiAgICBpZiAobGlzdC5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLmRhdGEgPSB0aGlzLmRhdGFUeXBlID09PSBRdWVyeS5PYmplY3REYXRhVHlwZSA/IFtdLmNvbmNhdCh0aGlzLmRhdGEpIDogdGhpcy5kYXRhO1xuICAgICAgbGlzdC5mb3JFYWNoKGl0ZW0gPT4gZGF0YS5wdXNoKGl0ZW0pKTtcblxuICAgICAgdGhpcy50b3RhbFNpemUgKz0gbGlzdC5sZW5ndGg7XG5cbiAgICAgIC8vIEluZGV4IGNhbGN1bGF0ZWQgYWJvdmUgbWF5IHNoaWZ0IGFmdGVyIGFkZGl0aW9uYWwgaW5zZXJ0aW9ucy4gIFRoaXMgaGFzXG4gICAgICAvLyB0byBiZSBkb25lIGFmdGVyIHRoZSBhYm92ZSBpbnNlcnRpb25zIGhhdmUgY29tcGxldGVkLlxuICAgICAgbGlzdC5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICAgIHR5cGU6ICdpbnNlcnQnLFxuICAgICAgICAgIGluZGV4OiB0aGlzLmRhdGEuaW5kZXhPZihpdGVtKSxcbiAgICAgICAgICB0YXJnZXQ6IGl0ZW0sXG4gICAgICAgICAgcXVlcnk6IHRoaXMsXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgX2hhbmRsZUlkZW50aXR5UmVtb3ZlRXZlbnQoZXZ0KSB7XG4gICAgY29uc3QgcmVtb3ZlZCA9IFtdO1xuICAgIGV2dC5pZGVudGl0aWVzLmZvckVhY2goKGlkZW50aXR5KSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2dldEluZGV4KGlkZW50aXR5LmlkKTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgaWYgKGlkZW50aXR5LmlkID09PSB0aGlzLl9uZXh0REJGcm9tSWQpIHRoaXMuX25leHREQkZyb21JZCA9IHRoaXMuX3VwZGF0ZU5leHRGcm9tSWQoaW5kZXgpO1xuICAgICAgICBpZiAoaWRlbnRpdHkuaWQgPT09IHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQpIHRoaXMuX25leHRTZXJ2ZXJGcm9tSWQgPSB0aGlzLl91cGRhdGVOZXh0RnJvbUlkKGluZGV4KTtcbiAgICAgICAgcmVtb3ZlZC5wdXNoKHtcbiAgICAgICAgICBkYXRhOiBpZGVudGl0eSxcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLmRhdGFUeXBlID09PSBRdWVyeS5PYmplY3REYXRhVHlwZSkge1xuICAgICAgICAgIHRoaXMuZGF0YSA9IFtcbiAgICAgICAgICAgIC4uLnRoaXMuZGF0YS5zbGljZSgwLCBpbmRleCksXG4gICAgICAgICAgICAuLi50aGlzLmRhdGEuc2xpY2UoaW5kZXggKyAxKSxcbiAgICAgICAgICBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuZGF0YS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnRvdGFsU2l6ZSAtPSByZW1vdmVkLmxlbmd0aDtcbiAgICByZW1vdmVkLmZvckVhY2goKHJlbW92ZWRPYmopID0+IHtcbiAgICAgIHRoaXMuX3RyaWdnZXJDaGFuZ2Uoe1xuICAgICAgICB0eXBlOiAncmVtb3ZlJyxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLl9nZXREYXRhKHJlbW92ZWRPYmouZGF0YSksXG4gICAgICAgIGluZGV4OiByZW1vdmVkT2JqLmluZGV4LFxuICAgICAgICBxdWVyeTogdGhpcyxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHRoZSBjdXJyZW50IG5leHQtaWQgaXMgcmVtb3ZlZCBmcm9tIHRoZSBsaXN0LCBnZXQgYSBuZXcgbmV4dElkLlxuICAgKlxuICAgKiBJZiB0aGUgaW5kZXggaXMgZ3JlYXRlciB0aGFuIDAsIHdoYXRldmVyIGlzIGFmdGVyIHRoYXQgaW5kZXggbWF5IGhhdmUgY29tZSBmcm9tXG4gICAqIHdlYnNvY2tldHMgb3Igb3RoZXIgc291cmNlcywgc28gZGVjcmVtZW50IHRoZSBpbmRleCB0byBnZXQgdGhlIG5leHQgc2FmZSBwYWdpbmcgaWQuXG4gICAqXG4gICAqIElmIHRoZSBpbmRleCBpZiAwLCBldmVuIGlmIHRoZXJlIGlzIGRhdGEsIHRoYXQgZGF0YSBkaWQgbm90IGNvbWUgZnJvbSBwYWdpbmcgYW5kXG4gICAqIGNhbiBub3QgYmUgdXNlZCBzYWZlbHkgYXMgYSBwYWdpbmcgaWQ7IHJldHVybiAnJztcbiAgICpcbiAgICogQG1ldGhvZCBfdXBkYXRlTmV4dEZyb21JZFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBDdXJyZW50IGluZGV4IG9mIHRoZSBuZXh0RnJvbUlkXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gTmV4dCBJRCBvciBlbXB0eSBzdHJpbmdcbiAgICovXG4gIF91cGRhdGVOZXh0RnJvbUlkKGluZGV4KSB7XG4gICAgaWYgKGluZGV4ID4gMCkgcmV0dXJuIHRoaXMuZGF0YVtpbmRleCAtIDFdLmlkO1xuICAgIGVsc2UgcmV0dXJuICcnO1xuICB9XG5cbiAgLypcbiAgICogSWYgdGhpcyBpcyBldmVyIGNoYW5nZWQgdG8gYmUgYXN5bmMsIG1ha2Ugc3VyZSB0aGF0IGRlc3Ryb3koKSBzdGlsbCB0cmlnZ2VycyBzeW5jaHJvbm91cyBldmVudHNcbiAgICovXG4gIF90cmlnZ2VyQ2hhbmdlKGV2dCkge1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlJywgZXZ0KTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZTonICsgZXZ0LnR5cGUsIGV2dCk7XG4gIH1cblxuICB0b1N0cmluZygpIHtcbiAgICByZXR1cm4gdGhpcy5pZDtcbiAgfVxufVxuXG5cblF1ZXJ5LnByZWZpeFVVSUQgPSAnbGF5ZXI6Ly8vcXVlcmllcy8nO1xuXG4vKipcbiAqIFF1ZXJ5IGZvciBDb252ZXJzYXRpb25zLlxuICpcbiAqIFVzZSB0aGlzIHZhbHVlIGluIHRoZSBsYXllci5RdWVyeS5tb2RlbCBwcm9wZXJ0eS5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cblF1ZXJ5LkNvbnZlcnNhdGlvbiA9IENPTlZFUlNBVElPTjtcblxuLyoqXG4gKiBRdWVyeSBmb3IgTWVzc2FnZXMuXG4gKlxuICogVXNlIHRoaXMgdmFsdWUgaW4gdGhlIGxheWVyLlF1ZXJ5Lm1vZGVsIHByb3BlcnR5LlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuUXVlcnkuTWVzc2FnZSA9IE1FU1NBR0U7XG5cbi8qKlxuICogUXVlcnkgZm9yIEFubm91bmNlbWVudHMuXG4gKlxuICogVXNlIHRoaXMgdmFsdWUgaW4gdGhlIGxheWVyLlF1ZXJ5Lm1vZGVsIHByb3BlcnR5LlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuUXVlcnkuQW5ub3VuY2VtZW50ID0gQU5OT1VOQ0VNRU5UO1xuXG4vKipcbiAqIFF1ZXJ5IGZvciBJZGVudGl0aWVzLlxuICpcbiAqIFVzZSB0aGlzIHZhbHVlIGluIHRoZSBsYXllci5RdWVyeS5tb2RlbCBwcm9wZXJ0eS5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKiBAc3RhdGljXG4gKi9cblF1ZXJ5LklkZW50aXR5ID0gSURFTlRJVFk7XG5cbi8qKlxuICogR2V0IGRhdGEgYXMgUE9KT3MvaW1tdXRhYmxlIG9iamVjdHMuXG4gKlxuICogVGhpcyB2YWx1ZSBvZiBsYXllci5RdWVyeS5kYXRhVHlwZSB3aWxsIGNhdXNlIHlvdXIgUXVlcnkgZGF0YSBhbmQgZXZlbnRzIHRvIHByb3ZpZGUgTWVzc2FnZXMvQ29udmVyc2F0aW9ucyBhcyBpbW11dGFibGUgb2JqZWN0cy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHN0YXRpY1xuICovXG5RdWVyeS5PYmplY3REYXRhVHlwZSA9ICdvYmplY3QnO1xuXG4vKipcbiAqIEdldCBkYXRhIGFzIGluc3RhbmNlcyBvZiBsYXllci5NZXNzYWdlIGFuZCBsYXllci5Db252ZXJzYXRpb24uXG4gKlxuICogVGhpcyB2YWx1ZSBvZiBsYXllci5RdWVyeS5kYXRhVHlwZSB3aWxsIGNhdXNlIHlvdXIgUXVlcnkgZGF0YSBhbmQgZXZlbnRzIHRvIHByb3ZpZGUgTWVzc2FnZXMvQ29udmVyc2F0aW9ucyBhcyBpbnN0YW5jZXMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqIEBzdGF0aWNcbiAqL1xuUXVlcnkuSW5zdGFuY2VEYXRhVHlwZSA9ICdpbnN0YW5jZSc7XG5cbi8qKlxuICogU2V0IHRoZSBtYXhpbXVtIHBhZ2Ugc2l6ZSBmb3IgcXVlcmllcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICogQHN0YXRpY1xuICovXG5RdWVyeS5NYXhQYWdlU2l6ZSA9IDEwMDtcblxuLyoqXG4gKiBTZXQgdGhlIG1heGltdW0gcGFnZSBzaXplIGZvciBJZGVudGl0eSBxdWVyaWVzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAc3RhdGljXG4gKi9cblF1ZXJ5Lk1heFBhZ2VTaXplSWRlbnRpdHkgPSA1MDA7XG5cbi8qKlxuICogQWNjZXNzIHRoZSBudW1iZXIgb2YgcmVzdWx0cyBjdXJyZW50bHkgbG9hZGVkLlxuICpcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAcmVhZG9ubHlcbiAqL1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFF1ZXJ5LnByb3RvdHlwZSwgJ3NpemUnLCB7XG4gIGVudW1lcmFibGU6IHRydWUsXG4gIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgIHJldHVybiAhdGhpcy5kYXRhID8gMCA6IHRoaXMuZGF0YS5sZW5ndGg7XG4gIH0sXG59KTtcblxuLyoqIEFjY2VzcyB0aGUgdG90YWwgbnVtYmVyIG9mIHJlc3VsdHMgb24gdGhlIHNlcnZlci5cbiAqXG4gKiBXaWxsIGJlIDAgdW50aWwgdGhlIGZpcnN0IHF1ZXJ5IGhhcyBzdWNjZXNzZnVsbHkgbG9hZGVkIHJlc3VsdHMuXG4gKlxuICogQHR5cGUge051bWJlcn1cbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUudG90YWxTaXplID0gMDtcblxuXG4vKipcbiAqIEFjY2VzcyB0byB0aGUgY2xpZW50IHNvIGl0IGNhbiBsaXN0ZW4gdG8gd2Vic29ja2V0IGFuZCBsb2NhbCBldmVudHMuXG4gKlxuICogQHR5cGUge2xheWVyLkNsaWVudH1cbiAqIEBwcm90ZWN0ZWRcbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUuY2xpZW50ID0gbnVsbDtcblxuLyoqXG4gKiBRdWVyeSByZXN1bHRzLlxuICpcbiAqIEFycmF5IG9mIGRhdGEgcmVzdWx0aW5nIGZyb20gdGhlIFF1ZXJ5OyBlaXRoZXIgYSBsYXllci5Sb290IHN1YmNsYXNzLlxuICpcbiAqIG9yIHBsYWluIE9iamVjdHNcbiAqIEB0eXBlIHtPYmplY3RbXX1cbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUuZGF0YSA9IG51bGw7XG5cbi8qKlxuICogU3BlY2lmaWVzIHRoZSB0eXBlIG9mIGRhdGEgYmVpbmcgcXVlcmllZCBmb3IuXG4gKlxuICogTW9kZWwgaXMgb25lIG9mXG4gKlxuICogKiBsYXllci5RdWVyeS5Db252ZXJzYXRpb25cbiAqICogbGF5ZXIuUXVlcnkuTWVzc2FnZVxuICogKiBsYXllci5RdWVyeS5Bbm5vdW5jZW1lbnRcbiAqICogbGF5ZXIuUXVlcnkuSWRlbnRpdHlcbiAqXG4gKiBWYWx1ZSBjYW4gYmUgc2V0IHZpYSBjb25zdHJ1Y3RvciBhbmQgbGF5ZXIuUXVlcnkudXBkYXRlKCkuXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUubW9kZWwgPSAnJztcblxuLyoqXG4gKiBXaGF0IHR5cGUgb2YgcmVzdWx0cyB0byByZXF1ZXN0IG9mIHRoZSBzZXJ2ZXIuXG4gKlxuICogTm90IHlldCBzdXBwb3J0ZWQ7IHJldHVyblR5cGUgaXMgb25lIG9mXG4gKlxuICogKiBvYmplY3RcbiAqICogaWRcbiAqICogY291bnRcbiAqXG4gKiAgVmFsdWUgc2V0IHZpYSBjb25zdHJ1Y3Rvci5cbiArICpcbiAqIFRoaXMgUXVlcnkgQVBJIGlzIGRlc2lnbmVkIG9ubHkgZm9yIHVzZSB3aXRoICdvYmplY3QnIGF0IHRoaXMgdGltZTsgd2FpdGluZyBmb3IgdXBkYXRlcyB0byBzZXJ2ZXIgZm9yXG4gKiB0aGlzIGZ1bmN0aW9uYWxpdHkuXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUucmV0dXJuVHlwZSA9ICdvYmplY3QnO1xuXG4vKipcbiAqIFNwZWNpZnkgd2hhdCBraW5kIG9mIGRhdGEgYXJyYXkgeW91ciBhcHBsaWNhdGlvbiByZXF1aXJlcy5cbiAqXG4gKiBVc2VkIHRvIHNwZWNpZnkgcXVlcnkgZGF0YVR5cGUuICBPbmUgb2ZcbiAqICogUXVlcnkuT2JqZWN0RGF0YVR5cGVcbiAqICogUXVlcnkuSW5zdGFuY2VEYXRhVHlwZVxuICpcbiAqIEB0eXBlIHtTdHJpbmd9XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLmRhdGFUeXBlID0gUXVlcnkuSW5zdGFuY2VEYXRhVHlwZTtcblxuLyoqXG4gKiBOdW1iZXIgb2YgcmVzdWx0cyBmcm9tIHRoZSBzZXJ2ZXIgdG8gcmVxdWVzdC9jYWNoZS5cbiAqXG4gKiBUaGUgcGFnaW5hdGlvbiB3aW5kb3cgY2FuIGJlIGluY3JlYXNlZCB0byBkb3dubG9hZCBhZGRpdGlvbmFsIGl0ZW1zLCBvciBkZWNyZWFzZWQgdG8gcHVyZ2UgcmVzdWx0c1xuICogZnJvbSB0aGUgZGF0YSBwcm9wZXJ0eS5cbiAqXG4gKiAgICAgcXVlcnkudXBkYXRlKHtcbiAqICAgICAgIHBhZ2luYXRpb25XaW5kb3c6IDE1MFxuICogICAgIH0pXG4gKlxuICogVGhpcyBjYWxsIHdpbGwgYWltIHRvIGFjaGlldmUgMTUwIHJlc3VsdHMuICBJZiBpdCBwcmV2aW91c2x5IGhhZCAxMDAsXG4gKiB0aGVuIGl0IHdpbGwgbG9hZCA1MCBtb3JlLiBJZiBpdCBwcmV2aW91c2x5IGhhZCAyMDAsIGl0IHdpbGwgZHJvcCA1MC5cbiAqXG4gKiBOb3RlIHRoYXQgdGhlIHNlcnZlciB3aWxsIG9ubHkgcGVybWl0IDEwMCBhdCBhIHRpbWUuXG4gKlxuICogQHR5cGUge051bWJlcn1cbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUucGFnaW5hdGlvbldpbmRvdyA9IDEwMDtcblxuLyoqXG4gKiBTb3J0aW5nIGNyaXRlcmlhIGZvciBDb252ZXJzYXRpb24gUXVlcmllcy5cbiAqXG4gKiBPbmx5IHN1cHBvcnRzIGFuIGFycmF5IG9mIG9uZSBmaWVsZC9lbGVtZW50LlxuICogT25seSBzdXBwb3J0cyB0aGUgZm9sbG93aW5nIG9wdGlvbnM6XG4gKlxuICogICAgIFt7J2NyZWF0ZWRBdCc6ICdkZXNjJ31dXG4gKiAgICAgW3snbGFzdE1lc3NhZ2Uuc2VudEF0JzogJ2Rlc2MnfV1cbiAqXG4gKiBXaHkgc3VjaCBsaW1pdGF0aW9ucz8gV2h5IHRoaXMgc3RydWN0dXJlPyAgVGhlIHNlcnZlciB3aWxsIGJlIGV4cG9zaW5nIGEgUXVlcnkgQVBJIGF0IHdoaWNoIHBvaW50IHRoZVxuICogYWJvdmUgc29ydCBvcHRpb25zIHdpbGwgbWFrZSBhIGxvdCBtb3JlIHNlbnNlLCBhbmQgZnVsbCBzb3J0aW5nIHdpbGwgYmUgcHJvdmlkZWQuXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUuc29ydEJ5ID0gbnVsbDtcblxuLyoqXG4gKiBUaGlzIHZhbHVlIHRlbGxzIHVzIHdoYXQgdG8gcmVzZXQgdGhlIHBhZ2luYXRpb25XaW5kb3cgdG8gd2hlbiB0aGUgcXVlcnkgaXMgcmVkZWZpbmVkLlxuICpcbiAqIEB0eXBlIHtOdW1iZXJ9XG4gKiBAcHJpdmF0ZVxuICovXG5RdWVyeS5wcm90b3R5cGUuX2luaXRpYWxQYWdpbmF0aW9uV2luZG93ID0gMTAwO1xuXG4vKipcbiAqIFlvdXIgUXVlcnkncyBXSEVSRSBjbGF1c2UuXG4gKlxuICogQ3VycmVudGx5LCB0aGUgb25seSBxdWVyeSBzdXBwb3J0ZWQgaXMgXCJjb252ZXJzYXRpb24uaWQgPSAnbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy91dWlkJ1wiXG4gKiBOb3RlIHRoYXQgYm90aCAnIGFuZCBcIiBhcmUgc3VwcG9ydGVkLlxuICpcbiAqIEN1cnJlbnRseSwgdGhlIG9ubHkgcXVlcnkgc3VwcG9ydGVkIGlzIGBjb252ZXJzYXRpb24uaWQgPSAnbGF5ZXI6Ly8vY29udmVyc2F0aW9ucy91dWlkJ2BcbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICogQHJlYWRvbmx5XG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5wcmVkaWNhdGUgPSBudWxsO1xuXG4vKipcbiAqIFRydWUgaWYgdGhlIFF1ZXJ5IGlzIGNvbm5lY3RpbmcgdG8gdGhlIHNlcnZlci5cbiAqXG4gKiBJdCBpcyBub3QgZ2F1cmVudGVlZCB0aGF0IGV2ZXJ5IGB1cGRhdGUoKWAgd2lsbCBmaXJlIGEgcmVxdWVzdCB0byB0aGUgc2VydmVyLlxuICogRm9yIGV4YW1wbGUsIHVwZGF0aW5nIGEgcGFnaW5hdGlvbldpbmRvdyB0byBiZSBzbWFsbGVyLFxuICogT3IgY2hhbmdpbmcgYSB2YWx1ZSB0byB0aGUgZXhpc3RpbmcgdmFsdWUgd291bGQgY2F1c2UgdGhlIHJlcXVlc3Qgbm90IHRvIGZpcmUuXG4gKlxuICogUmVjb21tZW5kZWQgcGF0dGVybiBpczpcbiAqXG4gKiAgICAgIHF1ZXJ5LnVwZGF0ZSh7cGFnaW5hdGlvbldpbmRvdzogNTB9KTtcbiAqICAgICAgaWYgKCFxdWVyeS5pc0ZpcmluZykge1xuICogICAgICAgIGFsZXJ0KFwiRG9uZVwiKTtcbiAqICAgICAgfSBlbHNlIHtcbiAqICAgICAgICAgIHF1ZXJ5Lm9uY2UoXCJjaGFuZ2VcIiwgZnVuY3Rpb24oZXZ0KSB7XG4gKiAgICAgICAgICAgIGlmIChldnQudHlwZSA9PSBcImRhdGFcIikgYWxlcnQoXCJEb25lXCIpO1xuICogICAgICAgICAgfSk7XG4gKiAgICAgIH1cbiAqXG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqIEByZWFkb25seVxuICovXG5RdWVyeS5wcm90b3R5cGUuaXNGaXJpbmcgPSBmYWxzZTtcblxuLyoqXG4gKiBUcnVlIGlmIHdlIGhhdmUgcmVhY2hlZCB0aGUgbGFzdCByZXN1bHQsIGFuZCBmdXJ0aGVyIHBhZ2luZyB3aWxsIGp1c3QgcmV0dXJuIFtdXG4gKlxuICogQHR5cGUge0Jvb2xlYW59XG4gKiBAcmVhZG9ubHlcbiAqL1xuUXVlcnkucHJvdG90eXBlLnBhZ2VkVG9FbmQgPSBmYWxzZTtcblxuLyoqXG4gKiBUaGUgbGFzdCByZXF1ZXN0IGZpcmVkLlxuICpcbiAqIElmIG11bHRpcGxlIHJlcXVlc3RzIGFyZSBpbmZsaWdodCwgdGhlIHJlc3BvbnNlXG4gKiBtYXRjaGluZyB0aGlzIHJlcXVlc3QgaXMgdGhlIE9OTFkgcmVzcG9uc2Ugd2Ugd2lsbCBwcm9jZXNzLlxuICogQHR5cGUge1N0cmluZ31cbiAqIEBwcml2YXRlXG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5fZmlyaW5nUmVxdWVzdCA9ICcnO1xuXG4vKipcbiAqIFRoZSBJRCB0byB1c2UgaW4gcGFnaW5nIHRoZSBzZXJ2ZXIuXG4gKlxuICogV2h5IG5vdCBqdXN0IHVzZSB0aGUgSUQgb2YgdGhlIGxhc3QgaXRlbSBpbiBvdXIgcmVzdWx0IHNldD9cbiAqIEJlY2F1c2UgYXMgd2UgcmVjZWl2ZSB3ZWJzb2NrZXQgZXZlbnRzLCB3ZSBpbnNlcnQgYW5kIGFwcGVuZCBpdGVtcyB0byBvdXIgZGF0YS5cbiAqIFRoYXQgd2Vic29ja2V0IGV2ZW50IG1heSBub3QgaW4gZmFjdCBkZWxpdmVyIHRoZSBORVhUIGl0ZW0gaW4gb3VyIGRhdGEsIGJ1dCBzaW1wbHkgYW4gaXRlbSwgdGhhdCBzZXF1ZW50aWFsbHlcbiAqIGJlbG9uZ3MgYXQgdGhlIGVuZCBkZXNwaXRlIHNraXBwaW5nIG92ZXIgb3RoZXIgaXRlbXMgb2YgZGF0YS4gIFBhZ2luZyBzaG91bGQgbm90IGJlIGZyb20gdGhpcyBuZXcgaXRlbSwgYnV0XG4gKiBvbmx5IHRoZSBsYXN0IGl0ZW0gcHVsbGVkIHZpYSB0aGlzIHF1ZXJ5IGZyb20gdGhlIHNlcnZlci5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5RdWVyeS5wcm90b3R5cGUuX25leHRTZXJ2ZXJGcm9tSWQgPSAnJztcblxuLyoqXG4gKiBUaGUgSUQgdG8gdXNlIGluIHBhZ2luZyB0aGUgZGF0YWJhc2UuXG4gKlxuICogV2h5IG5vdCBqdXN0IHVzZSB0aGUgSUQgb2YgdGhlIGxhc3QgaXRlbSBpbiBvdXIgcmVzdWx0IHNldD9cbiAqIEJlY2F1c2UgYXMgd2UgcmVjZWl2ZSB3ZWJzb2NrZXQgZXZlbnRzLCB3ZSBpbnNlcnQgYW5kIGFwcGVuZCBpdGVtcyB0byBvdXIgZGF0YS5cbiAqIFRoYXQgd2Vic29ja2V0IGV2ZW50IG1heSBub3QgaW4gZmFjdCBkZWxpdmVyIHRoZSBORVhUIGl0ZW0gaW4gb3VyIGRhdGEsIGJ1dCBzaW1wbHkgYW4gaXRlbSwgdGhhdCBzZXF1ZW50aWFsbHlcbiAqIGJlbG9uZ3MgYXQgdGhlIGVuZCBkZXNwaXRlIHNraXBwaW5nIG92ZXIgb3RoZXIgaXRlbXMgb2YgZGF0YS4gIFBhZ2luZyBzaG91bGQgbm90IGJlIGZyb20gdGhpcyBuZXcgaXRlbSwgYnV0XG4gKiBvbmx5IHRoZSBsYXN0IGl0ZW0gcHVsbGVkIHZpYSB0aGlzIHF1ZXJ5IGZyb20gdGhlIGRhdGFiYXNlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cblF1ZXJ5LnByb3RvdHlwZS5fbmV4dERCRnJvbUlkID0gJyc7XG5cblxuUXVlcnkuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbiAgLyoqXG4gICAqIFRoZSBxdWVyeSBkYXRhIGhhcyBjaGFuZ2VkOyBhbnkgY2hhbmdlIGV2ZW50IHdpbGwgY2F1c2UgdGhpcyBldmVudCB0byB0cmlnZ2VyLlxuICAgKiBAZXZlbnQgY2hhbmdlXG4gICAqL1xuICAnY2hhbmdlJyxcblxuICAvKipcbiAgICogQSBuZXcgcGFnZSBvZiBkYXRhIGhhcyBiZWVuIGxvYWRlZCBmcm9tIHRoZSBzZXJ2ZXJcbiAgICogQGV2ZW50ICdjaGFuZ2U6ZGF0YSdcbiAgICovXG4gICdjaGFuZ2U6ZGF0YScsXG5cbiAgLyoqXG4gICAqIEFsbCBkYXRhIGZvciB0aGlzIHF1ZXJ5IGhhcyBiZWVuIHJlc2V0IGR1ZSB0byBhIGNoYW5nZSBpbiB0aGUgUXVlcnkgcHJlZGljYXRlLlxuICAgKiBAZXZlbnQgJ2NoYW5nZTpyZXNldCdcbiAgICovXG4gICdjaGFuZ2U6cmVzZXQnLFxuXG4gIC8qKlxuICAgKiBBbiBpdGVtIG9mIGRhdGEgd2l0aGluIHRoaXMgUXVlcnkgaGFzIGhhZCBhIHByb3BlcnR5IGNoYW5nZSBpdHMgdmFsdWUuXG4gICAqIEBldmVudCAnY2hhbmdlOnByb3BlcnR5J1xuICAgKi9cbiAgJ2NoYW5nZTpwcm9wZXJ0eScsXG5cbiAgLyoqXG4gICAqIEEgbmV3IGl0ZW0gb2YgZGF0YSBoYXMgYmVlbiBpbnNlcnRlZCBpbnRvIHRoZSBRdWVyeS4gTm90IHRyaWdnZXJlZCBieSBsb2FkaW5nXG4gICAqIGEgbmV3IHBhZ2Ugb2YgZGF0YSBmcm9tIHRoZSBzZXJ2ZXIsIGJ1dCBpcyB0cmlnZ2VyZWQgYnkgbG9jYWxseSBjcmVhdGluZyBhIG1hdGNoaW5nXG4gICAqIGl0ZW0gb2YgZGF0YSwgb3IgcmVjZWl2aW5nIGEgbmV3IGl0ZW0gb2YgZGF0YSB2aWEgd2Vic29ja2V0LlxuICAgKiBAZXZlbnQgJ2NoYW5nZTppbnNlcnQnXG4gICAqL1xuICAnY2hhbmdlOmluc2VydCcsXG5cbiAgLyoqXG4gICAqIEFuIGl0ZW0gb2YgZGF0YSBoYXMgYmVlbiByZW1vdmVkIGZyb20gdGhlIFF1ZXJ5LiBOb3QgdHJpZ2dlcmVkIGZvciBldmVyeSByZW1vdmFsLCBidXRcbiAgICogaXMgdHJpZ2dlcmVkIGJ5IGxvY2FsbHkgZGVsZXRpbmcgYSByZXN1bHQsIG9yIHJlY2VpdmluZyBhIHJlcG9ydCBvZiBkZWxldGlvbiB2aWEgd2Vic29ja2V0LlxuICAgKiBAZXZlbnQgJ2NoYW5nZTpyZW1vdmUnXG4gICAqL1xuICAnY2hhbmdlOnJlbW92ZScsXG5cbiAgLyoqXG4gICAqIFRoZSBxdWVyeSBkYXRhIGZhaWxlZCB0byBsb2FkIGZyb20gdGhlIHNlcnZlci5cbiAgICogQGV2ZW50IGVycm9yXG4gICAqL1xuICAnZXJyb3InLFxuXG5dLmNvbmNhdChSb290Ll9zdXBwb3J0ZWRFdmVudHMpO1xuXG5Sb290LmluaXRDbGFzcy5hcHBseShRdWVyeSwgW1F1ZXJ5LCAnUXVlcnknXSk7XG5cbm1vZHVsZS5leHBvcnRzID0gUXVlcnk7XG4iXX0=
