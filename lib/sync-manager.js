'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * @class  layer.SyncManager
 * @extends layer.Root
 * @protected
 *
 * This class manages
 *
 * 1. a queue of requests that need to be made
 * 2. when a request should be fired, based on authentication state, online state, websocket connection state, and position in the queue
 * 3. when a request should be aborted
 * 4. triggering any request callbacks
 *
 * TODO: In the event of a DNS error, we may have a valid websocket receiving events and telling us we are online,
 * and be unable to create a REST call.  This will be handled wrong because evidence will suggest that we are online.
 * This issue goes away when we use bidirectional websockets for all requests.
 *
 * Applications do not typically interact with this class, but may subscribe to its events
 * to get richer detailed information than is available from the layer.Client instance.
 */
var Root = require('./root');

var _require = require('./sync-event'),
    WebsocketSyncEvent = _require.WebsocketSyncEvent;

var xhr = require('./xhr');
var logger = require('./logger');
var Utils = require('./client-utils');

var MAX_RECEIPT_CONNECTIONS = 4;

var SyncManager = function (_Root) {
  _inherits(SyncManager, _Root);

  /**
   * Creates a new SyncManager.
   *
   * An Application is expected to only have one SyncManager.
   *
   *      var socketManager = new layer.Websockets.SocketManager({client: client});
   *      var requestManager = new layer.Websockets.RequestManager({client: client, socketManager: socketManager});
   *
   *      var onlineManager = new layer.OnlineManager({
   *          socketManager: socketManager
   *      });
   *
   *      // Now we can instantiate this thing...
   *      var SyncManager = new layer.SyncManager({
   *          client: client,
   *          onlineManager: onlineManager,
   *          socketManager: socketManager,
   *          requestManager: requestManager
   *      });
   *
   * @method constructor
   * @param  {Object} options
   * @param {layer.OnlineStateManager} options.onlineManager
   * @param {layer.Websockets.RequestManager} options.requestManager
   * @param {layer.Client} options.client
   */
  function SyncManager(options) {
    _classCallCheck(this, SyncManager);

    var _this = _possibleConstructorReturn(this, (SyncManager.__proto__ || Object.getPrototypeOf(SyncManager)).call(this, options));

    _this.client = options.client;

    // Note we do not store a pointer to client... it is not needed.
    if (_this.client) {
      _this.client.on('ready', function () {
        _this._processNextRequest();
        _this._loadPersistedQueue();
      }, _this);
    }
    _this.queue = [];
    _this.receiptQueue = [];

    _this.onlineManager.on('disconnected', _this._onlineStateChange, _this);
    _this.socketManager.on('connected disconnected', _this._onlineStateChange, _this);
    return _this;
  }

  /**
   * Returns whether the Client is online/offline.
   *
   * For internal use; applications should use layer.Client.isOnline.
   *
   * @method isOnline
   * @returns {Boolean}
   */


  _createClass(SyncManager, [{
    key: 'isOnline',
    value: function isOnline() {
      return this.onlineManager.isOnline;
    }

    /**
     * Process sync request when connection is restored.
     *
     * Any time we go back online (as signaled by the onlineStateManager),
     * Process the next Sync Event (will do nothing if one is already firing)
     *
     * @method _onlineStateChange
     * @private
     * @param  {string} evtName - 'connected' or 'disconnected'
     * @param  {layer.LayerEvent} evt
     */

  }, {
    key: '_onlineStateChange',
    value: function _onlineStateChange(evt) {
      var _this2 = this;

      if (evt.eventName === 'connected') {
        if (this.queue.length) this.queue[0].returnToOnlineCount++;
        setTimeout(function () {
          return _this2._processNextRequest();
        }, 100);
      } else if (evt.eventName === 'disconnected') {
        if (this.queue.length) {
          this.queue[0].isFiring = false;
        }
        if (this.receiptQueue.length) {
          this.receiptQueue.forEach(function (syncEvt) {
            syncEvt.isFiring = false;
          });
        }
      }
    }

    /**
     * Adds a new xhr request to the queue.
     *
     * If the queue is empty, this will be fired immediately; else it will be added to the queue and wait its turn.
     *
     * If its a read/delivery receipt request, it will typically be fired immediately unless there are many receipt
     * requests already in-flight.
     *
     * @method request
     * @param  {layer.SyncEvent} requestEvt - A SyncEvent specifying the request to be made
     */

  }, {
    key: 'request',
    value: function request(requestEvt) {
      // If its a PATCH request on an object that isn't yet created,
      // do not add it to the queue.
      if (requestEvt.operation !== 'PATCH' || !this._findUnfiredCreate(requestEvt)) {
        logger.info('Sync Manager Request ' + requestEvt.operation + ' on target ' + requestEvt.target, requestEvt.toObject());
        if (requestEvt.operation === 'RECEIPT') {
          this.receiptQueue.push(requestEvt);
        } else {
          this.queue.push(requestEvt);
        }
        this.trigger('sync:add', {
          request: requestEvt,
          target: requestEvt.target
        });
      } else {
        logger.info('Sync Manager Request PATCH ' + requestEvt.target + ' request ignored; create request still enqueued', requestEvt.toObject());
      }

      // If its a DELETE request, purge all other requests on that target.
      if (requestEvt.operation === 'DELETE') {
        this._purgeOnDelete(requestEvt);
      }

      this._processNextRequest(requestEvt);
    }
  }, {
    key: '_processNextRequest',
    value: function _processNextRequest(requestEvt) {
      var _this3 = this;

      // Fire the request if there aren't any existing requests already firing
      if (this.queue.length && !this.queue[0].isFiring) {
        if (requestEvt) {
          this.client.dbManager.writeSyncEvents([requestEvt], function () {
            return _this3._processNextStandardRequest();
          });
        } else {
          this._processNextStandardRequest();
        }
      }

      // If we have anything in the receipts queue, fire it
      if (this.receiptQueue.length) {
        this._processNextReceiptRequest();
      }
    }

    /**
     * Find create request for this resource.
     *
     * Determine if the given target has a POST request waiting to create
     * the resource, and return any matching requests. Used
     * for folding PATCH requests into an unfired CREATE/POST request.
     *
     * @method _findUnfiredCreate
     * @private
     * @param  {layer.SyncEvent} requestEvt
     * @return {Boolean}
     */

  }, {
    key: '_findUnfiredCreate',
    value: function _findUnfiredCreate(requestEvt) {
      return Boolean(this.queue.filter(function (evt) {
        return evt.target === requestEvt.target && evt.operation === 'POST' && !evt.isFiring;
      }).length);
    }

    /**
     * Process the next request in the queue.
     *
     * Request is dequeued on completing the process.
     * If the first request in the queue is firing, do nothing.
     *
     * @method _processNextRequest
     * @private
     */

  }, {
    key: '_processNextStandardRequest',
    value: function _processNextStandardRequest() {
      var _this4 = this;

      if (this.isDestroyed || !this.client.isAuthenticated) return;
      var requestEvt = this.queue[0];
      if (this.isOnline() && requestEvt && !requestEvt.isFiring && !requestEvt._isValidating) {
        requestEvt._isValidating = true;
        this._validateRequest(requestEvt, function (isValid) {
          requestEvt._isValidating = false;
          if (!isValid) {
            _this4._removeRequest(requestEvt, false);
            return _this4._processNextStandardRequest();
          } else {
            _this4._fireRequest(requestEvt);
          }
        });
      }
    }

    /**
     * Process up to MAX_RECEIPT_CONNECTIONS worth of receipts.
     *
     * These requests have no interdependencies. Just fire them all
     * as fast as we can, in parallel.
     *
     * @method _processNextReceiptRequest
     * @private
     */

  }, {
    key: '_processNextReceiptRequest',
    value: function _processNextReceiptRequest() {
      var _this5 = this;

      var firingReceipts = 0;
      this.receiptQueue.forEach(function (receiptEvt) {
        if (_this5.isOnline() && receiptEvt) {
          if (receiptEvt.isFiring || receiptEvt._isValidating) {
            firingReceipts++;
          } else if (firingReceipts < MAX_RECEIPT_CONNECTIONS) {
            firingReceipts++;
            receiptEvt._isValidating = true;
            _this5._validateRequest(receiptEvt, function (isValid) {
              receiptEvt._isValidating = false;
              if (!isValid) {
                var index = _this5.receiptQueue.indexOf(receiptEvt);
                if (index !== -1) _this5.receiptQueue.splice(index, 1);
              } else {
                _this5._fireRequest(receiptEvt);
              }
            });
          }
        }
      });
    }

    /**
     * Directly fire this sync request.
     *
     * This is intended to be called only after careful analysis of our state to make sure its safe to send the request.
     * See `_processNextRequest()`
     *
     * @method _fireRequest
     * @private
     * @param {layer.SyncEvent} requestEvt
     */

  }, {
    key: '_fireRequest',
    value: function _fireRequest(requestEvt) {
      if (requestEvt instanceof WebsocketSyncEvent) {
        this._fireRequestWebsocket(requestEvt);
      } else {
        this._fireRequestXHR(requestEvt);
      }
    }

    /**
     * Directly fire this XHR Sync request.
     *
     * @method _fireRequestXHR
     * @private
     * @param {layer.SyncEvent.XHRSyncEvent} requestEvt
     */

  }, {
    key: '_fireRequestXHR',
    value: function _fireRequestXHR(requestEvt) {
      var _this6 = this;

      requestEvt.isFiring = true;
      if (!requestEvt.headers) requestEvt.headers = {};
      requestEvt.headers.authorization = 'Layer session-token="' + this.client.sessionToken + '"';
      logger.debug('Sync Manager XHR Request Firing ' + requestEvt.operation + ' ' + requestEvt.target, requestEvt.toObject());
      xhr(requestEvt._getRequestData(this.client), function (result) {
        return _this6._xhrResult(result, requestEvt);
      });
    }

    /**
     * Directly fire this Websocket Sync request.
     *
     * @method _fireRequestWebsocket
     * @private
     * @param {layer.SyncEvent.WebsocketSyncEvent} requestEvt
     */

  }, {
    key: '_fireRequestWebsocket',
    value: function _fireRequestWebsocket(requestEvt) {
      var _this7 = this;

      if (this.socketManager && this.socketManager._isOpen()) {
        logger.debug('Sync Manager Websocket Request Firing ' + requestEvt.operation + ' on target ' + requestEvt.target, requestEvt.toObject());
        requestEvt.isFiring = true;
        this.requestManager.sendRequest(requestEvt._getRequestData(this.client), function (result) {
          return _this7._xhrResult(result, requestEvt);
        });
      } else {
        logger.debug('Sync Manager Websocket Request skipped; socket closed');
      }
    }

    /**
     * Is the syncEvent still valid?
     *
     * This method specifically tests to see if some other tab has already sent this request.
     * If persistence of the syncQueue is not enabled, then the callback is immediately called with true.
     * If another tab has already sent the request, then the entry will no longer be in indexedDB and the callback
     * will call false.
     *
     * @method _validateRequest
     * @param {layer.SyncEvent} syncEvent
     * @param {Function} callback
     * @param {Function} callback.isValid - The request is still valid
     * @private
     */

  }, {
    key: '_validateRequest',
    value: function _validateRequest(syncEvent, callback) {
      this.client.dbManager.claimSyncEvent(syncEvent, function (isFound) {
        return callback(isFound);
      });
    }

    /**
     * Turn deduplication errors into success messages.
     *
     * If this request has already been made but we failed to get a response the first time and we retried the request,
     * we will reissue the request.  If the prior request was successful we'll get back a deduplication error
     * with the created object. As far as the WebSDK is concerned, this is a success.
     *
     * @method _handleDeduplicationErrors
     * @private
     */

  }, {
    key: '_handleDeduplicationErrors',
    value: function _handleDeduplicationErrors(result) {
      if (result.data && result.data.id === 'id_in_use' && result.data.data && result.data.data.id === result.request._getCreateId()) {
        result.success = true;
        result.data = result.data.data;
      }
    }

    /**
     * Process the result of an xhr call, routing it to the appropriate handler.
     *
     * @method _xhrResult
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {layer.SyncEvent} requestEvt - Request object
     */

  }, {
    key: '_xhrResult',
    value: function _xhrResult(result, requestEvt) {
      if (this.isDestroyed) return;
      result.request = requestEvt;
      requestEvt.isFiring = false;
      this._handleDeduplicationErrors(result);
      if (!result.success) {
        this._xhrError(result);
      } else {
        this._xhrSuccess(result);
      }
    }

    /**
     * Categorize the error for handling.
     *
     * @method _getErrorState
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {layer.SyncEvent} requestEvt - Request object
     * @param  {boolean} isOnline - Is our app state set to online
     * @returns {String}
     */

  }, {
    key: '_getErrorState',
    value: function _getErrorState(result, requestEvt, isOnline) {
      var errId = result.data ? result.data.id : '';
      if (!isOnline) {
        // CORS errors look identical to offline; but if our online state has transitioned from false to true repeatedly while processing this request,
        // thats a hint that that its a CORS error
        if (requestEvt.returnToOnlineCount >= SyncManager.MAX_RETRIES_BEFORE_CORS_ERROR) {
          return 'CORS';
        } else {
          return 'offline';
        }
      } else if (errId === 'not_found') {
        return 'notFound';
      } else if (errId === 'id_in_use') {
        return 'invalidId'; // This only fires if we get `id_in_use` but no Resource, which means the UUID was used by another user/app.
      } else if (result.status === 408 || errId === 'request_timeout') {
        if (requestEvt.retryCount >= SyncManager.MAX_RETRIES) {
          return 'tooManyFailuresWhileOnline';
        } else {
          return 'validateOnlineAndRetry';
        }
      } else if ([502, 503, 504].indexOf(result.status) !== -1) {
        if (requestEvt.retryCount >= SyncManager.MAX_RETRIES) {
          return 'tooManyFailuresWhileOnline';
        } else {
          return 'serverUnavailable';
        }
      } else if (errId === 'authentication_required' && result.data.data && result.data.data.nonce) {
        return 'reauthorize';
      } else {
        return 'serverRejectedRequest';
      }
    }

    /**
     * Handle failed requests.
     *
     * 1. If there was an error from the server, then the request has problems
     * 2. If we determine we are not in fact online, call the connectionError handler
     * 3. If we think we are online, verify we are online and then determine how to handle it.
     *
     * @method _xhrError
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {layer.SyncEvent} requestEvt - Request object
     */

  }, {
    key: '_xhrError',
    value: function _xhrError(result) {
      var requestEvt = result.request;

      logger.warn('Sync Manager ' + (requestEvt instanceof WebsocketSyncEvent ? 'Websocket' : 'XHR') + ' ' + (requestEvt.operation + ' Request on target ' + requestEvt.target + ' has Failed'), requestEvt.toObject());

      var errState = this._getErrorState(result, requestEvt, this.isOnline());
      logger.warn('Sync Manager Error State: ' + errState);
      switch (errState) {
        case 'tooManyFailuresWhileOnline':
          this._xhrHandleServerError(result, 'Sync Manager Server Unavailable Too Long; removing request', false);
          break;
        case 'notFound':
          this._xhrHandleServerError(result, 'Resource not found; presumably deleted', false);
          break;
        case 'invalidId':
          this._xhrHandleServerError(result, 'ID was not unique; request failed', false);
          break;
        case 'validateOnlineAndRetry':
          // Server appears to be hung but will eventually recover.
          // Retry a few times and then error out.
          this._xhrValidateIsOnline(requestEvt);
          break;
        case 'serverUnavailable':
          // Server is in a bad state but will eventually recover;
          // keep retrying.
          this._xhrHandleServerUnavailableError(requestEvt);
          break;
        case 'reauthorize':
          // sessionToken appears to no longer be valid; forward response
          // on to client-authenticator to process.
          // Do not retry nor advance to next request.
          if (requestEvt.callback) requestEvt.callback(result);

          break;
        case 'serverRejectedRequest':
          // Server presumably did not like the arguments to this call
          // or the url was invalid.  Do not retry; trigger the callback
          // and let the caller handle it.
          this._xhrHandleServerError(result, 'Sync Manager Server Rejects Request; removing request', true);
          break;
        case 'CORS':
          // A pattern of offline-like failures that suggests its actually a CORs error
          this._xhrHandleServerError(result, 'Sync Manager Server detects CORS-like errors; removing request', false);
          break;
        case 'offline':
          this._xhrHandleConnectionError();
          break;
      }

      // Write the sync event back to the database if we haven't completed processing it
      if (this.queue.indexOf(requestEvt) !== -1 || this.receiptQueue.indexOf(requestEvt) !== -1) {
        this.client.dbManager.writeSyncEvents([requestEvt]);
      }
    }

    /**
     * Handle a server unavailable error.
     *
     * In the event of a 502 (Bad Gateway), 503 (service unavailable)
     * or 504 (gateway timeout) error from the server
     * assume we have an error that is self correcting on the server.
     * Use exponential backoff to retry the request.
     *
     * Note that each call will increment retryCount; there is a maximum
     * of MAX_RETRIES before it is treated as an error
     *
     * @method  _xhrHandleServerUnavailableError
     * @private
     * @param {layer.SyncEvent} request
     */

  }, {
    key: '_xhrHandleServerUnavailableError',
    value: function _xhrHandleServerUnavailableError(request) {
      var maxDelay = SyncManager.MAX_UNAVAILABLE_RETRY_WAIT;
      var delay = Utils.getExponentialBackoffSeconds(maxDelay, Math.min(15, request.retryCount++));
      logger.warn('Sync Manager Server Unavailable; retry count ' + request.retryCount + '; retrying in ' + delay + ' seconds');
      setTimeout(this._processNextRequest.bind(this), delay * 1000);
    }

    /**
     * Handle a server error in response to firing sync event.
     *
     * If there is a server error, its presumably non-recoverable/non-retryable error, so
     * we're going to abort this request.
     *
     * 1. If a callback was provided, call it to handle the error
     * 2. If a rollback call is provided, call it to undo any patch/delete/etc... changes
     * 3. If the request was to create a resource, remove from the queue all requests
     *    that depended upon that resource.
     * 4. Advance to next request
     *
     * @method _xhrHandleServerError
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {string} logMsg - Message to display in console
     * @param  {boolean} stringify - log object for quick debugging
     *
     */

  }, {
    key: '_xhrHandleServerError',
    value: function _xhrHandleServerError(result, logMsg, stringify) {
      // Execute all callbacks provided by the request
      if (result.request.callback) result.request.callback(result);
      if (stringify) {
        logger.error(logMsg + '\nREQUEST: ' + JSON.stringify(result.request.toObject(), null, 4) + '\nRESPONSE: ' + JSON.stringify(result.data, null, 4));
      } else {
        logger.error(logMsg, result);
      }
      this.trigger('sync:error', {
        target: result.request.target,
        request: result.request,
        error: result.data
      });

      result.request.success = false;

      // If a POST request fails, all requests that depend upon this object
      // must be purged
      if (result.request.operation === 'POST') {
        this._purgeDependentRequests(result.request);
      }

      // Remove this request as well (side-effect: rolls back the operation)
      this._removeRequest(result.request, true);

      // And finally, we are ready to try the next request
      this._processNextRequest();
    }

    /**
     * If there is a connection error, wait for retry.
     *
     * In the event of what appears to be a connection error,
     * Wait until a 'connected' event before processing the next request (actually reprocessing the current event)
     *
     * @method _xhrHandleConnectionError
     * @private
     */

  }, {
    key: '_xhrHandleConnectionError',
    value: function _xhrHandleConnectionError() {}
    // Nothing to be done; we already have the below event handler setup
    // this.onlineManager.once('connected', () => this._processNextRequest());


    /**
     * Verify that we are online and retry request.
     *
     * This method is called when we think we're online, but
     * have determined we need to validate that assumption.
     *
     * Test that we have a connection; if we do,
     * retry the request once, and if it fails again,
     * _xhrError() will determine it to have failed and remove it from the queue.
     *
     * If we are offline, then let _xhrHandleConnectionError handle it.
     *
     * @method _xhrValidateIsOnline
     * @private
     */

  }, {
    key: '_xhrValidateIsOnline',
    value: function _xhrValidateIsOnline(requestEvt) {
      var _this8 = this;

      logger.debug('Sync Manager verifying online state');
      this.onlineManager.checkOnlineStatus(function (isOnline) {
        return _this8._xhrValidateIsOnlineCallback(isOnline, requestEvt);
      });
    }

    /**
     * If we have verified we are online, retry request.
     *
     * We should have received a response to our /nonces call
     * which assuming the server is actually alive,
     * will tell us if the connection is working.
     *
     * If we are offline, flag us as offline and let the ConnectionError handler handle this
     * If we are online, give the request a single retry (there is never more than one retry)
     *
     * @method _xhrValidateIsOnlineCallback
     * @private
     * @param  {boolean} isOnline  - Response object returned by xhr call
     * @param {layer.SyncEvent} requestEvt - The request that failed triggering this call
     */

  }, {
    key: '_xhrValidateIsOnlineCallback',
    value: function _xhrValidateIsOnlineCallback(isOnline, requestEvt) {
      logger.debug('Sync Manager online check result is ' + isOnline);
      if (!isOnline) {
        // Treat this as a Connection Error
        this._xhrHandleConnectionError();
      } else {
        // Retry the request in case we were offline, but are now online.
        // Of course, if this fails, give it up entirely.
        requestEvt.retryCount++;
        this._processNextRequest();
      }
    }

    /**
     * The XHR request was successful.
     *
     * Any xhr request that actually succedes:
     *
     * 1. Remove it from the queue
     * 2. Call any callbacks
     * 3. Advance to next request
     *
     * @method _xhrSuccess
     * @private
     * @param  {Object} result  - Response object returned by xhr call
     * @param  {layer.SyncEvent} requestEvt - Request object
     */

  }, {
    key: '_xhrSuccess',
    value: function _xhrSuccess(result) {
      var requestEvt = result.request;
      logger.debug('Sync Manager ' + (requestEvt instanceof WebsocketSyncEvent ? 'Websocket' : 'XHR') + ' ' + (requestEvt.operation + ' Request on target ' + requestEvt.target + ' has Succeeded'), requestEvt.toObject());
      if (result.data) logger.debug(result.data);
      requestEvt.success = true;
      this._removeRequest(requestEvt, true);
      if (requestEvt.callback) requestEvt.callback(result);
      this._processNextRequest();

      this.trigger('sync:success', {
        target: requestEvt.target,
        request: requestEvt,
        response: result.data
      });
    }

    /**
     * Remove the SyncEvent request from the queue.
     *
     * @method _removeRequest
     * @private
     * @param  {layer.SyncEvent} requestEvt - SyncEvent Request to remove
     * @param {Boolean} deleteDB - Delete from indexedDB
     */

  }, {
    key: '_removeRequest',
    value: function _removeRequest(requestEvt, deleteDB) {
      var queue = requestEvt.operation === 'RECEIPT' ? this.receiptQueue : this.queue;
      var index = queue.indexOf(requestEvt);
      if (index !== -1) queue.splice(index, 1);
      if (deleteDB) this.client.dbManager.deleteObjects('syncQueue', [requestEvt]);
    }

    /**
     * Remove requests from queue that depend on specified resource.
     *
     * If there is a POST request to create a new resource, and there are PATCH, DELETE, etc...
     * requests on that resource, if the POST request fails, then all PATCH, DELETE, etc
     * requests must be removed from the queue.
     *
     * Note that we do not call the rollback on these dependent requests because the expected
     * rollback is to destroy the thing that was created, which means any other rollback has no effect.
     *
     * @method _purgeDependentRequests
     * @private
     * @param  {layer.SyncEvent} request - Request whose target is no longer valid
     */

  }, {
    key: '_purgeDependentRequests',
    value: function _purgeDependentRequests(request) {
      this.queue = this.queue.filter(function (evt) {
        return evt.depends.indexOf(request.target) === -1 || evt === request;
      });
      this.receiptQueue = this.receiptQueue.filter(function (evt) {
        return evt.depends.indexOf(request.target) === -1 || evt === request;
      });
    }

    /**
     * Remove from queue all events that operate upon the deleted object.
     *
     * @method _purgeOnDelete
     * @private
     * @param  {layer.SyncEvent} evt - Delete event that requires removal of other events
     */

  }, {
    key: '_purgeOnDelete',
    value: function _purgeOnDelete(evt) {
      var _this9 = this;

      this.queue.filter(function (request) {
        return request.depends.indexOf(evt.target) !== -1 && evt !== request;
      }).forEach(function (requestEvt) {
        _this9.trigger('sync:abort', {
          target: requestEvt.target,
          request: requestEvt
        });
        _this9._removeRequest(requestEvt, true);
      });
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      this.queue.forEach(function (evt) {
        return evt.destroy();
      });
      this.queue = null;
      this.receiptQueue.forEach(function (evt) {
        return evt.destroy();
      });
      this.receiptQueue = null;
      _get(SyncManager.prototype.__proto__ || Object.getPrototypeOf(SyncManager.prototype), 'destroy', this).call(this);
    }

    /**
     * Load any unsent requests from indexedDB.
     *
     * If persistence is disabled, nothing will happen;
     * else all requests found in the database will be added to the queue.
     * @method _loadPersistedQueue
     * @private
     */

  }, {
    key: '_loadPersistedQueue',
    value: function _loadPersistedQueue() {
      var _this10 = this;

      this.client.dbManager.loadSyncQueue(function (data) {
        if (data.length) {
          _this10.queue = _this10.queue.concat(data);
          _this10._processNextRequest();
        }
      });
    }
  }]);

  return SyncManager;
}(Root);

/**
 * Websocket Manager for getting socket state.
 * @type {layer.Websockets.SocketManager}
 */


SyncManager.prototype.socketManager = null;

/**
 * Websocket Request Manager for sending requests.
 * @type {layer.Websockets.RequestManager}
 */
SyncManager.prototype.requestManager = null;

/**
 * Reference to the Online State Manager.
 *
 * Sync Manager uses online status to determine if it can fire sync-requests.
 * @private
 * @type {layer.OnlineStateManager}
 */
SyncManager.prototype.onlineManager = null;

/**
 * The array of layer.SyncEvent instances awaiting to be fired.
 * @type {layer.SyncEvent[]}
 */
SyncManager.prototype.queue = null;

/**
 * The array of layer.SyncEvent instances awaiting to be fired.
 *
 * Receipts can generally just be fired off all at once without much fretting about ordering or dependencies.
 * @type {layer.SyncEvent[]}
 */
SyncManager.prototype.receiptQueue = null;

/**
 * Reference to the Client so that we can pass it to SyncEvents  which may need to lookup their targets
 */
SyncManager.prototype.client = null;

/**
 * Maximum exponential backoff wait.
 *
 * If the server is returning 502, 503 or 504 errors, exponential backoff
 * should never wait longer than this number of seconds (15 minutes)
 * @type {Number}
 * @static
 */
SyncManager.MAX_UNAVAILABLE_RETRY_WAIT = 60 * 15;

/**
 * Retries before suspect CORS error.
 *
 * How many times can we transition from offline to online state
 * with this request at the front of the queue before we conclude
 * that the reason we keep thinking we're going offline is
 * a CORS error returning a status of 0.  If that pattern
 * shows 3 times in a row, there is likely a CORS error.
 * Note that CORS errors appear to javascript as a status=0 error,
 * which is the same as if the client were offline.
 * @type {number}
 * @static
 */
SyncManager.MAX_RETRIES_BEFORE_CORS_ERROR = 3;

/**
 * Abort request after this number of retries.
 *
 * @type {number}
 * @static
 */
SyncManager.MAX_RETRIES = 20;

SyncManager._supportedEvents = [
/**
 * A sync request has failed.
 *
 * ```
 * client.syncManager.on('sync:error', function(evt) {
 *    console.error(evt.target.id + ' failed to send changes to server: ', result.data.message);
 *    console.log('Request Event:', requestEvt);
 *    console.log('Server Response:', result.data);
 * });
 * ```
 *
 * @event
 * @param {layer.SyncEvent} evt - The request object
 * @param {Object} result
 * @param {string} result.target - ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} result.request - The original request
 * @param {Object} result.error - The error object {id, code, message, url}
 */
'sync:error',

/**
 * A sync layer request has completed successfully.
 *
 * ```
 * client.syncManager.on('sync:success', function(evt) {
 *    console.log(evt.target.id + ' changes sent to server successfully');
 *    console.log('Request Event:', requestEvt);
 *    console.log('Server Response:', result.data);
 * });
 * ```
 *
 * @event
 * @param {Object} result
 * @param {string} result.target - ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} result.request - The original request
 * @param {Object} result.data - null or any data returned by the call
 */
'sync:success',

/**
 * A new sync request has been added.
 *
 * ```
 * client.syncManager.on('sync:add', function(evt) {
 *    console.log(evt.target.id + ' has changes queued for the server');
 *    console.log('Request Event:', requestEvt);
 * });
 * ```
 *
 * @event
 * @param {Object} result
 * @param {string} result.target - ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} evt - The request object
 */
'sync:add',

/**
 * A sync request has been canceled.
 *
 * Typically caused by a new SyncEvent that deletes the target of this SyncEvent
 *
 * @event
 * @param {layer.SyncEvent} evt - The request object
 * @param {Object} result
 * @param {string} result.target - ID of the message/conversation/etc. being operated upon
 * @param {layer.SyncEvent} result.request - The original request
 */
'sync:abort'].concat(Root._supportedEvents);

Root.initClass(SyncManager);
module.exports = SyncManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zeW5jLW1hbmFnZXIuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJXZWJzb2NrZXRTeW5jRXZlbnQiLCJ4aHIiLCJsb2dnZXIiLCJVdGlscyIsIk1BWF9SRUNFSVBUX0NPTk5FQ1RJT05TIiwiU3luY01hbmFnZXIiLCJvcHRpb25zIiwiY2xpZW50Iiwib24iLCJfcHJvY2Vzc05leHRSZXF1ZXN0IiwiX2xvYWRQZXJzaXN0ZWRRdWV1ZSIsInF1ZXVlIiwicmVjZWlwdFF1ZXVlIiwib25saW5lTWFuYWdlciIsIl9vbmxpbmVTdGF0ZUNoYW5nZSIsInNvY2tldE1hbmFnZXIiLCJpc09ubGluZSIsImV2dCIsImV2ZW50TmFtZSIsImxlbmd0aCIsInJldHVyblRvT25saW5lQ291bnQiLCJzZXRUaW1lb3V0IiwiaXNGaXJpbmciLCJmb3JFYWNoIiwic3luY0V2dCIsInJlcXVlc3RFdnQiLCJvcGVyYXRpb24iLCJfZmluZFVuZmlyZWRDcmVhdGUiLCJpbmZvIiwidGFyZ2V0IiwidG9PYmplY3QiLCJwdXNoIiwidHJpZ2dlciIsInJlcXVlc3QiLCJfcHVyZ2VPbkRlbGV0ZSIsImRiTWFuYWdlciIsIndyaXRlU3luY0V2ZW50cyIsIl9wcm9jZXNzTmV4dFN0YW5kYXJkUmVxdWVzdCIsIl9wcm9jZXNzTmV4dFJlY2VpcHRSZXF1ZXN0IiwiQm9vbGVhbiIsImZpbHRlciIsImlzRGVzdHJveWVkIiwiaXNBdXRoZW50aWNhdGVkIiwiX2lzVmFsaWRhdGluZyIsIl92YWxpZGF0ZVJlcXVlc3QiLCJpc1ZhbGlkIiwiX3JlbW92ZVJlcXVlc3QiLCJfZmlyZVJlcXVlc3QiLCJmaXJpbmdSZWNlaXB0cyIsInJlY2VpcHRFdnQiLCJpbmRleCIsImluZGV4T2YiLCJzcGxpY2UiLCJfZmlyZVJlcXVlc3RXZWJzb2NrZXQiLCJfZmlyZVJlcXVlc3RYSFIiLCJoZWFkZXJzIiwiYXV0aG9yaXphdGlvbiIsInNlc3Npb25Ub2tlbiIsImRlYnVnIiwiX2dldFJlcXVlc3REYXRhIiwiX3hoclJlc3VsdCIsInJlc3VsdCIsIl9pc09wZW4iLCJyZXF1ZXN0TWFuYWdlciIsInNlbmRSZXF1ZXN0Iiwic3luY0V2ZW50IiwiY2FsbGJhY2siLCJjbGFpbVN5bmNFdmVudCIsImlzRm91bmQiLCJkYXRhIiwiaWQiLCJfZ2V0Q3JlYXRlSWQiLCJzdWNjZXNzIiwiX2hhbmRsZURlZHVwbGljYXRpb25FcnJvcnMiLCJfeGhyRXJyb3IiLCJfeGhyU3VjY2VzcyIsImVycklkIiwiTUFYX1JFVFJJRVNfQkVGT1JFX0NPUlNfRVJST1IiLCJzdGF0dXMiLCJyZXRyeUNvdW50IiwiTUFYX1JFVFJJRVMiLCJub25jZSIsIndhcm4iLCJlcnJTdGF0ZSIsIl9nZXRFcnJvclN0YXRlIiwiX3hockhhbmRsZVNlcnZlckVycm9yIiwiX3hoclZhbGlkYXRlSXNPbmxpbmUiLCJfeGhySGFuZGxlU2VydmVyVW5hdmFpbGFibGVFcnJvciIsIl94aHJIYW5kbGVDb25uZWN0aW9uRXJyb3IiLCJtYXhEZWxheSIsIk1BWF9VTkFWQUlMQUJMRV9SRVRSWV9XQUlUIiwiZGVsYXkiLCJnZXRFeHBvbmVudGlhbEJhY2tvZmZTZWNvbmRzIiwiTWF0aCIsIm1pbiIsImJpbmQiLCJsb2dNc2ciLCJzdHJpbmdpZnkiLCJlcnJvciIsIkpTT04iLCJfcHVyZ2VEZXBlbmRlbnRSZXF1ZXN0cyIsImNoZWNrT25saW5lU3RhdHVzIiwiX3hoclZhbGlkYXRlSXNPbmxpbmVDYWxsYmFjayIsInJlc3BvbnNlIiwiZGVsZXRlREIiLCJkZWxldGVPYmplY3RzIiwiZGVwZW5kcyIsImRlc3Ryb3kiLCJsb2FkU3luY1F1ZXVlIiwiY29uY2F0IiwicHJvdG90eXBlIiwiX3N1cHBvcnRlZEV2ZW50cyIsImluaXRDbGFzcyIsIm1vZHVsZSIsImV4cG9ydHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbUJBLElBQU1BLE9BQU9DLFFBQVEsUUFBUixDQUFiOztlQUMrQkEsUUFBUSxjQUFSLEM7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QUFpQjdHLFdBQWpCIiwiZmlsZSI6InN5bmMtbWFuYWdlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGNsYXNzICBsYXllci5TeW5jTWFuYWdlclxuICogQGV4dGVuZHMgbGF5ZXIuUm9vdFxuICogQHByb3RlY3RlZFxuICpcbiAqIFRoaXMgY2xhc3MgbWFuYWdlc1xuICpcbiAqIDEuIGEgcXVldWUgb2YgcmVxdWVzdHMgdGhhdCBuZWVkIHRvIGJlIG1hZGVcbiAqIDIuIHdoZW4gYSByZXF1ZXN0IHNob3VsZCBiZSBmaXJlZCwgYmFzZWQgb24gYXV0aGVudGljYXRpb24gc3RhdGUsIG9ubGluZSBzdGF0ZSwgd2Vic29ja2V0IGNvbm5lY3Rpb24gc3RhdGUsIGFuZCBwb3NpdGlvbiBpbiB0aGUgcXVldWVcbiAqIDMuIHdoZW4gYSByZXF1ZXN0IHNob3VsZCBiZSBhYm9ydGVkXG4gKiA0LiB0cmlnZ2VyaW5nIGFueSByZXF1ZXN0IGNhbGxiYWNrc1xuICpcbiAqIFRPRE86IEluIHRoZSBldmVudCBvZiBhIEROUyBlcnJvciwgd2UgbWF5IGhhdmUgYSB2YWxpZCB3ZWJzb2NrZXQgcmVjZWl2aW5nIGV2ZW50cyBhbmQgdGVsbGluZyB1cyB3ZSBhcmUgb25saW5lLFxuICogYW5kIGJlIHVuYWJsZSB0byBjcmVhdGUgYSBSRVNUIGNhbGwuICBUaGlzIHdpbGwgYmUgaGFuZGxlZCB3cm9uZyBiZWNhdXNlIGV2aWRlbmNlIHdpbGwgc3VnZ2VzdCB0aGF0IHdlIGFyZSBvbmxpbmUuXG4gKiBUaGlzIGlzc3VlIGdvZXMgYXdheSB3aGVuIHdlIHVzZSBiaWRpcmVjdGlvbmFsIHdlYnNvY2tldHMgZm9yIGFsbCByZXF1ZXN0cy5cbiAqXG4gKiBBcHBsaWNhdGlvbnMgZG8gbm90IHR5cGljYWxseSBpbnRlcmFjdCB3aXRoIHRoaXMgY2xhc3MsIGJ1dCBtYXkgc3Vic2NyaWJlIHRvIGl0cyBldmVudHNcbiAqIHRvIGdldCByaWNoZXIgZGV0YWlsZWQgaW5mb3JtYXRpb24gdGhhbiBpcyBhdmFpbGFibGUgZnJvbSB0aGUgbGF5ZXIuQ2xpZW50IGluc3RhbmNlLlxuICovXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCB7IFdlYnNvY2tldFN5bmNFdmVudCB9ID0gcmVxdWlyZSgnLi9zeW5jLWV2ZW50Jyk7XG5jb25zdCB4aHIgPSByZXF1aXJlKCcuL3hocicpO1xuY29uc3QgbG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXInKTtcbmNvbnN0IFV0aWxzID0gcmVxdWlyZSgnLi9jbGllbnQtdXRpbHMnKTtcblxuY29uc3QgTUFYX1JFQ0VJUFRfQ09OTkVDVElPTlMgPSA0O1xuXG5jbGFzcyBTeW5jTWFuYWdlciBleHRlbmRzIFJvb3Qge1xuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBTeW5jTWFuYWdlci5cbiAgICpcbiAgICogQW4gQXBwbGljYXRpb24gaXMgZXhwZWN0ZWQgdG8gb25seSBoYXZlIG9uZSBTeW5jTWFuYWdlci5cbiAgICpcbiAgICogICAgICB2YXIgc29ja2V0TWFuYWdlciA9IG5ldyBsYXllci5XZWJzb2NrZXRzLlNvY2tldE1hbmFnZXIoe2NsaWVudDogY2xpZW50fSk7XG4gICAqICAgICAgdmFyIHJlcXVlc3RNYW5hZ2VyID0gbmV3IGxheWVyLldlYnNvY2tldHMuUmVxdWVzdE1hbmFnZXIoe2NsaWVudDogY2xpZW50LCBzb2NrZXRNYW5hZ2VyOiBzb2NrZXRNYW5hZ2VyfSk7XG4gICAqXG4gICAqICAgICAgdmFyIG9ubGluZU1hbmFnZXIgPSBuZXcgbGF5ZXIuT25saW5lTWFuYWdlcih7XG4gICAqICAgICAgICAgIHNvY2tldE1hbmFnZXI6IHNvY2tldE1hbmFnZXJcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogICAgICAvLyBOb3cgd2UgY2FuIGluc3RhbnRpYXRlIHRoaXMgdGhpbmcuLi5cbiAgICogICAgICB2YXIgU3luY01hbmFnZXIgPSBuZXcgbGF5ZXIuU3luY01hbmFnZXIoe1xuICAgKiAgICAgICAgICBjbGllbnQ6IGNsaWVudCxcbiAgICogICAgICAgICAgb25saW5lTWFuYWdlcjogb25saW5lTWFuYWdlcixcbiAgICogICAgICAgICAgc29ja2V0TWFuYWdlcjogc29ja2V0TWFuYWdlcixcbiAgICogICAgICAgICAgcmVxdWVzdE1hbmFnZXI6IHJlcXVlc3RNYW5hZ2VyXG4gICAqICAgICAgfSk7XG4gICAqXG4gICAqIEBtZXRob2QgY29uc3RydWN0b3JcbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gICAqIEBwYXJhbSB7bGF5ZXIuT25saW5lU3RhdGVNYW5hZ2VyfSBvcHRpb25zLm9ubGluZU1hbmFnZXJcbiAgICogQHBhcmFtIHtsYXllci5XZWJzb2NrZXRzLlJlcXVlc3RNYW5hZ2VyfSBvcHRpb25zLnJlcXVlc3RNYW5hZ2VyXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ2xpZW50fSBvcHRpb25zLmNsaWVudFxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuY2xpZW50ID0gb3B0aW9ucy5jbGllbnQ7XG5cbiAgICAvLyBOb3RlIHdlIGRvIG5vdCBzdG9yZSBhIHBvaW50ZXIgdG8gY2xpZW50Li4uIGl0IGlzIG5vdCBuZWVkZWQuXG4gICAgaWYgKHRoaXMuY2xpZW50KSB7XG4gICAgICB0aGlzLmNsaWVudC5vbigncmVhZHknLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdCgpO1xuICAgICAgICB0aGlzLl9sb2FkUGVyc2lzdGVkUXVldWUoKTtcbiAgICAgIH0sIHRoaXMpO1xuICAgIH1cbiAgICB0aGlzLnF1ZXVlID0gW107XG4gICAgdGhpcy5yZWNlaXB0UXVldWUgPSBbXTtcblxuICAgIHRoaXMub25saW5lTWFuYWdlci5vbignZGlzY29ubmVjdGVkJywgdGhpcy5fb25saW5lU3RhdGVDaGFuZ2UsIHRoaXMpO1xuICAgIHRoaXMuc29ja2V0TWFuYWdlci5vbignY29ubmVjdGVkIGRpc2Nvbm5lY3RlZCcsIHRoaXMuX29ubGluZVN0YXRlQ2hhbmdlLCB0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHdoZXRoZXIgdGhlIENsaWVudCBpcyBvbmxpbmUvb2ZmbGluZS5cbiAgICpcbiAgICogRm9yIGludGVybmFsIHVzZTsgYXBwbGljYXRpb25zIHNob3VsZCB1c2UgbGF5ZXIuQ2xpZW50LmlzT25saW5lLlxuICAgKlxuICAgKiBAbWV0aG9kIGlzT25saW5lXG4gICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgKi9cbiAgaXNPbmxpbmUoKSB7XG4gICAgcmV0dXJuIHRoaXMub25saW5lTWFuYWdlci5pc09ubGluZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIHN5bmMgcmVxdWVzdCB3aGVuIGNvbm5lY3Rpb24gaXMgcmVzdG9yZWQuXG4gICAqXG4gICAqIEFueSB0aW1lIHdlIGdvIGJhY2sgb25saW5lIChhcyBzaWduYWxlZCBieSB0aGUgb25saW5lU3RhdGVNYW5hZ2VyKSxcbiAgICogUHJvY2VzcyB0aGUgbmV4dCBTeW5jIEV2ZW50ICh3aWxsIGRvIG5vdGhpbmcgaWYgb25lIGlzIGFscmVhZHkgZmlyaW5nKVxuICAgKlxuICAgKiBAbWV0aG9kIF9vbmxpbmVTdGF0ZUNoYW5nZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IGV2dE5hbWUgLSAnY29ubmVjdGVkJyBvciAnZGlzY29ubmVjdGVkJ1xuICAgKiBAcGFyYW0gIHtsYXllci5MYXllckV2ZW50fSBldnRcbiAgICovXG4gIF9vbmxpbmVTdGF0ZUNoYW5nZShldnQpIHtcbiAgICBpZiAoZXZ0LmV2ZW50TmFtZSA9PT0gJ2Nvbm5lY3RlZCcpIHtcbiAgICAgIGlmICh0aGlzLnF1ZXVlLmxlbmd0aCkgdGhpcy5xdWV1ZVswXS5yZXR1cm5Ub09ubGluZUNvdW50Kys7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdCgpLCAxMDApO1xuICAgIH0gZWxzZSBpZiAoZXZ0LmV2ZW50TmFtZSA9PT0gJ2Rpc2Nvbm5lY3RlZCcpIHtcbiAgICAgIGlmICh0aGlzLnF1ZXVlLmxlbmd0aCkge1xuICAgICAgICB0aGlzLnF1ZXVlWzBdLmlzRmlyaW5nID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5yZWNlaXB0UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMucmVjZWlwdFF1ZXVlLmZvckVhY2goc3luY0V2dCA9PiB7IHN5bmNFdnQuaXNGaXJpbmcgPSBmYWxzZTsgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSBuZXcgeGhyIHJlcXVlc3QgdG8gdGhlIHF1ZXVlLlxuICAgKlxuICAgKiBJZiB0aGUgcXVldWUgaXMgZW1wdHksIHRoaXMgd2lsbCBiZSBmaXJlZCBpbW1lZGlhdGVseTsgZWxzZSBpdCB3aWxsIGJlIGFkZGVkIHRvIHRoZSBxdWV1ZSBhbmQgd2FpdCBpdHMgdHVybi5cbiAgICpcbiAgICogSWYgaXRzIGEgcmVhZC9kZWxpdmVyeSByZWNlaXB0IHJlcXVlc3QsIGl0IHdpbGwgdHlwaWNhbGx5IGJlIGZpcmVkIGltbWVkaWF0ZWx5IHVubGVzcyB0aGVyZSBhcmUgbWFueSByZWNlaXB0XG4gICAqIHJlcXVlc3RzIGFscmVhZHkgaW4tZmxpZ2h0LlxuICAgKlxuICAgKiBAbWV0aG9kIHJlcXVlc3RcbiAgICogQHBhcmFtICB7bGF5ZXIuU3luY0V2ZW50fSByZXF1ZXN0RXZ0IC0gQSBTeW5jRXZlbnQgc3BlY2lmeWluZyB0aGUgcmVxdWVzdCB0byBiZSBtYWRlXG4gICAqL1xuICByZXF1ZXN0KHJlcXVlc3RFdnQpIHtcbiAgICAvLyBJZiBpdHMgYSBQQVRDSCByZXF1ZXN0IG9uIGFuIG9iamVjdCB0aGF0IGlzbid0IHlldCBjcmVhdGVkLFxuICAgIC8vIGRvIG5vdCBhZGQgaXQgdG8gdGhlIHF1ZXVlLlxuICAgIGlmIChyZXF1ZXN0RXZ0Lm9wZXJhdGlvbiAhPT0gJ1BBVENIJyB8fCAhdGhpcy5fZmluZFVuZmlyZWRDcmVhdGUocmVxdWVzdEV2dCkpIHtcbiAgICAgIGxvZ2dlci5pbmZvKGBTeW5jIE1hbmFnZXIgUmVxdWVzdCAke3JlcXVlc3RFdnQub3BlcmF0aW9ufSBvbiB0YXJnZXQgJHtyZXF1ZXN0RXZ0LnRhcmdldH1gLCByZXF1ZXN0RXZ0LnRvT2JqZWN0KCkpO1xuICAgICAgaWYgKHJlcXVlc3RFdnQub3BlcmF0aW9uID09PSAnUkVDRUlQVCcpIHtcbiAgICAgICAgdGhpcy5yZWNlaXB0UXVldWUucHVzaChyZXF1ZXN0RXZ0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucXVldWUucHVzaChyZXF1ZXN0RXZ0KTtcbiAgICAgIH1cbiAgICAgIHRoaXMudHJpZ2dlcignc3luYzphZGQnLCB7XG4gICAgICAgIHJlcXVlc3Q6IHJlcXVlc3RFdnQsXG4gICAgICAgIHRhcmdldDogcmVxdWVzdEV2dC50YXJnZXQsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLmluZm8oYFN5bmMgTWFuYWdlciBSZXF1ZXN0IFBBVENIICR7cmVxdWVzdEV2dC50YXJnZXR9IHJlcXVlc3QgaWdub3JlZDsgY3JlYXRlIHJlcXVlc3Qgc3RpbGwgZW5xdWV1ZWRgLCByZXF1ZXN0RXZ0LnRvT2JqZWN0KCkpO1xuICAgIH1cblxuICAgIC8vIElmIGl0cyBhIERFTEVURSByZXF1ZXN0LCBwdXJnZSBhbGwgb3RoZXIgcmVxdWVzdHMgb24gdGhhdCB0YXJnZXQuXG4gICAgaWYgKHJlcXVlc3RFdnQub3BlcmF0aW9uID09PSAnREVMRVRFJykge1xuICAgICAgdGhpcy5fcHVyZ2VPbkRlbGV0ZShyZXF1ZXN0RXZ0KTtcbiAgICB9XG5cbiAgICB0aGlzLl9wcm9jZXNzTmV4dFJlcXVlc3QocmVxdWVzdEV2dCk7XG4gIH1cblxuICBfcHJvY2Vzc05leHRSZXF1ZXN0KHJlcXVlc3RFdnQpIHtcbiAgICAvLyBGaXJlIHRoZSByZXF1ZXN0IGlmIHRoZXJlIGFyZW4ndCBhbnkgZXhpc3RpbmcgcmVxdWVzdHMgYWxyZWFkeSBmaXJpbmdcbiAgICBpZiAodGhpcy5xdWV1ZS5sZW5ndGggJiYgIXRoaXMucXVldWVbMF0uaXNGaXJpbmcpIHtcbiAgICAgIGlmIChyZXF1ZXN0RXZ0KSB7XG4gICAgICAgIHRoaXMuY2xpZW50LmRiTWFuYWdlci53cml0ZVN5bmNFdmVudHMoW3JlcXVlc3RFdnRdLCAoKSA9PiB0aGlzLl9wcm9jZXNzTmV4dFN0YW5kYXJkUmVxdWVzdCgpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3Byb2Nlc3NOZXh0U3RhbmRhcmRSZXF1ZXN0KCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgd2UgaGF2ZSBhbnl0aGluZyBpbiB0aGUgcmVjZWlwdHMgcXVldWUsIGZpcmUgaXRcbiAgICBpZiAodGhpcy5yZWNlaXB0UXVldWUubGVuZ3RoKSB7XG4gICAgICB0aGlzLl9wcm9jZXNzTmV4dFJlY2VpcHRSZXF1ZXN0KCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZpbmQgY3JlYXRlIHJlcXVlc3QgZm9yIHRoaXMgcmVzb3VyY2UuXG4gICAqXG4gICAqIERldGVybWluZSBpZiB0aGUgZ2l2ZW4gdGFyZ2V0IGhhcyBhIFBPU1QgcmVxdWVzdCB3YWl0aW5nIHRvIGNyZWF0ZVxuICAgKiB0aGUgcmVzb3VyY2UsIGFuZCByZXR1cm4gYW55IG1hdGNoaW5nIHJlcXVlc3RzLiBVc2VkXG4gICAqIGZvciBmb2xkaW5nIFBBVENIIHJlcXVlc3RzIGludG8gYW4gdW5maXJlZCBDUkVBVEUvUE9TVCByZXF1ZXN0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9maW5kVW5maXJlZENyZWF0ZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RFdnRcbiAgICogQHJldHVybiB7Qm9vbGVhbn1cbiAgICovXG4gIF9maW5kVW5maXJlZENyZWF0ZShyZXF1ZXN0RXZ0KSB7XG4gICAgcmV0dXJuIEJvb2xlYW4odGhpcy5xdWV1ZS5maWx0ZXIoZXZ0ID0+XG4gICAgICBldnQudGFyZ2V0ID09PSByZXF1ZXN0RXZ0LnRhcmdldCAmJiBldnQub3BlcmF0aW9uID09PSAnUE9TVCcgJiYgIWV2dC5pc0ZpcmluZykubGVuZ3RoXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIHRoZSBuZXh0IHJlcXVlc3QgaW4gdGhlIHF1ZXVlLlxuICAgKlxuICAgKiBSZXF1ZXN0IGlzIGRlcXVldWVkIG9uIGNvbXBsZXRpbmcgdGhlIHByb2Nlc3MuXG4gICAqIElmIHRoZSBmaXJzdCByZXF1ZXN0IGluIHRoZSBxdWV1ZSBpcyBmaXJpbmcsIGRvIG5vdGhpbmcuXG4gICAqXG4gICAqIEBtZXRob2QgX3Byb2Nlc3NOZXh0UmVxdWVzdFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3Byb2Nlc3NOZXh0U3RhbmRhcmRSZXF1ZXN0KCkge1xuICAgIGlmICh0aGlzLmlzRGVzdHJveWVkIHx8ICF0aGlzLmNsaWVudC5pc0F1dGhlbnRpY2F0ZWQpIHJldHVybjtcbiAgICBjb25zdCByZXF1ZXN0RXZ0ID0gdGhpcy5xdWV1ZVswXTtcbiAgICBpZiAodGhpcy5pc09ubGluZSgpICYmIHJlcXVlc3RFdnQgJiYgIXJlcXVlc3RFdnQuaXNGaXJpbmcgJiYgIXJlcXVlc3RFdnQuX2lzVmFsaWRhdGluZykge1xuICAgICAgcmVxdWVzdEV2dC5faXNWYWxpZGF0aW5nID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3ZhbGlkYXRlUmVxdWVzdChyZXF1ZXN0RXZ0LCAoaXNWYWxpZCkgPT4ge1xuICAgICAgICByZXF1ZXN0RXZ0Ll9pc1ZhbGlkYXRpbmcgPSBmYWxzZTtcbiAgICAgICAgaWYgKCFpc1ZhbGlkKSB7XG4gICAgICAgICAgdGhpcy5fcmVtb3ZlUmVxdWVzdChyZXF1ZXN0RXZ0LCBmYWxzZSk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuX3Byb2Nlc3NOZXh0U3RhbmRhcmRSZXF1ZXN0KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fZmlyZVJlcXVlc3QocmVxdWVzdEV2dCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9jZXNzIHVwIHRvIE1BWF9SRUNFSVBUX0NPTk5FQ1RJT05TIHdvcnRoIG9mIHJlY2VpcHRzLlxuICAgKlxuICAgKiBUaGVzZSByZXF1ZXN0cyBoYXZlIG5vIGludGVyZGVwZW5kZW5jaWVzLiBKdXN0IGZpcmUgdGhlbSBhbGxcbiAgICogYXMgZmFzdCBhcyB3ZSBjYW4sIGluIHBhcmFsbGVsLlxuICAgKlxuICAgKiBAbWV0aG9kIF9wcm9jZXNzTmV4dFJlY2VpcHRSZXF1ZXN0XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcHJvY2Vzc05leHRSZWNlaXB0UmVxdWVzdCgpIHtcbiAgICBsZXQgZmlyaW5nUmVjZWlwdHMgPSAwO1xuICAgIHRoaXMucmVjZWlwdFF1ZXVlLmZvckVhY2goKHJlY2VpcHRFdnQpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzT25saW5lKCkgJiYgcmVjZWlwdEV2dCkge1xuICAgICAgICBpZiAocmVjZWlwdEV2dC5pc0ZpcmluZyB8fCByZWNlaXB0RXZ0Ll9pc1ZhbGlkYXRpbmcpIHtcbiAgICAgICAgICBmaXJpbmdSZWNlaXB0cysrO1xuICAgICAgICB9IGVsc2UgaWYgKGZpcmluZ1JlY2VpcHRzIDwgTUFYX1JFQ0VJUFRfQ09OTkVDVElPTlMpIHtcbiAgICAgICAgICBmaXJpbmdSZWNlaXB0cysrO1xuICAgICAgICAgIHJlY2VpcHRFdnQuX2lzVmFsaWRhdGluZyA9IHRydWU7XG4gICAgICAgICAgdGhpcy5fdmFsaWRhdGVSZXF1ZXN0KHJlY2VpcHRFdnQsIChpc1ZhbGlkKSA9PiB7XG4gICAgICAgICAgICByZWNlaXB0RXZ0Ll9pc1ZhbGlkYXRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmICghaXNWYWxpZCkge1xuICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMucmVjZWlwdFF1ZXVlLmluZGV4T2YocmVjZWlwdEV2dCk7XG4gICAgICAgICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHRoaXMucmVjZWlwdFF1ZXVlLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLl9maXJlUmVxdWVzdChyZWNlaXB0RXZ0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERpcmVjdGx5IGZpcmUgdGhpcyBzeW5jIHJlcXVlc3QuXG4gICAqXG4gICAqIFRoaXMgaXMgaW50ZW5kZWQgdG8gYmUgY2FsbGVkIG9ubHkgYWZ0ZXIgY2FyZWZ1bCBhbmFseXNpcyBvZiBvdXIgc3RhdGUgdG8gbWFrZSBzdXJlIGl0cyBzYWZlIHRvIHNlbmQgdGhlIHJlcXVlc3QuXG4gICAqIFNlZSBgX3Byb2Nlc3NOZXh0UmVxdWVzdCgpYFxuICAgKlxuICAgKiBAbWV0aG9kIF9maXJlUmVxdWVzdFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudH0gcmVxdWVzdEV2dFxuICAgKi9cbiAgX2ZpcmVSZXF1ZXN0KHJlcXVlc3RFdnQpIHtcbiAgICBpZiAocmVxdWVzdEV2dCBpbnN0YW5jZW9mIFdlYnNvY2tldFN5bmNFdmVudCkge1xuICAgICAgdGhpcy5fZmlyZVJlcXVlc3RXZWJzb2NrZXQocmVxdWVzdEV2dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2ZpcmVSZXF1ZXN0WEhSKHJlcXVlc3RFdnQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEaXJlY3RseSBmaXJlIHRoaXMgWEhSIFN5bmMgcmVxdWVzdC5cbiAgICpcbiAgICogQG1ldGhvZCBfZmlyZVJlcXVlc3RYSFJcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnQuWEhSU3luY0V2ZW50fSByZXF1ZXN0RXZ0XG4gICAqL1xuICBfZmlyZVJlcXVlc3RYSFIocmVxdWVzdEV2dCkge1xuICAgIHJlcXVlc3RFdnQuaXNGaXJpbmcgPSB0cnVlO1xuICAgIGlmICghcmVxdWVzdEV2dC5oZWFkZXJzKSByZXF1ZXN0RXZ0LmhlYWRlcnMgPSB7fTtcbiAgICByZXF1ZXN0RXZ0LmhlYWRlcnMuYXV0aG9yaXphdGlvbiA9ICdMYXllciBzZXNzaW9uLXRva2VuPVwiJyArIHRoaXMuY2xpZW50LnNlc3Npb25Ub2tlbiArICdcIic7XG4gICAgbG9nZ2VyLmRlYnVnKGBTeW5jIE1hbmFnZXIgWEhSIFJlcXVlc3QgRmlyaW5nICR7cmVxdWVzdEV2dC5vcGVyYXRpb259ICR7cmVxdWVzdEV2dC50YXJnZXR9YCxcbiAgICAgIHJlcXVlc3RFdnQudG9PYmplY3QoKSk7XG4gICAgeGhyKHJlcXVlc3RFdnQuX2dldFJlcXVlc3REYXRhKHRoaXMuY2xpZW50KSwgcmVzdWx0ID0+IHRoaXMuX3hoclJlc3VsdChyZXN1bHQsIHJlcXVlc3RFdnQpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEaXJlY3RseSBmaXJlIHRoaXMgV2Vic29ja2V0IFN5bmMgcmVxdWVzdC5cbiAgICpcbiAgICogQG1ldGhvZCBfZmlyZVJlcXVlc3RXZWJzb2NrZXRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnQuV2Vic29ja2V0U3luY0V2ZW50fSByZXF1ZXN0RXZ0XG4gICAqL1xuICBfZmlyZVJlcXVlc3RXZWJzb2NrZXQocmVxdWVzdEV2dCkge1xuICAgIGlmICh0aGlzLnNvY2tldE1hbmFnZXIgJiYgdGhpcy5zb2NrZXRNYW5hZ2VyLl9pc09wZW4oKSkge1xuICAgICAgbG9nZ2VyLmRlYnVnKGBTeW5jIE1hbmFnZXIgV2Vic29ja2V0IFJlcXVlc3QgRmlyaW5nICR7cmVxdWVzdEV2dC5vcGVyYXRpb259IG9uIHRhcmdldCAke3JlcXVlc3RFdnQudGFyZ2V0fWAsXG4gICAgICAgIHJlcXVlc3RFdnQudG9PYmplY3QoKSk7XG4gICAgICByZXF1ZXN0RXZ0LmlzRmlyaW5nID0gdHJ1ZTtcbiAgICAgIHRoaXMucmVxdWVzdE1hbmFnZXIuc2VuZFJlcXVlc3QocmVxdWVzdEV2dC5fZ2V0UmVxdWVzdERhdGEodGhpcy5jbGllbnQpLFxuICAgICAgICAgIHJlc3VsdCA9PiB0aGlzLl94aHJSZXN1bHQocmVzdWx0LCByZXF1ZXN0RXZ0KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci5kZWJ1ZygnU3luYyBNYW5hZ2VyIFdlYnNvY2tldCBSZXF1ZXN0IHNraXBwZWQ7IHNvY2tldCBjbG9zZWQnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSXMgdGhlIHN5bmNFdmVudCBzdGlsbCB2YWxpZD9cbiAgICpcbiAgICogVGhpcyBtZXRob2Qgc3BlY2lmaWNhbGx5IHRlc3RzIHRvIHNlZSBpZiBzb21lIG90aGVyIHRhYiBoYXMgYWxyZWFkeSBzZW50IHRoaXMgcmVxdWVzdC5cbiAgICogSWYgcGVyc2lzdGVuY2Ugb2YgdGhlIHN5bmNRdWV1ZSBpcyBub3QgZW5hYmxlZCwgdGhlbiB0aGUgY2FsbGJhY2sgaXMgaW1tZWRpYXRlbHkgY2FsbGVkIHdpdGggdHJ1ZS5cbiAgICogSWYgYW5vdGhlciB0YWIgaGFzIGFscmVhZHkgc2VudCB0aGUgcmVxdWVzdCwgdGhlbiB0aGUgZW50cnkgd2lsbCBubyBsb25nZXIgYmUgaW4gaW5kZXhlZERCIGFuZCB0aGUgY2FsbGJhY2tcbiAgICogd2lsbCBjYWxsIGZhbHNlLlxuICAgKlxuICAgKiBAbWV0aG9kIF92YWxpZGF0ZVJlcXVlc3RcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IHN5bmNFdmVudFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjay5pc1ZhbGlkIC0gVGhlIHJlcXVlc3QgaXMgc3RpbGwgdmFsaWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF92YWxpZGF0ZVJlcXVlc3Qoc3luY0V2ZW50LCBjYWxsYmFjaykge1xuICAgIHRoaXMuY2xpZW50LmRiTWFuYWdlci5jbGFpbVN5bmNFdmVudChzeW5jRXZlbnQsIGlzRm91bmQgPT4gY2FsbGJhY2soaXNGb3VuZCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFR1cm4gZGVkdXBsaWNhdGlvbiBlcnJvcnMgaW50byBzdWNjZXNzIG1lc3NhZ2VzLlxuICAgKlxuICAgKiBJZiB0aGlzIHJlcXVlc3QgaGFzIGFscmVhZHkgYmVlbiBtYWRlIGJ1dCB3ZSBmYWlsZWQgdG8gZ2V0IGEgcmVzcG9uc2UgdGhlIGZpcnN0IHRpbWUgYW5kIHdlIHJldHJpZWQgdGhlIHJlcXVlc3QsXG4gICAqIHdlIHdpbGwgcmVpc3N1ZSB0aGUgcmVxdWVzdC4gIElmIHRoZSBwcmlvciByZXF1ZXN0IHdhcyBzdWNjZXNzZnVsIHdlJ2xsIGdldCBiYWNrIGEgZGVkdXBsaWNhdGlvbiBlcnJvclxuICAgKiB3aXRoIHRoZSBjcmVhdGVkIG9iamVjdC4gQXMgZmFyIGFzIHRoZSBXZWJTREsgaXMgY29uY2VybmVkLCB0aGlzIGlzIGEgc3VjY2Vzcy5cbiAgICpcbiAgICogQG1ldGhvZCBfaGFuZGxlRGVkdXBsaWNhdGlvbkVycm9yc1xuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2hhbmRsZURlZHVwbGljYXRpb25FcnJvcnMocmVzdWx0KSB7XG4gICAgaWYgKHJlc3VsdC5kYXRhICYmIHJlc3VsdC5kYXRhLmlkID09PSAnaWRfaW5fdXNlJyAmJlxuICAgICAgICByZXN1bHQuZGF0YS5kYXRhICYmIHJlc3VsdC5kYXRhLmRhdGEuaWQgPT09IHJlc3VsdC5yZXF1ZXN0Ll9nZXRDcmVhdGVJZCgpKSB7XG4gICAgICByZXN1bHQuc3VjY2VzcyA9IHRydWU7XG4gICAgICByZXN1bHQuZGF0YSA9IHJlc3VsdC5kYXRhLmRhdGE7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgdGhlIHJlc3VsdCBvZiBhbiB4aHIgY2FsbCwgcm91dGluZyBpdCB0byB0aGUgYXBwcm9wcmlhdGUgaGFuZGxlci5cbiAgICpcbiAgICogQG1ldGhvZCBfeGhyUmVzdWx0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gcmVzdWx0ICAtIFJlc3BvbnNlIG9iamVjdCByZXR1cm5lZCBieSB4aHIgY2FsbFxuICAgKiBAcGFyYW0gIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RFdnQgLSBSZXF1ZXN0IG9iamVjdFxuICAgKi9cbiAgX3hoclJlc3VsdChyZXN1bHQsIHJlcXVlc3RFdnQpIHtcbiAgICBpZiAodGhpcy5pc0Rlc3Ryb3llZCkgcmV0dXJuO1xuICAgIHJlc3VsdC5yZXF1ZXN0ID0gcmVxdWVzdEV2dDtcbiAgICByZXF1ZXN0RXZ0LmlzRmlyaW5nID0gZmFsc2U7XG4gICAgdGhpcy5faGFuZGxlRGVkdXBsaWNhdGlvbkVycm9ycyhyZXN1bHQpO1xuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIHRoaXMuX3hockVycm9yKHJlc3VsdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3hoclN1Y2Nlc3MocmVzdWx0KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2F0ZWdvcml6ZSB0aGUgZXJyb3IgZm9yIGhhbmRsaW5nLlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRFcnJvclN0YXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gcmVzdWx0ICAtIFJlc3BvbnNlIG9iamVjdCByZXR1cm5lZCBieSB4aHIgY2FsbFxuICAgKiBAcGFyYW0gIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RFdnQgLSBSZXF1ZXN0IG9iamVjdFxuICAgKiBAcGFyYW0gIHtib29sZWFufSBpc09ubGluZSAtIElzIG91ciBhcHAgc3RhdGUgc2V0IHRvIG9ubGluZVxuICAgKiBAcmV0dXJucyB7U3RyaW5nfVxuICAgKi9cbiAgX2dldEVycm9yU3RhdGUocmVzdWx0LCByZXF1ZXN0RXZ0LCBpc09ubGluZSkge1xuICAgIGNvbnN0IGVycklkID0gcmVzdWx0LmRhdGEgPyByZXN1bHQuZGF0YS5pZCA6ICcnO1xuICAgIGlmICghaXNPbmxpbmUpIHtcbiAgICAgIC8vIENPUlMgZXJyb3JzIGxvb2sgaWRlbnRpY2FsIHRvIG9mZmxpbmU7IGJ1dCBpZiBvdXIgb25saW5lIHN0YXRlIGhhcyB0cmFuc2l0aW9uZWQgZnJvbSBmYWxzZSB0byB0cnVlIHJlcGVhdGVkbHkgd2hpbGUgcHJvY2Vzc2luZyB0aGlzIHJlcXVlc3QsXG4gICAgICAvLyB0aGF0cyBhIGhpbnQgdGhhdCB0aGF0IGl0cyBhIENPUlMgZXJyb3JcbiAgICAgIGlmIChyZXF1ZXN0RXZ0LnJldHVyblRvT25saW5lQ291bnQgPj0gU3luY01hbmFnZXIuTUFYX1JFVFJJRVNfQkVGT1JFX0NPUlNfRVJST1IpIHtcbiAgICAgICAgcmV0dXJuICdDT1JTJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnb2ZmbGluZSc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlcnJJZCA9PT0gJ25vdF9mb3VuZCcpIHtcbiAgICAgIHJldHVybiAnbm90Rm91bmQnO1xuICAgIH0gZWxzZSBpZiAoZXJySWQgPT09ICdpZF9pbl91c2UnKSB7XG4gICAgICByZXR1cm4gJ2ludmFsaWRJZCc7IC8vIFRoaXMgb25seSBmaXJlcyBpZiB3ZSBnZXQgYGlkX2luX3VzZWAgYnV0IG5vIFJlc291cmNlLCB3aGljaCBtZWFucyB0aGUgVVVJRCB3YXMgdXNlZCBieSBhbm90aGVyIHVzZXIvYXBwLlxuICAgIH0gZWxzZSBpZiAocmVzdWx0LnN0YXR1cyA9PT0gNDA4IHx8IGVycklkID09PSAncmVxdWVzdF90aW1lb3V0Jykge1xuICAgICAgaWYgKHJlcXVlc3RFdnQucmV0cnlDb3VudCA+PSBTeW5jTWFuYWdlci5NQVhfUkVUUklFUykge1xuICAgICAgICByZXR1cm4gJ3Rvb01hbnlGYWlsdXJlc1doaWxlT25saW5lJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAndmFsaWRhdGVPbmxpbmVBbmRSZXRyeSc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChbNTAyLCA1MDMsIDUwNF0uaW5kZXhPZihyZXN1bHQuc3RhdHVzKSAhPT0gLTEpIHtcbiAgICAgIGlmIChyZXF1ZXN0RXZ0LnJldHJ5Q291bnQgPj0gU3luY01hbmFnZXIuTUFYX1JFVFJJRVMpIHtcbiAgICAgICAgcmV0dXJuICd0b29NYW55RmFpbHVyZXNXaGlsZU9ubGluZSc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJ3NlcnZlclVuYXZhaWxhYmxlJztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVycklkID09PSAnYXV0aGVudGljYXRpb25fcmVxdWlyZWQnICYmIHJlc3VsdC5kYXRhLmRhdGEgJiYgcmVzdWx0LmRhdGEuZGF0YS5ub25jZSkge1xuICAgICAgcmV0dXJuICdyZWF1dGhvcml6ZSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAnc2VydmVyUmVqZWN0ZWRSZXF1ZXN0JztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIGZhaWxlZCByZXF1ZXN0cy5cbiAgICpcbiAgICogMS4gSWYgdGhlcmUgd2FzIGFuIGVycm9yIGZyb20gdGhlIHNlcnZlciwgdGhlbiB0aGUgcmVxdWVzdCBoYXMgcHJvYmxlbXNcbiAgICogMi4gSWYgd2UgZGV0ZXJtaW5lIHdlIGFyZSBub3QgaW4gZmFjdCBvbmxpbmUsIGNhbGwgdGhlIGNvbm5lY3Rpb25FcnJvciBoYW5kbGVyXG4gICAqIDMuIElmIHdlIHRoaW5rIHdlIGFyZSBvbmxpbmUsIHZlcmlmeSB3ZSBhcmUgb25saW5lIGFuZCB0aGVuIGRldGVybWluZSBob3cgdG8gaGFuZGxlIGl0LlxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJFcnJvclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3VsdCAgLSBSZXNwb25zZSBvYmplY3QgcmV0dXJuZWQgYnkgeGhyIGNhbGxcbiAgICogQHBhcmFtICB7bGF5ZXIuU3luY0V2ZW50fSByZXF1ZXN0RXZ0IC0gUmVxdWVzdCBvYmplY3RcbiAgICovXG4gIF94aHJFcnJvcihyZXN1bHQpIHtcbiAgICBjb25zdCByZXF1ZXN0RXZ0ID0gcmVzdWx0LnJlcXVlc3Q7XG5cbiAgICBsb2dnZXIud2FybihgU3luYyBNYW5hZ2VyICR7cmVxdWVzdEV2dCBpbnN0YW5jZW9mIFdlYnNvY2tldFN5bmNFdmVudCA/ICdXZWJzb2NrZXQnIDogJ1hIUid9IGAgK1xuICAgICAgYCR7cmVxdWVzdEV2dC5vcGVyYXRpb259IFJlcXVlc3Qgb24gdGFyZ2V0ICR7cmVxdWVzdEV2dC50YXJnZXR9IGhhcyBGYWlsZWRgLCByZXF1ZXN0RXZ0LnRvT2JqZWN0KCkpO1xuXG5cbiAgICBjb25zdCBlcnJTdGF0ZSA9IHRoaXMuX2dldEVycm9yU3RhdGUocmVzdWx0LCByZXF1ZXN0RXZ0LCB0aGlzLmlzT25saW5lKCkpO1xuICAgIGxvZ2dlci53YXJuKCdTeW5jIE1hbmFnZXIgRXJyb3IgU3RhdGU6ICcgKyBlcnJTdGF0ZSk7XG4gICAgc3dpdGNoIChlcnJTdGF0ZSkge1xuICAgICAgY2FzZSAndG9vTWFueUZhaWx1cmVzV2hpbGVPbmxpbmUnOlxuICAgICAgICB0aGlzLl94aHJIYW5kbGVTZXJ2ZXJFcnJvcihyZXN1bHQsICdTeW5jIE1hbmFnZXIgU2VydmVyIFVuYXZhaWxhYmxlIFRvbyBMb25nOyByZW1vdmluZyByZXF1ZXN0JywgZmFsc2UpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ25vdEZvdW5kJzpcbiAgICAgICAgdGhpcy5feGhySGFuZGxlU2VydmVyRXJyb3IocmVzdWx0LCAnUmVzb3VyY2Ugbm90IGZvdW5kOyBwcmVzdW1hYmx5IGRlbGV0ZWQnLCBmYWxzZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnaW52YWxpZElkJzpcbiAgICAgICAgdGhpcy5feGhySGFuZGxlU2VydmVyRXJyb3IocmVzdWx0LCAnSUQgd2FzIG5vdCB1bmlxdWU7IHJlcXVlc3QgZmFpbGVkJywgZmFsc2UpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3ZhbGlkYXRlT25saW5lQW5kUmV0cnknOlxuICAgICAgICAvLyBTZXJ2ZXIgYXBwZWFycyB0byBiZSBodW5nIGJ1dCB3aWxsIGV2ZW50dWFsbHkgcmVjb3Zlci5cbiAgICAgICAgLy8gUmV0cnkgYSBmZXcgdGltZXMgYW5kIHRoZW4gZXJyb3Igb3V0LlxuICAgICAgICB0aGlzLl94aHJWYWxpZGF0ZUlzT25saW5lKHJlcXVlc3RFdnQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3NlcnZlclVuYXZhaWxhYmxlJzpcbiAgICAgICAgLy8gU2VydmVyIGlzIGluIGEgYmFkIHN0YXRlIGJ1dCB3aWxsIGV2ZW50dWFsbHkgcmVjb3ZlcjtcbiAgICAgICAgLy8ga2VlcCByZXRyeWluZy5cbiAgICAgICAgdGhpcy5feGhySGFuZGxlU2VydmVyVW5hdmFpbGFibGVFcnJvcihyZXF1ZXN0RXZ0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdyZWF1dGhvcml6ZSc6XG4gICAgICAgIC8vIHNlc3Npb25Ub2tlbiBhcHBlYXJzIHRvIG5vIGxvbmdlciBiZSB2YWxpZDsgZm9yd2FyZCByZXNwb25zZVxuICAgICAgICAvLyBvbiB0byBjbGllbnQtYXV0aGVudGljYXRvciB0byBwcm9jZXNzLlxuICAgICAgICAvLyBEbyBub3QgcmV0cnkgbm9yIGFkdmFuY2UgdG8gbmV4dCByZXF1ZXN0LlxuICAgICAgICBpZiAocmVxdWVzdEV2dC5jYWxsYmFjaykgcmVxdWVzdEV2dC5jYWxsYmFjayhyZXN1bHQpO1xuXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc2VydmVyUmVqZWN0ZWRSZXF1ZXN0JzpcbiAgICAgICAgLy8gU2VydmVyIHByZXN1bWFibHkgZGlkIG5vdCBsaWtlIHRoZSBhcmd1bWVudHMgdG8gdGhpcyBjYWxsXG4gICAgICAgIC8vIG9yIHRoZSB1cmwgd2FzIGludmFsaWQuICBEbyBub3QgcmV0cnk7IHRyaWdnZXIgdGhlIGNhbGxiYWNrXG4gICAgICAgIC8vIGFuZCBsZXQgdGhlIGNhbGxlciBoYW5kbGUgaXQuXG4gICAgICAgIHRoaXMuX3hockhhbmRsZVNlcnZlckVycm9yKHJlc3VsdCwgJ1N5bmMgTWFuYWdlciBTZXJ2ZXIgUmVqZWN0cyBSZXF1ZXN0OyByZW1vdmluZyByZXF1ZXN0JywgdHJ1ZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnQ09SUyc6XG4gICAgICAgIC8vIEEgcGF0dGVybiBvZiBvZmZsaW5lLWxpa2UgZmFpbHVyZXMgdGhhdCBzdWdnZXN0cyBpdHMgYWN0dWFsbHkgYSBDT1JzIGVycm9yXG4gICAgICAgIHRoaXMuX3hockhhbmRsZVNlcnZlckVycm9yKHJlc3VsdCwgJ1N5bmMgTWFuYWdlciBTZXJ2ZXIgZGV0ZWN0cyBDT1JTLWxpa2UgZXJyb3JzOyByZW1vdmluZyByZXF1ZXN0JywgZmFsc2UpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ29mZmxpbmUnOlxuICAgICAgICB0aGlzLl94aHJIYW5kbGVDb25uZWN0aW9uRXJyb3IoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgLy8gV3JpdGUgdGhlIHN5bmMgZXZlbnQgYmFjayB0byB0aGUgZGF0YWJhc2UgaWYgd2UgaGF2ZW4ndCBjb21wbGV0ZWQgcHJvY2Vzc2luZyBpdFxuICAgIGlmICh0aGlzLnF1ZXVlLmluZGV4T2YocmVxdWVzdEV2dCkgIT09IC0xIHx8IHRoaXMucmVjZWlwdFF1ZXVlLmluZGV4T2YocmVxdWVzdEV2dCkgIT09IC0xKSB7XG4gICAgICB0aGlzLmNsaWVudC5kYk1hbmFnZXIud3JpdGVTeW5jRXZlbnRzKFtyZXF1ZXN0RXZ0XSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZSBhIHNlcnZlciB1bmF2YWlsYWJsZSBlcnJvci5cbiAgICpcbiAgICogSW4gdGhlIGV2ZW50IG9mIGEgNTAyIChCYWQgR2F0ZXdheSksIDUwMyAoc2VydmljZSB1bmF2YWlsYWJsZSlcbiAgICogb3IgNTA0IChnYXRld2F5IHRpbWVvdXQpIGVycm9yIGZyb20gdGhlIHNlcnZlclxuICAgKiBhc3N1bWUgd2UgaGF2ZSBhbiBlcnJvciB0aGF0IGlzIHNlbGYgY29ycmVjdGluZyBvbiB0aGUgc2VydmVyLlxuICAgKiBVc2UgZXhwb25lbnRpYWwgYmFja29mZiB0byByZXRyeSB0aGUgcmVxdWVzdC5cbiAgICpcbiAgICogTm90ZSB0aGF0IGVhY2ggY2FsbCB3aWxsIGluY3JlbWVudCByZXRyeUNvdW50OyB0aGVyZSBpcyBhIG1heGltdW1cbiAgICogb2YgTUFYX1JFVFJJRVMgYmVmb3JlIGl0IGlzIHRyZWF0ZWQgYXMgYW4gZXJyb3JcbiAgICpcbiAgICogQG1ldGhvZCAgX3hockhhbmRsZVNlcnZlclVuYXZhaWxhYmxlRXJyb3JcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RcbiAgICovXG4gIF94aHJIYW5kbGVTZXJ2ZXJVbmF2YWlsYWJsZUVycm9yKHJlcXVlc3QpIHtcbiAgICBjb25zdCBtYXhEZWxheSA9IFN5bmNNYW5hZ2VyLk1BWF9VTkFWQUlMQUJMRV9SRVRSWV9XQUlUO1xuICAgIGNvbnN0IGRlbGF5ID0gVXRpbHMuZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyhtYXhEZWxheSwgTWF0aC5taW4oMTUsIHJlcXVlc3QucmV0cnlDb3VudCsrKSk7XG4gICAgbG9nZ2VyLndhcm4oYFN5bmMgTWFuYWdlciBTZXJ2ZXIgVW5hdmFpbGFibGU7IHJldHJ5IGNvdW50ICR7cmVxdWVzdC5yZXRyeUNvdW50fTsgcmV0cnlpbmcgaW4gJHtkZWxheX0gc2Vjb25kc2ApO1xuICAgIHNldFRpbWVvdXQodGhpcy5fcHJvY2Vzc05leHRSZXF1ZXN0LmJpbmQodGhpcyksIGRlbGF5ICogMTAwMCk7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIGEgc2VydmVyIGVycm9yIGluIHJlc3BvbnNlIHRvIGZpcmluZyBzeW5jIGV2ZW50LlxuICAgKlxuICAgKiBJZiB0aGVyZSBpcyBhIHNlcnZlciBlcnJvciwgaXRzIHByZXN1bWFibHkgbm9uLXJlY292ZXJhYmxlL25vbi1yZXRyeWFibGUgZXJyb3IsIHNvXG4gICAqIHdlJ3JlIGdvaW5nIHRvIGFib3J0IHRoaXMgcmVxdWVzdC5cbiAgICpcbiAgICogMS4gSWYgYSBjYWxsYmFjayB3YXMgcHJvdmlkZWQsIGNhbGwgaXQgdG8gaGFuZGxlIHRoZSBlcnJvclxuICAgKiAyLiBJZiBhIHJvbGxiYWNrIGNhbGwgaXMgcHJvdmlkZWQsIGNhbGwgaXQgdG8gdW5kbyBhbnkgcGF0Y2gvZGVsZXRlL2V0Yy4uLiBjaGFuZ2VzXG4gICAqIDMuIElmIHRoZSByZXF1ZXN0IHdhcyB0byBjcmVhdGUgYSByZXNvdXJjZSwgcmVtb3ZlIGZyb20gdGhlIHF1ZXVlIGFsbCByZXF1ZXN0c1xuICAgKiAgICB0aGF0IGRlcGVuZGVkIHVwb24gdGhhdCByZXNvdXJjZS5cbiAgICogNC4gQWR2YW5jZSB0byBuZXh0IHJlcXVlc3RcbiAgICpcbiAgICogQG1ldGhvZCBfeGhySGFuZGxlU2VydmVyRXJyb3JcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHQgIC0gUmVzcG9uc2Ugb2JqZWN0IHJldHVybmVkIGJ5IHhociBjYWxsXG4gICAqIEBwYXJhbSAge3N0cmluZ30gbG9nTXNnIC0gTWVzc2FnZSB0byBkaXNwbGF5IGluIGNvbnNvbGVcbiAgICogQHBhcmFtICB7Ym9vbGVhbn0gc3RyaW5naWZ5IC0gbG9nIG9iamVjdCBmb3IgcXVpY2sgZGVidWdnaW5nXG4gICAqXG4gICAqL1xuICBfeGhySGFuZGxlU2VydmVyRXJyb3IocmVzdWx0LCBsb2dNc2csIHN0cmluZ2lmeSkge1xuICAgIC8vIEV4ZWN1dGUgYWxsIGNhbGxiYWNrcyBwcm92aWRlZCBieSB0aGUgcmVxdWVzdFxuICAgIGlmIChyZXN1bHQucmVxdWVzdC5jYWxsYmFjaykgcmVzdWx0LnJlcXVlc3QuY2FsbGJhY2socmVzdWx0KTtcbiAgICBpZiAoc3RyaW5naWZ5KSB7XG4gICAgICBsb2dnZXIuZXJyb3IobG9nTXNnICtcbiAgICAgICAgJ1xcblJFUVVFU1Q6ICcgKyBKU09OLnN0cmluZ2lmeShyZXN1bHQucmVxdWVzdC50b09iamVjdCgpLCBudWxsLCA0KSArXG4gICAgICAgICdcXG5SRVNQT05TRTogJyArIEpTT04uc3RyaW5naWZ5KHJlc3VsdC5kYXRhLCBudWxsLCA0KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci5lcnJvcihsb2dNc2csIHJlc3VsdCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcignc3luYzplcnJvcicsIHtcbiAgICAgIHRhcmdldDogcmVzdWx0LnJlcXVlc3QudGFyZ2V0LFxuICAgICAgcmVxdWVzdDogcmVzdWx0LnJlcXVlc3QsXG4gICAgICBlcnJvcjogcmVzdWx0LmRhdGEsXG4gICAgfSk7XG5cbiAgICByZXN1bHQucmVxdWVzdC5zdWNjZXNzID0gZmFsc2U7XG5cbiAgICAvLyBJZiBhIFBPU1QgcmVxdWVzdCBmYWlscywgYWxsIHJlcXVlc3RzIHRoYXQgZGVwZW5kIHVwb24gdGhpcyBvYmplY3RcbiAgICAvLyBtdXN0IGJlIHB1cmdlZFxuICAgIGlmIChyZXN1bHQucmVxdWVzdC5vcGVyYXRpb24gPT09ICdQT1NUJykge1xuICAgICAgdGhpcy5fcHVyZ2VEZXBlbmRlbnRSZXF1ZXN0cyhyZXN1bHQucmVxdWVzdCk7XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIHRoaXMgcmVxdWVzdCBhcyB3ZWxsIChzaWRlLWVmZmVjdDogcm9sbHMgYmFjayB0aGUgb3BlcmF0aW9uKVxuICAgIHRoaXMuX3JlbW92ZVJlcXVlc3QocmVzdWx0LnJlcXVlc3QsIHRydWUpO1xuXG4gICAgLy8gQW5kIGZpbmFsbHksIHdlIGFyZSByZWFkeSB0byB0cnkgdGhlIG5leHQgcmVxdWVzdFxuICAgIHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHRoZXJlIGlzIGEgY29ubmVjdGlvbiBlcnJvciwgd2FpdCBmb3IgcmV0cnkuXG4gICAqXG4gICAqIEluIHRoZSBldmVudCBvZiB3aGF0IGFwcGVhcnMgdG8gYmUgYSBjb25uZWN0aW9uIGVycm9yLFxuICAgKiBXYWl0IHVudGlsIGEgJ2Nvbm5lY3RlZCcgZXZlbnQgYmVmb3JlIHByb2Nlc3NpbmcgdGhlIG5leHQgcmVxdWVzdCAoYWN0dWFsbHkgcmVwcm9jZXNzaW5nIHRoZSBjdXJyZW50IGV2ZW50KVxuICAgKlxuICAgKiBAbWV0aG9kIF94aHJIYW5kbGVDb25uZWN0aW9uRXJyb3JcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF94aHJIYW5kbGVDb25uZWN0aW9uRXJyb3IoKSB7XG4gICAgLy8gTm90aGluZyB0byBiZSBkb25lOyB3ZSBhbHJlYWR5IGhhdmUgdGhlIGJlbG93IGV2ZW50IGhhbmRsZXIgc2V0dXBcbiAgICAvLyB0aGlzLm9ubGluZU1hbmFnZXIub25jZSgnY29ubmVjdGVkJywgKCkgPT4gdGhpcy5fcHJvY2Vzc05leHRSZXF1ZXN0KCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFZlcmlmeSB0aGF0IHdlIGFyZSBvbmxpbmUgYW5kIHJldHJ5IHJlcXVlc3QuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIGlzIGNhbGxlZCB3aGVuIHdlIHRoaW5rIHdlJ3JlIG9ubGluZSwgYnV0XG4gICAqIGhhdmUgZGV0ZXJtaW5lZCB3ZSBuZWVkIHRvIHZhbGlkYXRlIHRoYXQgYXNzdW1wdGlvbi5cbiAgICpcbiAgICogVGVzdCB0aGF0IHdlIGhhdmUgYSBjb25uZWN0aW9uOyBpZiB3ZSBkbyxcbiAgICogcmV0cnkgdGhlIHJlcXVlc3Qgb25jZSwgYW5kIGlmIGl0IGZhaWxzIGFnYWluLFxuICAgKiBfeGhyRXJyb3IoKSB3aWxsIGRldGVybWluZSBpdCB0byBoYXZlIGZhaWxlZCBhbmQgcmVtb3ZlIGl0IGZyb20gdGhlIHF1ZXVlLlxuICAgKlxuICAgKiBJZiB3ZSBhcmUgb2ZmbGluZSwgdGhlbiBsZXQgX3hockhhbmRsZUNvbm5lY3Rpb25FcnJvciBoYW5kbGUgaXQuXG4gICAqXG4gICAqIEBtZXRob2QgX3hoclZhbGlkYXRlSXNPbmxpbmVcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF94aHJWYWxpZGF0ZUlzT25saW5lKHJlcXVlc3RFdnQpIHtcbiAgICBsb2dnZXIuZGVidWcoJ1N5bmMgTWFuYWdlciB2ZXJpZnlpbmcgb25saW5lIHN0YXRlJyk7XG4gICAgdGhpcy5vbmxpbmVNYW5hZ2VyLmNoZWNrT25saW5lU3RhdHVzKGlzT25saW5lID0+IHRoaXMuX3hoclZhbGlkYXRlSXNPbmxpbmVDYWxsYmFjayhpc09ubGluZSwgcmVxdWVzdEV2dCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIElmIHdlIGhhdmUgdmVyaWZpZWQgd2UgYXJlIG9ubGluZSwgcmV0cnkgcmVxdWVzdC5cbiAgICpcbiAgICogV2Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSByZXNwb25zZSB0byBvdXIgL25vbmNlcyBjYWxsXG4gICAqIHdoaWNoIGFzc3VtaW5nIHRoZSBzZXJ2ZXIgaXMgYWN0dWFsbHkgYWxpdmUsXG4gICAqIHdpbGwgdGVsbCB1cyBpZiB0aGUgY29ubmVjdGlvbiBpcyB3b3JraW5nLlxuICAgKlxuICAgKiBJZiB3ZSBhcmUgb2ZmbGluZSwgZmxhZyB1cyBhcyBvZmZsaW5lIGFuZCBsZXQgdGhlIENvbm5lY3Rpb25FcnJvciBoYW5kbGVyIGhhbmRsZSB0aGlzXG4gICAqIElmIHdlIGFyZSBvbmxpbmUsIGdpdmUgdGhlIHJlcXVlc3QgYSBzaW5nbGUgcmV0cnkgKHRoZXJlIGlzIG5ldmVyIG1vcmUgdGhhbiBvbmUgcmV0cnkpXG4gICAqXG4gICAqIEBtZXRob2QgX3hoclZhbGlkYXRlSXNPbmxpbmVDYWxsYmFja1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtib29sZWFufSBpc09ubGluZSAgLSBSZXNwb25zZSBvYmplY3QgcmV0dXJuZWQgYnkgeGhyIGNhbGxcbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3RFdnQgLSBUaGUgcmVxdWVzdCB0aGF0IGZhaWxlZCB0cmlnZ2VyaW5nIHRoaXMgY2FsbFxuICAgKi9cbiAgX3hoclZhbGlkYXRlSXNPbmxpbmVDYWxsYmFjayhpc09ubGluZSwgcmVxdWVzdEV2dCkge1xuICAgIGxvZ2dlci5kZWJ1ZygnU3luYyBNYW5hZ2VyIG9ubGluZSBjaGVjayByZXN1bHQgaXMgJyArIGlzT25saW5lKTtcbiAgICBpZiAoIWlzT25saW5lKSB7XG4gICAgICAvLyBUcmVhdCB0aGlzIGFzIGEgQ29ubmVjdGlvbiBFcnJvclxuICAgICAgdGhpcy5feGhySGFuZGxlQ29ubmVjdGlvbkVycm9yKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFJldHJ5IHRoZSByZXF1ZXN0IGluIGNhc2Ugd2Ugd2VyZSBvZmZsaW5lLCBidXQgYXJlIG5vdyBvbmxpbmUuXG4gICAgICAvLyBPZiBjb3Vyc2UsIGlmIHRoaXMgZmFpbHMsIGdpdmUgaXQgdXAgZW50aXJlbHkuXG4gICAgICByZXF1ZXN0RXZ0LnJldHJ5Q291bnQrKztcbiAgICAgIHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdCgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgWEhSIHJlcXVlc3Qgd2FzIHN1Y2Nlc3NmdWwuXG4gICAqXG4gICAqIEFueSB4aHIgcmVxdWVzdCB0aGF0IGFjdHVhbGx5IHN1Y2NlZGVzOlxuICAgKlxuICAgKiAxLiBSZW1vdmUgaXQgZnJvbSB0aGUgcXVldWVcbiAgICogMi4gQ2FsbCBhbnkgY2FsbGJhY2tzXG4gICAqIDMuIEFkdmFuY2UgdG8gbmV4dCByZXF1ZXN0XG4gICAqXG4gICAqIEBtZXRob2QgX3hoclN1Y2Nlc3NcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXN1bHQgIC0gUmVzcG9uc2Ugb2JqZWN0IHJldHVybmVkIGJ5IHhociBjYWxsXG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gcmVxdWVzdEV2dCAtIFJlcXVlc3Qgb2JqZWN0XG4gICAqL1xuICBfeGhyU3VjY2VzcyhyZXN1bHQpIHtcbiAgICBjb25zdCByZXF1ZXN0RXZ0ID0gcmVzdWx0LnJlcXVlc3Q7XG4gICAgbG9nZ2VyLmRlYnVnKGBTeW5jIE1hbmFnZXIgJHtyZXF1ZXN0RXZ0IGluc3RhbmNlb2YgV2Vic29ja2V0U3luY0V2ZW50ID8gJ1dlYnNvY2tldCcgOiAnWEhSJ30gYCArXG4gICAgICBgJHtyZXF1ZXN0RXZ0Lm9wZXJhdGlvbn0gUmVxdWVzdCBvbiB0YXJnZXQgJHtyZXF1ZXN0RXZ0LnRhcmdldH0gaGFzIFN1Y2NlZWRlZGAsIHJlcXVlc3RFdnQudG9PYmplY3QoKSk7XG4gICAgaWYgKHJlc3VsdC5kYXRhKSBsb2dnZXIuZGVidWcocmVzdWx0LmRhdGEpO1xuICAgIHJlcXVlc3RFdnQuc3VjY2VzcyA9IHRydWU7XG4gICAgdGhpcy5fcmVtb3ZlUmVxdWVzdChyZXF1ZXN0RXZ0LCB0cnVlKTtcbiAgICBpZiAocmVxdWVzdEV2dC5jYWxsYmFjaykgcmVxdWVzdEV2dC5jYWxsYmFjayhyZXN1bHQpO1xuICAgIHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdCgpO1xuXG4gICAgdGhpcy50cmlnZ2VyKCdzeW5jOnN1Y2Nlc3MnLCB7XG4gICAgICB0YXJnZXQ6IHJlcXVlc3RFdnQudGFyZ2V0LFxuICAgICAgcmVxdWVzdDogcmVxdWVzdEV2dCxcbiAgICAgIHJlc3BvbnNlOiByZXN1bHQuZGF0YSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGhlIFN5bmNFdmVudCByZXF1ZXN0IGZyb20gdGhlIHF1ZXVlLlxuICAgKlxuICAgKiBAbWV0aG9kIF9yZW1vdmVSZXF1ZXN0XG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gcmVxdWVzdEV2dCAtIFN5bmNFdmVudCBSZXF1ZXN0IHRvIHJlbW92ZVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IGRlbGV0ZURCIC0gRGVsZXRlIGZyb20gaW5kZXhlZERCXG4gICAqL1xuICBfcmVtb3ZlUmVxdWVzdChyZXF1ZXN0RXZ0LCBkZWxldGVEQikge1xuICAgIGNvbnN0IHF1ZXVlID0gcmVxdWVzdEV2dC5vcGVyYXRpb24gPT09ICdSRUNFSVBUJyA/IHRoaXMucmVjZWlwdFF1ZXVlIDogdGhpcy5xdWV1ZTtcbiAgICBjb25zdCBpbmRleCA9IHF1ZXVlLmluZGV4T2YocmVxdWVzdEV2dCk7XG4gICAgaWYgKGluZGV4ICE9PSAtMSkgcXVldWUuc3BsaWNlKGluZGV4LCAxKTtcbiAgICBpZiAoZGVsZXRlREIpIHRoaXMuY2xpZW50LmRiTWFuYWdlci5kZWxldGVPYmplY3RzKCdzeW5jUXVldWUnLCBbcmVxdWVzdEV2dF0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSByZXF1ZXN0cyBmcm9tIHF1ZXVlIHRoYXQgZGVwZW5kIG9uIHNwZWNpZmllZCByZXNvdXJjZS5cbiAgICpcbiAgICogSWYgdGhlcmUgaXMgYSBQT1NUIHJlcXVlc3QgdG8gY3JlYXRlIGEgbmV3IHJlc291cmNlLCBhbmQgdGhlcmUgYXJlIFBBVENILCBERUxFVEUsIGV0Yy4uLlxuICAgKiByZXF1ZXN0cyBvbiB0aGF0IHJlc291cmNlLCBpZiB0aGUgUE9TVCByZXF1ZXN0IGZhaWxzLCB0aGVuIGFsbCBQQVRDSCwgREVMRVRFLCBldGNcbiAgICogcmVxdWVzdHMgbXVzdCBiZSByZW1vdmVkIGZyb20gdGhlIHF1ZXVlLlxuICAgKlxuICAgKiBOb3RlIHRoYXQgd2UgZG8gbm90IGNhbGwgdGhlIHJvbGxiYWNrIG9uIHRoZXNlIGRlcGVuZGVudCByZXF1ZXN0cyBiZWNhdXNlIHRoZSBleHBlY3RlZFxuICAgKiByb2xsYmFjayBpcyB0byBkZXN0cm95IHRoZSB0aGluZyB0aGF0IHdhcyBjcmVhdGVkLCB3aGljaCBtZWFucyBhbnkgb3RoZXIgcm9sbGJhY2sgaGFzIG5vIGVmZmVjdC5cbiAgICpcbiAgICogQG1ldGhvZCBfcHVyZ2VEZXBlbmRlbnRSZXF1ZXN0c1xuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtsYXllci5TeW5jRXZlbnR9IHJlcXVlc3QgLSBSZXF1ZXN0IHdob3NlIHRhcmdldCBpcyBubyBsb25nZXIgdmFsaWRcbiAgICovXG4gIF9wdXJnZURlcGVuZGVudFJlcXVlc3RzKHJlcXVlc3QpIHtcbiAgICB0aGlzLnF1ZXVlID0gdGhpcy5xdWV1ZS5maWx0ZXIoZXZ0ID0+IGV2dC5kZXBlbmRzLmluZGV4T2YocmVxdWVzdC50YXJnZXQpID09PSAtMSB8fCBldnQgPT09IHJlcXVlc3QpO1xuICAgIHRoaXMucmVjZWlwdFF1ZXVlID0gdGhpcy5yZWNlaXB0UXVldWUuZmlsdGVyKGV2dCA9PiBldnQuZGVwZW5kcy5pbmRleE9mKHJlcXVlc3QudGFyZ2V0KSA9PT0gLTEgfHwgZXZ0ID09PSByZXF1ZXN0KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIFJlbW92ZSBmcm9tIHF1ZXVlIGFsbCBldmVudHMgdGhhdCBvcGVyYXRlIHVwb24gdGhlIGRlbGV0ZWQgb2JqZWN0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9wdXJnZU9uRGVsZXRlXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLlN5bmNFdmVudH0gZXZ0IC0gRGVsZXRlIGV2ZW50IHRoYXQgcmVxdWlyZXMgcmVtb3ZhbCBvZiBvdGhlciBldmVudHNcbiAgICovXG4gIF9wdXJnZU9uRGVsZXRlKGV2dCkge1xuICAgIHRoaXMucXVldWUuZmlsdGVyKHJlcXVlc3QgPT4gcmVxdWVzdC5kZXBlbmRzLmluZGV4T2YoZXZ0LnRhcmdldCkgIT09IC0xICYmIGV2dCAhPT0gcmVxdWVzdClcbiAgICAgIC5mb3JFYWNoKHJlcXVlc3RFdnQgPT4ge1xuICAgICAgICB0aGlzLnRyaWdnZXIoJ3N5bmM6YWJvcnQnLCB7XG4gICAgICAgICAgdGFyZ2V0OiByZXF1ZXN0RXZ0LnRhcmdldCxcbiAgICAgICAgICByZXF1ZXN0OiByZXF1ZXN0RXZ0LFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fcmVtb3ZlUmVxdWVzdChyZXF1ZXN0RXZ0LCB0cnVlKTtcbiAgICAgIH0pO1xuICB9XG5cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMucXVldWUuZm9yRWFjaChldnQgPT4gZXZ0LmRlc3Ryb3koKSk7XG4gICAgdGhpcy5xdWV1ZSA9IG51bGw7XG4gICAgdGhpcy5yZWNlaXB0UXVldWUuZm9yRWFjaChldnQgPT4gZXZ0LmRlc3Ryb3koKSk7XG4gICAgdGhpcy5yZWNlaXB0UXVldWUgPSBudWxsO1xuICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2FkIGFueSB1bnNlbnQgcmVxdWVzdHMgZnJvbSBpbmRleGVkREIuXG4gICAqXG4gICAqIElmIHBlcnNpc3RlbmNlIGlzIGRpc2FibGVkLCBub3RoaW5nIHdpbGwgaGFwcGVuO1xuICAgKiBlbHNlIGFsbCByZXF1ZXN0cyBmb3VuZCBpbiB0aGUgZGF0YWJhc2Ugd2lsbCBiZSBhZGRlZCB0byB0aGUgcXVldWUuXG4gICAqIEBtZXRob2QgX2xvYWRQZXJzaXN0ZWRRdWV1ZVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2xvYWRQZXJzaXN0ZWRRdWV1ZSgpIHtcbiAgICB0aGlzLmNsaWVudC5kYk1hbmFnZXIubG9hZFN5bmNRdWV1ZShkYXRhID0+IHtcbiAgICAgIGlmIChkYXRhLmxlbmd0aCkge1xuICAgICAgICB0aGlzLnF1ZXVlID0gdGhpcy5xdWV1ZS5jb25jYXQoZGF0YSk7XG4gICAgICAgIHRoaXMuX3Byb2Nlc3NOZXh0UmVxdWVzdCgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogV2Vic29ja2V0IE1hbmFnZXIgZm9yIGdldHRpbmcgc29ja2V0IHN0YXRlLlxuICogQHR5cGUge2xheWVyLldlYnNvY2tldHMuU29ja2V0TWFuYWdlcn1cbiAqL1xuU3luY01hbmFnZXIucHJvdG90eXBlLnNvY2tldE1hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIFdlYnNvY2tldCBSZXF1ZXN0IE1hbmFnZXIgZm9yIHNlbmRpbmcgcmVxdWVzdHMuXG4gKiBAdHlwZSB7bGF5ZXIuV2Vic29ja2V0cy5SZXF1ZXN0TWFuYWdlcn1cbiAqL1xuU3luY01hbmFnZXIucHJvdG90eXBlLnJlcXVlc3RNYW5hZ2VyID0gbnVsbDtcblxuLyoqXG4gKiBSZWZlcmVuY2UgdG8gdGhlIE9ubGluZSBTdGF0ZSBNYW5hZ2VyLlxuICpcbiAqIFN5bmMgTWFuYWdlciB1c2VzIG9ubGluZSBzdGF0dXMgdG8gZGV0ZXJtaW5lIGlmIGl0IGNhbiBmaXJlIHN5bmMtcmVxdWVzdHMuXG4gKiBAcHJpdmF0ZVxuICogQHR5cGUge2xheWVyLk9ubGluZVN0YXRlTWFuYWdlcn1cbiAqL1xuU3luY01hbmFnZXIucHJvdG90eXBlLm9ubGluZU1hbmFnZXIgPSBudWxsO1xuXG4vKipcbiAqIFRoZSBhcnJheSBvZiBsYXllci5TeW5jRXZlbnQgaW5zdGFuY2VzIGF3YWl0aW5nIHRvIGJlIGZpcmVkLlxuICogQHR5cGUge2xheWVyLlN5bmNFdmVudFtdfVxuICovXG5TeW5jTWFuYWdlci5wcm90b3R5cGUucXVldWUgPSBudWxsO1xuXG4vKipcbiAqIFRoZSBhcnJheSBvZiBsYXllci5TeW5jRXZlbnQgaW5zdGFuY2VzIGF3YWl0aW5nIHRvIGJlIGZpcmVkLlxuICpcbiAqIFJlY2VpcHRzIGNhbiBnZW5lcmFsbHkganVzdCBiZSBmaXJlZCBvZmYgYWxsIGF0IG9uY2Ugd2l0aG91dCBtdWNoIGZyZXR0aW5nIGFib3V0IG9yZGVyaW5nIG9yIGRlcGVuZGVuY2llcy5cbiAqIEB0eXBlIHtsYXllci5TeW5jRXZlbnRbXX1cbiAqL1xuU3luY01hbmFnZXIucHJvdG90eXBlLnJlY2VpcHRRdWV1ZSA9IG51bGw7XG5cbi8qKlxuICogUmVmZXJlbmNlIHRvIHRoZSBDbGllbnQgc28gdGhhdCB3ZSBjYW4gcGFzcyBpdCB0byBTeW5jRXZlbnRzICB3aGljaCBtYXkgbmVlZCB0byBsb29rdXAgdGhlaXIgdGFyZ2V0c1xuICovXG5TeW5jTWFuYWdlci5wcm90b3R5cGUuY2xpZW50ID0gbnVsbDtcblxuLyoqXG4gKiBNYXhpbXVtIGV4cG9uZW50aWFsIGJhY2tvZmYgd2FpdC5cbiAqXG4gKiBJZiB0aGUgc2VydmVyIGlzIHJldHVybmluZyA1MDIsIDUwMyBvciA1MDQgZXJyb3JzLCBleHBvbmVudGlhbCBiYWNrb2ZmXG4gKiBzaG91bGQgbmV2ZXIgd2FpdCBsb25nZXIgdGhhbiB0aGlzIG51bWJlciBvZiBzZWNvbmRzICgxNSBtaW51dGVzKVxuICogQHR5cGUge051bWJlcn1cbiAqIEBzdGF0aWNcbiAqL1xuU3luY01hbmFnZXIuTUFYX1VOQVZBSUxBQkxFX1JFVFJZX1dBSVQgPSA2MCAqIDE1O1xuXG4vKipcbiAqIFJldHJpZXMgYmVmb3JlIHN1c3BlY3QgQ09SUyBlcnJvci5cbiAqXG4gKiBIb3cgbWFueSB0aW1lcyBjYW4gd2UgdHJhbnNpdGlvbiBmcm9tIG9mZmxpbmUgdG8gb25saW5lIHN0YXRlXG4gKiB3aXRoIHRoaXMgcmVxdWVzdCBhdCB0aGUgZnJvbnQgb2YgdGhlIHF1ZXVlIGJlZm9yZSB3ZSBjb25jbHVkZVxuICogdGhhdCB0aGUgcmVhc29uIHdlIGtlZXAgdGhpbmtpbmcgd2UncmUgZ29pbmcgb2ZmbGluZSBpc1xuICogYSBDT1JTIGVycm9yIHJldHVybmluZyBhIHN0YXR1cyBvZiAwLiAgSWYgdGhhdCBwYXR0ZXJuXG4gKiBzaG93cyAzIHRpbWVzIGluIGEgcm93LCB0aGVyZSBpcyBsaWtlbHkgYSBDT1JTIGVycm9yLlxuICogTm90ZSB0aGF0IENPUlMgZXJyb3JzIGFwcGVhciB0byBqYXZhc2NyaXB0IGFzIGEgc3RhdHVzPTAgZXJyb3IsXG4gKiB3aGljaCBpcyB0aGUgc2FtZSBhcyBpZiB0aGUgY2xpZW50IHdlcmUgb2ZmbGluZS5cbiAqIEB0eXBlIHtudW1iZXJ9XG4gKiBAc3RhdGljXG4gKi9cblN5bmNNYW5hZ2VyLk1BWF9SRVRSSUVTX0JFRk9SRV9DT1JTX0VSUk9SID0gMztcblxuLyoqXG4gKiBBYm9ydCByZXF1ZXN0IGFmdGVyIHRoaXMgbnVtYmVyIG9mIHJldHJpZXMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBzdGF0aWNcbiAqL1xuU3luY01hbmFnZXIuTUFYX1JFVFJJRVMgPSAyMDtcblxuXG5TeW5jTWFuYWdlci5fc3VwcG9ydGVkRXZlbnRzID0gW1xuICAvKipcbiAgICogQSBzeW5jIHJlcXVlc3QgaGFzIGZhaWxlZC5cbiAgICpcbiAgICogYGBgXG4gICAqIGNsaWVudC5zeW5jTWFuYWdlci5vbignc3luYzplcnJvcicsIGZ1bmN0aW9uKGV2dCkge1xuICAgKiAgICBjb25zb2xlLmVycm9yKGV2dC50YXJnZXQuaWQgKyAnIGZhaWxlZCB0byBzZW5kIGNoYW5nZXMgdG8gc2VydmVyOiAnLCByZXN1bHQuZGF0YS5tZXNzYWdlKTtcbiAgICogICAgY29uc29sZS5sb2coJ1JlcXVlc3QgRXZlbnQ6JywgcmVxdWVzdEV2dCk7XG4gICAqICAgIGNvbnNvbGUubG9nKCdTZXJ2ZXIgUmVzcG9uc2U6JywgcmVzdWx0LmRhdGEpO1xuICAgKiB9KTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudH0gZXZ0IC0gVGhlIHJlcXVlc3Qgb2JqZWN0XG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXN1bHRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHJlc3VsdC50YXJnZXQgLSBJRCBvZiB0aGUgbWVzc2FnZS9jb252ZXJzYXRpb24vZXRjLiBiZWluZyBvcGVyYXRlZCB1cG9uXG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50fSByZXN1bHQucmVxdWVzdCAtIFRoZSBvcmlnaW5hbCByZXF1ZXN0XG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXN1bHQuZXJyb3IgLSBUaGUgZXJyb3Igb2JqZWN0IHtpZCwgY29kZSwgbWVzc2FnZSwgdXJsfVxuICAgKi9cbiAgJ3N5bmM6ZXJyb3InLFxuXG4gIC8qKlxuICAgKiBBIHN5bmMgbGF5ZXIgcmVxdWVzdCBoYXMgY29tcGxldGVkIHN1Y2Nlc3NmdWxseS5cbiAgICpcbiAgICogYGBgXG4gICAqIGNsaWVudC5zeW5jTWFuYWdlci5vbignc3luYzpzdWNjZXNzJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgIGNvbnNvbGUubG9nKGV2dC50YXJnZXQuaWQgKyAnIGNoYW5nZXMgc2VudCB0byBzZXJ2ZXIgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAqICAgIGNvbnNvbGUubG9nKCdSZXF1ZXN0IEV2ZW50OicsIHJlcXVlc3RFdnQpO1xuICAgKiAgICBjb25zb2xlLmxvZygnU2VydmVyIFJlc3BvbnNlOicsIHJlc3VsdC5kYXRhKTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAZXZlbnRcbiAgICogQHBhcmFtIHtPYmplY3R9IHJlc3VsdFxuICAgKiBAcGFyYW0ge3N0cmluZ30gcmVzdWx0LnRhcmdldCAtIElEIG9mIHRoZSBtZXNzYWdlL2NvbnZlcnNhdGlvbi9ldGMuIGJlaW5nIG9wZXJhdGVkIHVwb25cbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IHJlc3VsdC5yZXF1ZXN0IC0gVGhlIG9yaWdpbmFsIHJlcXVlc3RcbiAgICogQHBhcmFtIHtPYmplY3R9IHJlc3VsdC5kYXRhIC0gbnVsbCBvciBhbnkgZGF0YSByZXR1cm5lZCBieSB0aGUgY2FsbFxuICAgKi9cbiAgJ3N5bmM6c3VjY2VzcycsXG5cbiAgLyoqXG4gICAqIEEgbmV3IHN5bmMgcmVxdWVzdCBoYXMgYmVlbiBhZGRlZC5cbiAgICpcbiAgICogYGBgXG4gICAqIGNsaWVudC5zeW5jTWFuYWdlci5vbignc3luYzphZGQnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgY29uc29sZS5sb2coZXZ0LnRhcmdldC5pZCArICcgaGFzIGNoYW5nZXMgcXVldWVkIGZvciB0aGUgc2VydmVyJyk7XG4gICAqICAgIGNvbnNvbGUubG9nKCdSZXF1ZXN0IEV2ZW50OicsIHJlcXVlc3RFdnQpO1xuICAgKiB9KTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBldmVudFxuICAgKiBAcGFyYW0ge09iamVjdH0gcmVzdWx0XG4gICAqIEBwYXJhbSB7c3RyaW5nfSByZXN1bHQudGFyZ2V0IC0gSUQgb2YgdGhlIG1lc3NhZ2UvY29udmVyc2F0aW9uL2V0Yy4gYmVpbmcgb3BlcmF0ZWQgdXBvblxuICAgKiBAcGFyYW0ge2xheWVyLlN5bmNFdmVudH0gZXZ0IC0gVGhlIHJlcXVlc3Qgb2JqZWN0XG4gICAqL1xuICAnc3luYzphZGQnLFxuXG4gIC8qKlxuICAgKiBBIHN5bmMgcmVxdWVzdCBoYXMgYmVlbiBjYW5jZWxlZC5cbiAgICpcbiAgICogVHlwaWNhbGx5IGNhdXNlZCBieSBhIG5ldyBTeW5jRXZlbnQgdGhhdCBkZWxldGVzIHRoZSB0YXJnZXQgb2YgdGhpcyBTeW5jRXZlbnRcbiAgICpcbiAgICogQGV2ZW50XG4gICAqIEBwYXJhbSB7bGF5ZXIuU3luY0V2ZW50fSBldnQgLSBUaGUgcmVxdWVzdCBvYmplY3RcbiAgICogQHBhcmFtIHtPYmplY3R9IHJlc3VsdFxuICAgKiBAcGFyYW0ge3N0cmluZ30gcmVzdWx0LnRhcmdldCAtIElEIG9mIHRoZSBtZXNzYWdlL2NvbnZlcnNhdGlvbi9ldGMuIGJlaW5nIG9wZXJhdGVkIHVwb25cbiAgICogQHBhcmFtIHtsYXllci5TeW5jRXZlbnR9IHJlc3VsdC5yZXF1ZXN0IC0gVGhlIG9yaWdpbmFsIHJlcXVlc3RcbiAgICovXG4gICdzeW5jOmFib3J0Jyxcbl0uY29uY2F0KFJvb3QuX3N1cHBvcnRlZEV2ZW50cyk7XG5cblJvb3QuaW5pdENsYXNzKFN5bmNNYW5hZ2VyKTtcbm1vZHVsZS5leHBvcnRzID0gU3luY01hbmFnZXI7XG4iXX0=
